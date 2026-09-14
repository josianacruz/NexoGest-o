using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record ConfirmarVagaRequest(int ServicoId, string NomeCliente, string Celular);

// Consumo público (sem login) do link exclusivo de uma vaga divulgada.
// Diferente do AgendamentoPublicoController: aqui data/hora já vêm travadas
// pelo token, o cliente só escolhe o serviço que cabe no tempo livre.
[ApiController]
[Route("api/publico/vagas/{token}")]
[EnableRateLimiting("publico")]
public class VagaPublicaController : ControllerBase
{
    private readonly AppDbContext Context;

    public VagaPublicaController(AppDbContext context)
    {
        Context = context;
    }

    private async Task<VagaDivulgada?> BuscarVagaAsync(string token)
    {
        var vaga = await Context.VagasDivulgadas.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Token == token);
        if (vaga is null)
            return null;

        Context.EmpresaAtualId = vaga.EmpresaId;
        return vaga;
    }

    private async Task<int> MinutosDisponiveisAsync(VagaDivulgada vaga)
    {
        // O horário de fechamento configurado não entra aqui: quem divulgou a vaga
        // já escolheu esse horário de propósito. Só o próximo agendamento do mesmo
        // dia limita — sem ele, assume uma janela generosa (cabe qualquer serviço).
        var proximoAgendamento = await Context.Agendamentos
            .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora > vaga.DataHora && a.DataHora.Date == vaga.DataHora.Date)
            .OrderBy(a => a.DataHora)
            .Select(a => a.DataHora)
            .FirstOrDefaultAsync();

        var limite = proximoAgendamento != default ? proximoAgendamento : vaga.DataHora.AddHours(6);
        var minutos = (int)(limite - vaga.DataHora).TotalMinutes;
        return Math.Max(0, minutos);
    }

    [HttpGet]
    public async Task<IActionResult> Obter(string token)
    {
        var vaga = await BuscarVagaAsync(token);
        if (vaga is null)
            return NotFound(new { mensagem = "Link inválido." });

        var empresa = await Context.Empresas.FirstOrDefaultAsync(e => e.Id == vaga.EmpresaId);

        if (vaga.Status != StatusVaga.Ativa)
        {
            return Ok(new
            {
                status = vaga.Status.ToString(),
                empresaId = vaga.EmpresaId,
                empresaNome = empresa?.Nome,
                mensagem = "Este horário já foi preenchido.",
            });
        }

        var minutosDisponiveis = await MinutosDisponiveisAsync(vaga);
        var servicos = await Context.Servicos
            .Where(s => s.Ativo && s.PermiteAutoagendamento && s.DuracaoMinutos <= minutosDisponiveis)
            .OrderBy(s => s.Nome)
            .Select(s => new { s.Id, s.Nome, s.DuracaoMinutos, s.Preco })
            .ToListAsync();

        return Ok(new
        {
            status = "Ativa",
            empresaId = vaga.EmpresaId,
            empresaNome = empresa?.Nome,
            dataHora = vaga.DataHora,
            minutosDisponiveis,
            servicos,
        });
    }

    [HttpPost("agendamento")]
    public async Task<IActionResult> Confirmar(string token, ConfirmarVagaRequest request)
    {
        var vaga = await BuscarVagaAsync(token);
        if (vaga is null)
            return NotFound(new { mensagem = "Link inválido." });

        if (vaga.Status != StatusVaga.Ativa)
            return Conflict(new { mensagem = "Este horário já foi preenchido." });

        if (string.IsNullOrWhiteSpace(request.NomeCliente))
            return BadRequest(new { mensagem = "Informe seu nome." });

        var telefoneNormalizado = TelefoneUtil.Normalizar(request.Celular);
        if (telefoneNormalizado is null)
            return BadRequest(new { mensagem = "Informe um celular válido." });

        // Trava por vaga: dois cliques (ou duas abas) confirmando o mesmo link
        // ao mesmo tempo nunca passam os dois pela checagem de status — o
        // segundo só entra depois que o primeiro já commitou "Preenchida".
        await using var transacao = await Context.Database.BeginTransactionAsync();
        await ConcorrenciaUtil.TravarChaveAsync(Context, $"vaga:{vaga.Id}");

        await Context.Entry(vaga).ReloadAsync();
        if (vaga.Status != StatusVaga.Ativa)
            return Conflict(new { mensagem = "Este horário já foi preenchido." });

        var minutosDisponiveis = await MinutosDisponiveisAsync(vaga);
        var servico = await Context.Servicos
            .FirstOrDefaultAsync(s => s.Id == request.ServicoId && s.Ativo && s.PermiteAutoagendamento);
        if (servico is null || servico.DuracaoMinutos > minutosDisponiveis)
            return BadRequest(new { mensagem = "Serviço não cabe no tempo disponível." });

        // Revalida: outro agendamento pode ter ocupado o intervalo entre o GET e o POST.
        var fimNovo = vaga.DataHora.AddMinutes(servico.DuracaoMinutos);
        var conflito = await Context.Agendamentos.AnyAsync(a =>
            a.Status != StatusAgendamento.Cancelado &&
            a.DataHora.Date == vaga.DataHora.Date &&
            a.DataHora < fimNovo &&
            vaga.DataHora < a.DataHora.AddMinutes(a.DuracaoMinutos));

        if (conflito || vaga.Status != StatusVaga.Ativa)
        {
            vaga.Status = StatusVaga.Expirada;
            await Context.SaveChangesAsync();
            await transacao.CommitAsync();
            return Conflict(new { mensagem = "Este horário já foi preenchido." });
        }

        var clientesDaEmpresa = await Context.Clientes.ToListAsync();
        var cliente = clientesDaEmpresa.FirstOrDefault(c => TelefoneUtil.Normalizar(c.Telefone) == telefoneNormalizado);
        if (cliente is null)
        {
            cliente = new Cliente
            {
                EmpresaId = vaga.EmpresaId,
                Nome = request.NomeCliente.Trim(),
                Telefone = request.Celular.Trim(),
            };
            Context.Clientes.Add(cliente);
            await Context.SaveChangesAsync();
        }

        var agendamento = new Agendamento
        {
            EmpresaId = vaga.EmpresaId,
            ClienteId = cliente.Id,
            ServicoId = servico.Id,
            ServicoNome = servico.Nome,
            DataHora = vaga.DataHora,
            DuracaoMinutos = servico.DuracaoMinutos,
            Valor = servico.Preco,
            Status = StatusAgendamento.Agendado,
            Origem = OrigemAgendamento.HorarioVago,
        };
        Context.Agendamentos.Add(agendamento);

        vaga.Status = StatusVaga.Preenchida;

        await Context.SaveChangesAsync();
        vaga.AgendamentoId = agendamento.Id;

        Context.Notificacoes.Add(new Notificacao
        {
            EmpresaId = vaga.EmpresaId,
            Titulo = "Horário divulgado foi preenchido",
            ClienteNome = cliente.Nome,
            ServicoNome = servico.Nome,
            DataHoraAgendamento = agendamento.DataHora,
            AgendamentoId = agendamento.Id,
        });

        await Context.SaveChangesAsync();
        await transacao.CommitAsync();

        return Ok(new { agendamento.Id, agendamento.DataHora, agendamento.ServicoNome });
    }
}
