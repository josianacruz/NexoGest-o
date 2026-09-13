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

public record AtualizarStatusRequest(
    string Status,
    decimal? ValorRecebido = null,
    string? FormaPagamento = null);

public record ReagendarRequest(DateTime Data, string Hora, bool ForcarComConflito = false);

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

    // Não bloqueia horário ocupado — só avisa. Compara só dentro do mesmo dia
    // (consulta segura pro EF traduzir) e calcula a sobreposição em memória.
    // `ignorarAgendamentoId` serve pro reagendamento não se contar como conflito consigo mesmo.
    private async Task<List<object>> BuscarConflitosAsync(DateTime inicio, int duracaoMinutos, int? ignorarAgendamentoId = null)
    {
        var fim = inicio.AddMinutes(duracaoMinutos);

        var doDia = await Context.Agendamentos
            .Where(a => a.Status != StatusAgendamento.Cancelado && a.DataHora.Date == inicio.Date)
            .Where(a => ignorarAgendamentoId == null || a.Id != ignorarAgendamentoId)
            .Select(a => new
            {
                a.Id,
                a.DataHora,
                a.DuracaoMinutos,
                a.ServicoNome,
                ClienteNome = a.Cliente.Nome,
            })
            .ToListAsync();

        return doDia
            .Where(a => a.DataHora < fim && inicio < a.DataHora.AddMinutes(a.DuracaoMinutos))
            .Select(a => (object)new { a.Id, a.DataHora, a.DuracaoMinutos, a.ServicoNome, a.ClienteNome })
            .ToList();
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
        var conflitos = await BuscarConflitosAsync(inicio, request.DuracaoMinutos);

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
                a.ClienteId,
                ClienteNome = a.Cliente.Nome,
                ClienteTelefone = a.Cliente.Telefone,
                a.ServicoNome,
                a.DataHora,
                a.DuracaoMinutos,
                a.Valor,
                Status = a.Status.ToString(),
                Chegou = a.HoraChegada != null,
            })
            .ToListAsync();

        var proximoAtendimento = deHoje.FirstOrDefault(a => a.DataHora >= agora);
        var naoConfirmados = deHoje.Count(a => a.Status == StatusAgendamento.Agendado.ToString());

        // Cobranças em aberto (de cancelamento fora do prazo ou saldo de
        // atendimento) só dos clientes que têm agendamento hoje.
        var clienteIdsHoje = await Context.Agendamentos
            .Where(a => a.DataHora >= hoje && a.DataHora < amanha)
            .Select(a => a.ClienteId)
            .Distinct()
            .ToListAsync();

        var cobrancasPendentes = await Context.CobrancasAgendamento
            .Where(c => c.Status == StatusCobrancaAgendamento.Pendente && clienteIdsHoje.Contains(c.ClienteId))
            .Select(c => new { c.Id, c.ClienteId, ClienteNome = c.Cliente.Nome, c.Valor, c.Motivo })
            .ToListAsync();

        return Ok(new
        {
            totalHoje = deHoje.Count,
            naoConfirmados,
            proximoAtendimento,
            cobrancasPendentes,
            agendamentosHoje = deHoje,
        });
    }

    [HttpPut("{agendamentoId:int}/chegou")]
    public async Task<IActionResult> MarcarChegada(int empresaId, int agendamentoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var agendamento = await Context.Agendamentos.FirstOrDefaultAsync(a => a.Id == agendamentoId);
        if (agendamento is null)
            return NotFound(new { mensagem = "Agendamento não encontrado." });

        agendamento.HoraChegada = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return Ok(new { agendamento.Id, agendamento.HoraChegada });
    }

    [HttpPut("{agendamentoId:int}/reagendar")]
    public async Task<IActionResult> Reagendar(int empresaId, int agendamentoId, ReagendarRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var agendamento = await Context.Agendamentos.FirstOrDefaultAsync(a => a.Id == agendamentoId);
        if (agendamento is null)
            return NotFound(new { mensagem = "Agendamento não encontrado." });

        if (agendamento.Status is StatusAgendamento.Concluido or StatusAgendamento.Cancelado or StatusAgendamento.Faltou)
            return BadRequest(new { mensagem = "Esse agendamento não pode mais ser reagendado." });

        var novoInicio = CombinarDataHora(request.Data, request.Hora);
        var conflitos = await BuscarConflitosAsync(novoInicio, agendamento.DuracaoMinutos, agendamentoId);

        if (conflitos.Count > 0 && !request.ForcarComConflito)
        {
            return Conflict(new { mensagem = "Já existe(m) agendamento(s) nesse horário.", conflitos });
        }

        agendamento.DataHora = novoInicio;
        agendamento.HoraChegada = null;
        await Context.SaveChangesAsync();

        return Ok(new { agendamento.Id, agendamento.DataHora, conflitosIgnorados = conflitos.Count });
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

        object? avisoCobranca = null;

        if (status == StatusAgendamento.Cancelado)
        {
            var config = await Context.ConfiguracoesAgenda.FirstOrDefaultAsync(c => c.EmpresaId == empresaId);
            var horasMinimas = config?.HorasMinimasCancelamento ?? 24;
            var cobraForaDoPrazo = config?.CobrarCancelamentoForaPrazo ?? false;

            var horasAteAgendamento = (agendamento.DataHora - DateTime.UtcNow).TotalHours;
            var foraDoPrazo = horasAteAgendamento < horasMinimas;

            if (foraDoPrazo && cobraForaDoPrazo && agendamento.Valor > 0)
            {
                var cobranca = new CobrancaAgendamento
                {
                    EmpresaId = empresaId,
                    AgendamentoId = agendamento.Id,
                    ClienteId = agendamento.ClienteId,
                    Valor = agendamento.Valor,
                    Motivo = "Cancelamento fora do prazo",
                };
                Context.CobrancasAgendamento.Add(cobranca);
                avisoCobranca = new
                {
                    mensagem = $"Cancelamento fora do prazo ({horasMinimas}h de antecedência exigidas) — cobrança de R$ {agendamento.Valor:F2} gerada.",
                    valor = agendamento.Valor,
                };
            }
        }
        else if (status == StatusAgendamento.Concluido)
        {
            var valorRecebido = request.ValorRecebido ?? agendamento.Valor;
            if (valorRecebido < 0 || valorRecebido > agendamento.Valor)
                return BadRequest(new { mensagem = "Valor recebido inválido." });

            agendamento.ValorRecebido = valorRecebido;
            agendamento.FormaPagamento = string.IsNullOrWhiteSpace(request.FormaPagamento) ? null : request.FormaPagamento;

            var saldo = agendamento.Valor - valorRecebido;
            if (saldo > 0)
            {
                var cobranca = new CobrancaAgendamento
                {
                    EmpresaId = empresaId,
                    AgendamentoId = agendamento.Id,
                    ClienteId = agendamento.ClienteId,
                    Valor = saldo,
                    Motivo = "Saldo do atendimento",
                };
                Context.CobrancasAgendamento.Add(cobranca);
                avisoCobranca = new
                {
                    mensagem = $"Ficou faltando R$ {saldo:F2} — cobrança gerada.",
                    valor = saldo,
                };
            }
        }

        agendamento.Status = status;
        await Context.SaveChangesAsync();

        return Ok(new { agendamento.Id, Status = agendamento.Status.ToString(), avisoCobranca });
    }

    [HttpGet("cobrancas")]
    public async Task<IActionResult> ListarCobrancas(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var cobrancas = await Context.CobrancasAgendamento
            .OrderByDescending(c => c.DataCriacao)
            .Select(c => new
            {
                c.Id,
                c.AgendamentoId,
                ClienteNome = c.Cliente.Nome,
                c.Valor,
                c.Motivo,
                Status = c.Status.ToString(),
                c.DataCriacao,
                c.DataPagamento,
            })
            .ToListAsync();

        return Ok(cobrancas);
    }

    [HttpPut("cobrancas/{cobrancaId:int}/pagar")]
    public async Task<IActionResult> PagarCobranca(int empresaId, int cobrancaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var cobranca = await Context.CobrancasAgendamento.FirstOrDefaultAsync(c => c.Id == cobrancaId);
        if (cobranca is null)
            return NotFound(new { mensagem = "Cobrança não encontrada." });

        cobranca.Status = StatusCobrancaAgendamento.Paga;
        cobranca.DataPagamento = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return Ok(new { cobranca.Id, Status = cobranca.Status.ToString() });
    }
}
