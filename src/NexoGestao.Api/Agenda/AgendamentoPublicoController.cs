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

    // Tudo que a página pública precisa para abrir, em UMA ida ao servidor e UMA consulta ao banco:
    // nome da loja (com a frase), WhatsApp e a lista de serviços. Com ?completa=true devolve todos os serviços ATIVOS
    // (tabela de preços, inclusive os que não aceitam autoagendamento); sem isso, só os que podem ser agendados online.
    // A resposta pode ficar alguns segundos no navegador (mudanças da dona aparecem em até 1 minuto).
    [EnableRateLimiting("publico-leitura")]
    [HttpGet("pagina")]
    public async Task<IActionResult> Pagina(int empresaId, [FromQuery] bool completa = false)
    {
        Context.EmpresaAtualId = empresaId; // os filtros por empresa valem para a lista de serviços

        var dados = await Context.Empresas
            .AsNoTracking()
            .Where(e => e.Id == empresaId)
            .Select(e => new
            {
                e.Nome,
                e.WhatsApp,
                TemConfiguracao = e.Modulos.Any(),
                AgendaLigada = e.Modulos.Any(m => m.Modulo == Modulo.Agenda && m.Habilitado),
                Servicos = Context.Servicos
                    .Where(s => s.Ativo && (completa || s.PermiteAutoagendamento))
                    .OrderBy(s => s.Nome)
                    .Select(s => new { s.Id, s.Nome, s.DuracaoMinutos, s.Preco, s.PermiteAutoagendamento })
                    .ToList(),
            })
            .FirstOrDefaultAsync();

        // Empresa sem configuração de módulos (antiga) mantém a agenda liberada; com configuração, precisa estar ligada.
        if (dados is null || (dados.TemConfiguracao && !dados.AgendaLigada))
            return NotFound(new { mensagem = "Empresa não encontrada ou agendamento indisponível." });

        Response.Headers.CacheControl = "public, max-age=30, stale-while-revalidate=300";
        return Ok(new { dados.Nome, dados.WhatsApp, dados.Servicos });
    }

    [EnableRateLimiting("publico-leitura")]
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

    // Horários livres de um dia para um serviço: UMA consulta ao banco traz serviço, regra do dia, janela padrão,
    // módulo e os agendamentos do dia; o resto é conta em memória (ver HorariosLivres).
    [EnableRateLimiting("publico-leitura")]
    [HttpGet("horarios")]
    public async Task<IActionResult> ListarHorarios(int empresaId, [FromQuery] int servicoId, [FromQuery] DateTime data)
    {
        Context.EmpresaAtualId = empresaId; // os filtros por empresa valem para tudo abaixo

        var dataBase = DateTime.SpecifyKind(data.Date, DateTimeKind.Utc);
        var proximoDia = dataBase.AddDays(1);
        var diaSemana = (int)dataBase.DayOfWeek;

        var dados = await Context.Servicos
            .AsNoTracking()
            .Where(s => s.Id == servicoId && s.Ativo && s.PermiteAutoagendamento)
            .Select(s => new
            {
                s.DuracaoMinutos,
                TemConfiguracao = Context.ModulosEmpresa.Any(m => m.EmpresaId == empresaId),
                AgendaLigada = Context.ModulosEmpresa.Any(m => m.EmpresaId == empresaId && m.Modulo == Modulo.Agenda && m.Habilitado),
                Dia = Context.ConfiguracoesDiaSemana
                    .Where(d => d.DiaSemana == diaSemana)
                    .Select(d => new { d.Ativo, d.HoraInicio, d.HoraFim })
                    .FirstOrDefault(),
                Padrao = Context.ConfiguracoesAgenda
                    .Where(c => c.EmpresaId == empresaId)
                    .Select(c => new { c.HoraInicioAtendimento, c.HoraFimAtendimento })
                    .FirstOrDefault(),
                // faixa [dia, dia+1) em vez de "DataHora.Date": assim o índice (EmpresaId, DataHora) é usado
                Ocupados = Context.Agendamentos
                    .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora >= dataBase && a.DataHora < proximoDia)
                    .Select(a => new { a.DataHora, a.DuracaoMinutos })
                    .ToList(),
            })
            .FirstOrDefaultAsync();

        if (dados is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });
        if (dados.TemConfiguracao && !dados.AgendaLigada)
            return NotFound(new { mensagem = "Empresa não encontrada ou agendamento indisponível." });

        string horaInicio, horaFim;
        if (dados.Dia is not null)
        {
            if (!dados.Dia.Ativo)
                return Ok(Array.Empty<string>());
            horaInicio = dados.Dia.HoraInicio;
            horaFim = dados.Dia.HoraFim;
        }
        else
        {
            horaInicio = string.IsNullOrWhiteSpace(dados.Padrao?.HoraInicioAtendimento) ? "08:00" : dados.Padrao.HoraInicioAtendimento;
            horaFim = string.IsNullOrWhiteSpace(dados.Padrao?.HoraFimAtendimento) ? "18:00" : dados.Padrao.HoraFimAtendimento;
        }

        var ocupados = dados.Ocupados.Select(o => (o.DataHora, o.DuracaoMinutos));
        return Ok(HorariosLivres(CombinarDataHora(dataBase, horaInicio), CombinarDataHora(dataBase, horaFim), dados.DuracaoMinutos, DateTime.UtcNow, ocupados));
    }

    // Todos os horários que o serviço pode ocupar dentro da janela de trabalho (passo = duração do serviço).
    public static List<DateTime> GradeDoDia(DateTime inicioJanela, DateTime fimJanela, int duracaoMinutos)
    {
        var grade = new List<DateTime>();
        if (duracaoMinutos <= 0)
            return grade;

        for (var horario = inicioJanela; horario.AddMinutes(duracaoMinutos) <= fimJanela; horario = horario.AddMinutes(duracaoMinutos))
            grade.Add(horario);
        return grade;
    }

    // Conta pura (sem banco): horários da grade a partir de agora e sem bater em agendamento existente.
    public static List<string> HorariosLivres(DateTime inicioJanela, DateTime fimJanela, int duracaoMinutos, DateTime agora, IEnumerable<(DateTime Inicio, int Minutos)> ocupados)
    {
        var lista = ocupados.ToList();
        return GradeDoDia(inicioJanela, fimJanela, duracaoMinutos)
            .Where(h => h >= agora)
            .Where(h =>
            {
                var fimSlot = h.AddMinutes(duracaoMinutos);
                return !lista.Any(a => a.Inicio < fimSlot && h < a.Inicio.AddMinutes(a.Minutos));
            })
            .Select(h => h.ToString("HH:mm"))
            .ToList();
    }

    // Janela de trabalho de uma data: a regra do dia da semana (Configurações > Horário de trabalho); sem ela, a janela
    // padrão da agenda. Devolve nulo quando a loja não atende nesse dia.
    private async Task<(string Inicio, string Fim)?> JanelaDoDiaAsync(DateTime dia)
    {
        var diaSemana = (int)dia.DayOfWeek;
        var regra = await Context.ConfiguracoesDiaSemana.AsNoTracking().Where(d => d.DiaSemana == diaSemana).Select(d => new { d.Ativo, d.HoraInicio, d.HoraFim }).FirstOrDefaultAsync();
        if (regra is not null)
            return regra.Ativo ? (regra.HoraInicio, regra.HoraFim) : null;

        var padrao = await Context.ConfiguracoesAgenda.AsNoTracking().Select(c => new { c.HoraInicioAtendimento, c.HoraFimAtendimento }).FirstOrDefaultAsync();
        return (string.IsNullOrWhiteSpace(padrao?.HoraInicioAtendimento) ? "08:00" : padrao.HoraInicioAtendimento,
                string.IsNullOrWhiteSpace(padrao?.HoraFimAtendimento) ? "18:00" : padrao.HoraFimAtendimento);
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

        if (!HorarioTrabalho.HoraValida(request.Hora))
            return BadRequest(new { mensagem = "Horário inválido." });

        var inicio = CombinarDataHora(request.Data, request.Hora);
        if (inicio < DateTime.UtcNow)
            return BadRequest(new { mensagem = "Esse horário já passou." });

        // A agenda é cravada no horário de trabalho da loja: fora do expediente (ou num dia fechado) não se agenda,
        // mesmo que alguém monte o pedido na mão. Só vale o que a página oferece (grade do serviço dentro da janela).
        var janela = await JanelaDoDiaAsync(inicio.Date);
        if (janela is null)
            return BadRequest(new { mensagem = "Não atendemos nesse dia. Escolha outro dia." });
        var grade = GradeDoDia(CombinarDataHora(inicio.Date, janela.Value.Inicio), CombinarDataHora(inicio.Date, janela.Value.Fim), servico.DuracaoMinutos);
        if (!grade.Contains(inicio))
            return BadRequest(new { mensagem = "Esse horário está fora do nosso horário de atendimento. Escolha outro." });

        // Trava só quem tenta marcar na mesma empresa+dia — outras empresas e
        // outros dias seguem em paralelo sem esperar. A trava fica até o fim
        // da transação, então o segundo clique só entra depois que o primeiro
        // já confirmou (ou desistiu) desse horário.
        await using var transacao = await Context.Database.BeginTransactionAsync();
        await ConcorrenciaUtil.TravarChaveAsync(Context, $"agenda:{empresaId}:{inicio:yyyyMMdd}");

        // Casa pelo telefone normalizado (mesmos dígitos), evitando duplicar cliente.
        var candidatos = await Context.Clientes.AsNoTracking().Select(c => new { c.Id, c.Telefone }).ToListAsync();
        var idExistente = candidatos.FirstOrDefault(c => TelefoneUtil.Normalizar(c.Telefone) == telefoneNormalizado)?.Id;
        var cliente = idExistente is null ? null : await Context.Clientes.FirstAsync(c => c.Id == idExistente);

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
