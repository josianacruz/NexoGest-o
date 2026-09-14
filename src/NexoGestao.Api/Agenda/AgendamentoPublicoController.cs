using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record CriarAgendamentoPublicoRequest(
    int ServicoId,
    DateTime Data,
    string Hora,
    string NomeCliente,
    string Celular);

// Controller público (sem login) pro cliente final marcar horário sozinho.
// Não herda TenantControllerBase porque não há usuário/membro autenticado —
// a empresa é validada só pela existência + módulo Agenda habilitado.
[ApiController]
[Route("api/publico/empresas/{empresaId:int}/agenda")]
[EnableRateLimiting("publico")]
public class AgendamentoPublicoController : ControllerBase
{
    private readonly AppDbContext Context;

    public AgendamentoPublicoController(AppDbContext context)
    {
        Context = context;
    }

    private async Task<bool> EmpresaComAgendaHabilitadaAsync(int empresaId)
    {
        var existe = await Context.Empresas.AnyAsync(e => e.Id == empresaId);
        if (!existe)
            return false;

        Context.EmpresaAtualId = empresaId;

        var temConfiguracao = await Context.ModulosEmpresa.AnyAsync(m => m.EmpresaId == empresaId);
        if (!temConfiguracao)
            return true;

        return await Context.ModulosEmpresa.AnyAsync(m =>
            m.EmpresaId == empresaId && m.Modulo == Modulo.Agenda && m.Habilitado);
    }

    private static DateTime CombinarDataHora(DateTime data, string hora)
    {
        var partes = hora.Split(':');
        var horas = int.Parse(partes[0]);
        var minutos = int.Parse(partes[1]);
        return DateTime.SpecifyKind(data.Date.AddHours(horas).AddMinutes(minutos), DateTimeKind.Utc);
    }

    private async Task<bool> HorarioLivreAsync(DateTime inicio, int duracaoMinutos)
    {
        var fim = inicio.AddMinutes(duracaoMinutos);

        var doDia = await Context.Agendamentos
            .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora.Date == inicio.Date)
            .Select(a => new { a.DataHora, a.DuracaoMinutos })
            .ToListAsync();

        return !doDia.Any(a => a.DataHora < fim && inicio < a.DataHora.AddMinutes(a.DuracaoMinutos));
    }

    [HttpGet("servicos")]
    public async Task<IActionResult> ListarServicos(int empresaId)
    {
        if (!await EmpresaComAgendaHabilitadaAsync(empresaId))
            return NotFound(new { mensagem = "Empresa não encontrada ou agendamento indisponível." });

        var servicos = await Context.Servicos
            .Where(s => s.Ativo && s.PermiteAutoagendamento)
            .OrderBy(s => s.Nome)
            .Select(s => new { s.Id, s.Nome, s.DuracaoMinutos, s.Preco })
            .ToListAsync();

        return Ok(servicos);
    }

    [HttpGet("horarios")]
    public async Task<IActionResult> ListarHorarios(int empresaId, [FromQuery] int servicoId, [FromQuery] DateTime data)
    {
        if (!await EmpresaComAgendaHabilitadaAsync(empresaId))
            return NotFound(new { mensagem = "Empresa não encontrada ou agendamento indisponível." });

        var servico = await Context.Servicos
            .FirstOrDefaultAsync(s => s.Id == servicoId && s.Ativo && s.PermiteAutoagendamento);
        if (servico is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });

        var dataBase = DateTime.SpecifyKind(data.Date, DateTimeKind.Utc);

        var diaConfigurado = await Context.ConfiguracoesDiaSemana
            .FirstOrDefaultAsync(d => d.DiaSemana == (int)dataBase.DayOfWeek);

        string horaInicio, horaFim;
        if (diaConfigurado is not null)
        {
            if (!diaConfigurado.Ativo)
                return Ok(Array.Empty<string>());
            horaInicio = diaConfigurado.HoraInicio;
            horaFim = diaConfigurado.HoraFim;
        }
        else
        {
            var config = await Context.ConfiguracoesAgenda.FirstOrDefaultAsync(c => c.EmpresaId == empresaId);
            horaInicio = string.IsNullOrWhiteSpace(config?.HoraInicioAtendimento) ? "08:00" : config.HoraInicioAtendimento;
            horaFim = string.IsNullOrWhiteSpace(config?.HoraFimAtendimento) ? "18:00" : config.HoraFimAtendimento;
        }

        var inicioJanela = CombinarDataHora(dataBase, horaInicio);
        var fimJanela = CombinarDataHora(dataBase, horaFim);

        var doDia = await Context.Agendamentos
            .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora.Date == dataBase.Date)
            .Select(a => new { a.DataHora, a.DuracaoMinutos })
            .ToListAsync();

        var duracao = servico.DuracaoMinutos;
        var agora = DateTime.UtcNow;
        var disponiveis = new List<string>();

        for (var horario = inicioJanela; horario.AddMinutes(duracao) <= fimJanela; horario = horario.AddMinutes(duracao))
        {
            if (horario < agora)
                continue;

            var fimSlot = horario.AddMinutes(duracao);
            var ocupado = doDia.Any(a => a.DataHora < fimSlot && horario < a.DataHora.AddMinutes(a.DuracaoMinutos));
            if (!ocupado)
                disponiveis.Add(horario.ToString("HH:mm"));
        }

        return Ok(disponiveis);
    }

    [HttpPost("agendamento")]
    public async Task<IActionResult> Criar(int empresaId, CriarAgendamentoPublicoRequest request)
    {
        if (!await EmpresaComAgendaHabilitadaAsync(empresaId))
            return NotFound(new { mensagem = "Empresa não encontrada ou agendamento indisponível." });

        if (string.IsNullOrWhiteSpace(request.NomeCliente))
            return BadRequest(new { mensagem = "Informe seu nome." });

        var telefoneNormalizado = TelefoneUtil.Normalizar(request.Celular);
        if (telefoneNormalizado is null)
            return BadRequest(new { mensagem = "Informe um celular válido." });

        var servico = await Context.Servicos
            .FirstOrDefaultAsync(s => s.Id == request.ServicoId && s.Ativo && s.PermiteAutoagendamento);
        if (servico is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });

        var inicio = CombinarDataHora(request.Data, request.Hora);
        if (inicio < DateTime.UtcNow)
            return BadRequest(new { mensagem = "Esse horário já passou." });

        // Trava só quem tenta marcar na mesma empresa+dia — outras empresas e
        // outros dias seguem em paralelo sem esperar. A trava fica até o fim
        // da transação, então o segundo clique só entra depois que o primeiro
        // já confirmou (ou desistiu) desse horário.
        await using var transacao = await Context.Database.BeginTransactionAsync();
        await ConcorrenciaUtil.TravarChaveAsync(Context, $"agenda:{empresaId}:{inicio:yyyyMMdd}");

        // Casa pelo telefone normalizado (mesmos dígitos), evitando duplicar cliente.
        var clientesDaEmpresa = await Context.Clientes.ToListAsync();
        var cliente = clientesDaEmpresa.FirstOrDefault(c => TelefoneUtil.Normalizar(c.Telefone) == telefoneNormalizado);

        if (cliente is null)
        {
            cliente = new Cliente
            {
                EmpresaId = empresaId,
                Nome = request.NomeCliente.Trim(),
                Telefone = request.Celular.Trim(),
            };
            Context.Clientes.Add(cliente);
            await Context.SaveChangesAsync();
        }

        // Clique duplicado / retry de rede pro mesmo cliente+horário: devolve o
        // agendamento que já existe em vez de checar disponibilidade de novo
        // (senão o próprio agendamento do clique anterior "ocuparia" o horário
        // e o clique repetido veria como indisponível em vez de já confirmado).
        var existente = await Context.Agendamentos.FirstOrDefaultAsync(a =>
            a.ClienteId == cliente.Id && a.DataHora == inicio && a.Status != StatusAgendamento.Cancelado);
        if (existente is not null)
        {
            await transacao.CommitAsync();
            return Ok(new
            {
                existente.Id,
                existente.DataHora,
                existente.ServicoNome,
                existente.DuracaoMinutos,
                existente.Valor,
            });
        }

        if (!await HorarioLivreAsync(inicio, servico.DuracaoMinutos))
        {
            return Conflict(new { mensagem = "Esse horário acabou de ficar indisponível. Escolha outro horário." });
        }

        var agendamento = new Agendamento
        {
            EmpresaId = empresaId,
            ClienteId = cliente.Id,
            ServicoId = servico.Id,
            ServicoNome = servico.Nome,
            DataHora = inicio,
            DuracaoMinutos = servico.DuracaoMinutos,
            Valor = servico.Preco,
            Status = StatusAgendamento.Agendado,
            Origem = OrigemAgendamento.Autoagendamento,
        };
        Context.Agendamentos.Add(agendamento);
        await Context.SaveChangesAsync();
        await transacao.CommitAsync();

        return Ok(new
        {
            agendamento.Id,
            agendamento.DataHora,
            agendamento.ServicoNome,
            agendamento.DuracaoMinutos,
            agendamento.Valor,
        });
    }
}
