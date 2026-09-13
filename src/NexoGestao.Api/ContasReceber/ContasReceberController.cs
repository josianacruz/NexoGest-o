using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.ContasReceber;

// Pagamento parcial já é aceito aqui (Valor nulo = quita o restante) — a tela
// hoje só oferece "pagar tudo", mas o backend já está pronto para parcial.
public record RegistrarPagamentoContaRequest(decimal? Valor = null);

[ApiController]
[Route("api/empresas/{empresaId:int}/contas-receber")]
[Authorize]
public class ContasReceberController : TenantControllerBase
{
    public ContasReceberController(AppDbContext context) : base(context) { }

    // Vencido não é gravado no banco — é calculado na hora a partir da data de
    // vencimento, então nunca fica desatualizado e uma conta paga nunca aparece vencida.
    private static string CalcularStatus(StatusContaReceber status, DateTime dataVencimento, DateTime hoje)
    {
        if (status == StatusContaReceber.Pago) return "PAGO";
        return dataVencimento.Date < hoje ? "VENCIDO" : "PENDENTE";
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId, [FromQuery] string? filtro)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Cobrancas);
        if (empresaAutorizada is null)
            return Forbid();

        var hoje = DateTime.UtcNow.Date;

        var contas = await Context.ContasReceber
            .OrderBy(c => c.DataVencimento)
            .Select(c => new
            {
                c.Id,
                c.ClienteId,
                ClienteNome = c.Cliente.Nome,
                ClienteTelefone = c.Cliente.Telefone,
                c.VendaId,
                c.ValorOriginal,
                c.ValorPendente,
                c.DataCriacao,
                c.DataVencimento,
                c.DataPagamento,
                c.Status,
            })
            .ToListAsync();

        var comStatus = contas.Select(c => new
        {
            c.Id,
            c.ClienteId,
            c.ClienteNome,
            c.ClienteTelefone,
            c.VendaId,
            c.ValorOriginal,
            c.ValorPendente,
            c.DataCriacao,
            c.DataVencimento,
            c.DataPagamento,
            Status = CalcularStatus(c.Status, c.DataVencimento, hoje),
        });

        var filtradas = filtro switch
        {
            "pendentes" => comStatus.Where(c => c.Status == "PENDENTE"),
            "vencendo-hoje" => comStatus.Where(c => c.Status == "PENDENTE" && c.DataVencimento.Date == hoje),
            "vencidos" => comStatus.Where(c => c.Status == "VENCIDO"),
            "pagos" => comStatus.Where(c => c.Status == "PAGO"),
            _ => comStatus,
        };

        return Ok(filtradas.ToList());
    }

    [HttpGet("resumo")]
    public async Task<IActionResult> Resumo(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Cobrancas);
        if (empresaAutorizada is null)
            return Forbid();

        var hoje = DateTime.UtcNow.Date;

        var abertas = await Context.ContasReceber
            .Where(c => c.Status == StatusContaReceber.Pendente)
            .Select(c => new { c.ValorPendente, c.DataVencimento })
            .ToListAsync();

        var aReceber = abertas.Sum(c => c.ValorPendente);
        var venceHoje = abertas.Where(c => c.DataVencimento.Date == hoje).Sum(c => c.ValorPendente);
        var vencidas = abertas.Where(c => c.DataVencimento.Date < hoje).Sum(c => c.ValorPendente);
        var quantidadeVencidas = abertas.Count(c => c.DataVencimento.Date < hoje);

        return Ok(new { aReceber, venceHoje, vencidas, quantidadeVencidas });
    }

    [HttpPost("{contaId:int}/pagamento")]
    public async Task<IActionResult> RegistrarPagamento(int empresaId, int contaId, RegistrarPagamentoContaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Cobrancas);
        if (empresaAutorizada is null)
            return Forbid();

        var conta = await Context.ContasReceber.FirstOrDefaultAsync(c => c.Id == contaId);
        if (conta is null || conta.Status == StatusContaReceber.Pago)
            return NotFound(new { mensagem = "Conta não encontrada ou já paga." });

        var valor = request.Valor ?? conta.ValorPendente;
        if (valor <= 0 || valor > conta.ValorPendente)
            return BadRequest(new { mensagem = "Valor de pagamento inválido." });

        conta.ValorPendente -= valor;

        var venda = await Context.Vendas.FirstOrDefaultAsync(v => v.Id == conta.VendaId);
        if (venda is not null)
        {
            venda.ValorRecebido = (venda.ValorRecebido ?? 0) + valor;
            venda.SaldoDevedor = conta.ValorPendente > 0 ? conta.ValorPendente : null;
        }

        if (conta.ValorPendente <= 0)
        {
            conta.ValorPendente = 0;
            conta.Status = StatusContaReceber.Pago;
            conta.DataPagamento = DateTime.UtcNow;
        }

        await Context.SaveChangesAsync();

        return Ok(new { conta.Id, conta.ValorPendente, conta.Status, conta.DataPagamento });
    }
}
