using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record CriarAgendamentoRequest(
    int ClienteId,
    int? ServicoId,
    string ServicoNome,
    DateTime Data,
    string Hora,
    int DuracaoMinutos,
    decimal Valor,
    string? Observacao = null,
    bool ForcarComConflito = false);

public record AtualizarStatusRequest(string Status);

[ApiController]
[Route("api/empresas/{empresaId:int}/agendamentos")]
[Authorize]
public class AgendamentosController : TenantControllerBase
{
    public AgendamentosController(AppDbContext context) : base(context) { }

    private static DateTime CombinarDataHora(DateTime data, string hora)
    {
        var partes = hora.Split(':');
        var horas = int.Parse(partes[0]);
        var minutos = int.Parse(partes[1]);
        return DateTime.SpecifyKind(data.Date.AddHours(horas).AddMinutes(minutos), DateTimeKind.Utc);
    }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarAgendamentoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.ServicoNome))
            return BadRequest(new { mensagem = "Informe o serviço." });

        if (request.DuracaoMinutos <= 0)
            return BadRequest(new { mensagem = "A duração deve ser maior que zero." });

        var cliente = await Context.Clientes.FirstOrDefaultAsync(c => c.Id == request.ClienteId);
        if (cliente is null)
            return NotFound(new { mensagem = "Cliente não encontrado." });

        var inicio = CombinarDataHora(request.Data, request.Hora);
        var fim = inicio.AddMinutes(request.DuracaoMinutos);

        // Não bloqueia horário ocupado — só avisa. Compara só dentro do mesmo dia
        // (consulta segura pro EF traduzir) e calcula a sobreposição em memória.
        var doDia = await Context.Agendamentos
            .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora.Date == inicio.Date)
            .Select(a => new
            {
                a.Id,
                a.DataHora,
                a.DuracaoMinutos,
                a.ServicoNome,
                ClienteNome = a.Cliente.Nome,
            })
            .ToListAsync();

        var conflitos = doDia
            .Where(a => a.DataHora < fim && inicio < a.DataHora.AddMinutes(a.DuracaoMinutos))
            .Select(a => new { a.Id, a.DataHora, a.DuracaoMinutos, a.ServicoNome, a.ClienteNome })
            .ToList();

        if (conflitos.Count > 0 && !request.ForcarComConflito)
        {
            return Conflict(new
            {
                mensagem = "Já existe(m) agendamento(s) nesse horário.",
                conflitos,
            });
        }

        var agendamento = new Agendamento
        {
            EmpresaId = empresaAutorizada.Value,
            ClienteId = request.ClienteId,
            ServicoId = request.ServicoId,
            ServicoNome = request.ServicoNome,
            DataHora = inicio,
            DuracaoMinutos = request.DuracaoMinutos,
            Valor = request.Valor,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
        };
        Context.Agendamentos.Add(agendamento);
        await Context.SaveChangesAsync();

        return Ok(new
        {
            agendamento.Id,
            agendamento.DataHora,
            agendamento.DuracaoMinutos,
            agendamento.ServicoNome,
            agendamento.Valor,
            Status = agendamento.Status.ToString(),
            conflitosIgnorados = conflitos.Count,
        });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId, [FromQuery] DateTime? inicio, [FromQuery] DateTime? fim)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var de = DateTime.SpecifyKind((inicio ?? DateTime.UtcNow.Date).Date, DateTimeKind.Utc);
        var ate = DateTime.SpecifyKind((fim ?? de).Date.AddDays(1), DateTimeKind.Utc);

        var agendamentos = await Context.Agendamentos
            .Where(a => a.DataHora >= de && a.DataHora < ate)
            .OrderBy(a => a.DataHora)
            .Select(a => new
            {
                a.Id,
                a.ClienteId,
                ClienteNome = a.Cliente.Nome,
                ClienteTelefone = a.Cliente.Telefone,
                a.ServicoId,
                a.ServicoNome,
                a.DataHora,
                a.DuracaoMinutos,
                a.Valor,
                a.Observacao,
                Status = a.Status.ToString(),
            })
            .ToListAsync();

        return Ok(agendamentos);
    }

    [HttpGet("resumo")]
    public async Task<IActionResult> Resumo(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var agora = DateTime.UtcNow;
        var hoje = agora.Date;
        var amanha = hoje.AddDays(1);

        var deHoje = await Context.Agendamentos
            .Where(a => a.DataHora >= hoje && a.DataHora < amanha && a.Status != StatusAgendamento.Cancelado)
            .OrderBy(a => a.DataHora)
            .Select(a => new
            {
                a.Id,
                a.DataHora,
                a.ServicoNome,
                ClienteNome = a.Cliente.Nome,
                Status = a.Status.ToString(),
            })
            .ToListAsync();

        var proximoAtendimento = deHoje.FirstOrDefault(a => a.DataHora >= agora);
        var naoConfirmados = deHoje.Count(a => a.Status == StatusAgendamento.Agendado.ToString());

        return Ok(new
        {
            totalHoje = deHoje.Count,
            naoConfirmados,
            proximoAtendimento,
        });
    }

    [HttpPut("{agendamentoId:int}/status")]
    public async Task<IActionResult> AtualizarStatus(int empresaId, int agendamentoId, AtualizarStatusRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        if (!Enum.TryParse<StatusAgendamento>(request.Status, ignoreCase: true, out var status))
            return BadRequest(new { mensagem = "Status inválido." });

        var agendamento = await Context.Agendamentos.FirstOrDefaultAsync(a => a.Id == agendamentoId);
        if (agendamento is null)
            return NotFound(new { mensagem = "Agendamento não encontrado." });

        agendamento.Status = status;
        await Context.SaveChangesAsync();

        return Ok(new { agendamento.Id, Status = agendamento.Status.ToString() });
    }
}
