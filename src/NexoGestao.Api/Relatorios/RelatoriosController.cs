using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Relatorios;

[ApiController]
[Route("api/empresas/{empresaId:int}/relatorios")]
[Authorize]
public class RelatoriosController : TenantControllerBase
{
    public RelatoriosController(AppDbContext context) : base(context) { }

    // Período sempre resolvido no backend (nunca confiando em datas prontas do
    // frontend) — "hoje"/"semana"/"mes" usam o relógio do servidor (UTC).
    private static (DateTime Inicio, DateTime Fim) ResolverPeriodo(string periodo, DateTime? inicio, DateTime? fim)
    {
        var hoje = DateTime.UtcNow.Date;

        if (periodo == "personalizado" && inicio is not null && fim is not null)
        {
            return (
                DateTime.SpecifyKind(inicio.Value.Date, DateTimeKind.Utc),
                DateTime.SpecifyKind(fim.Value.Date, DateTimeKind.Utc).AddDays(1).AddTicks(-1));
        }

        return periodo switch
        {
            "hoje" => (hoje, hoje.AddDays(1).AddTicks(-1)),
            "semana" => (hoje.AddDays(-6), hoje.AddDays(1).AddTicks(-1)),
            _ => (new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc), hoje.AddDays(1).AddTicks(-1)),
        };
    }

    [HttpGet("resumo")]
    public async Task<IActionResult> Resumo(int empresaId, [FromQuery] string periodo = "mes", [FromQuery] DateTime? inicio = null, [FromQuery] DateTime? fim = null)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Financeiro);
        if (empresaAutorizada is null)
            return Forbid();

        var (dataInicio, dataFim) = ResolverPeriodo(periodo, inicio, fim);

        var totalVendido = await Context.Vendas
            .Where(v => v.Data >= dataInicio && v.Data <= dataFim)
            .SumAsync(v => (decimal?)v.Total) ?? 0;

        var quantidadeVendas = await Context.Vendas
            .CountAsync(v => v.Data >= dataInicio && v.Data <= dataFim);

        var totalRecebido = await Context.Pagamentos
            .Where(p => p.Data >= dataInicio && p.Data <= dataFim)
            .SumAsync(p => (decimal?)p.Valor) ?? 0;

        // "Falta receber" é uma fotografia do momento (todo saldo em aberto),
        // não fica preso ao período — é o mesmo número que aparece em Cobranças.
        var faltaReceber = await Context.ContasReceber
            .Where(c => c.Status == StatusContaReceber.Pendente)
            .SumAsync(c => (decimal?)c.ValorPendente) ?? 0;

        var temMovimentacao = quantidadeVendas > 0 || totalRecebido > 0 || faltaReceber > 0;

        return Ok(new { totalVendido, quantidadeVendas, totalRecebido, faltaReceber, temMovimentacao });
    }

    [HttpGet("formas-pagamento")]
    public async Task<IActionResult> FormasPagamento(int empresaId, [FromQuery] string periodo = "mes", [FromQuery] DateTime? inicio = null, [FromQuery] DateTime? fim = null)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Financeiro);
        if (empresaAutorizada is null)
            return Forbid();

        var (dataInicio, dataFim) = ResolverPeriodo(periodo, inicio, fim);

        var grupos = await Context.Pagamentos
            .Where(p => p.Data >= dataInicio && p.Data <= dataFim)
            .GroupBy(p => p.FormaPagamento)
            .Select(g => new { Forma = g.Key, Valor = g.Sum(p => p.Valor), Quantidade = g.Count() })
            .ToListAsync();

        var totalRecebido = grupos.Sum(g => g.Valor);

        var resultado = grupos
            .Select(g => new
            {
                forma = g.Forma.ToString(),
                valor = g.Valor,
                quantidade = g.Quantidade,
                percentual = totalRecebido > 0 ? Math.Round(g.Valor / totalRecebido * 100, 1) : 0,
            })
            .OrderByDescending(g => g.valor)
            .ToList();

        return Ok(new { totalRecebido, formas = resultado });
    }

    [HttpGet("formas-pagamento/{forma}/pagamentos")]
    public async Task<IActionResult> PagamentosPorForma(int empresaId, string forma, [FromQuery] string periodo = "mes", [FromQuery] DateTime? inicio = null, [FromQuery] DateTime? fim = null)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Financeiro);
        if (empresaAutorizada is null)
            return Forbid();

        if (!Enum.TryParse<FormaPagamentoRecebido>(forma, ignoreCase: true, out var formaEnum))
            return BadRequest(new { mensagem = "Forma de pagamento inválida." });

        var (dataInicio, dataFim) = ResolverPeriodo(periodo, inicio, fim);

        var pagamentos = await Context.Pagamentos
            .Where(p => p.FormaPagamento == formaEnum && p.Data >= dataInicio && p.Data <= dataFim)
            .OrderByDescending(p => p.Data)
            .Select(p => new
            {
                p.Id,
                p.Valor,
                p.Data,
                p.VendaId,
                ClienteNome = p.Cliente != null ? p.Cliente.Nome : "Consumidor não identificado",
            })
            .ToListAsync();

        return Ok(pagamentos);
    }

    [HttpGet("vendas")]
    public async Task<IActionResult> RelatorioVendas(int empresaId, [FromQuery] string periodo = "mes", [FromQuery] DateTime? inicio = null, [FromQuery] DateTime? fim = null)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Financeiro);
        if (empresaAutorizada is null)
            return Forbid();

        var (dataInicio, dataFim) = ResolverPeriodo(periodo, inicio, fim);

        var vendas = await Context.Vendas
            .Where(v => v.Data >= dataInicio && v.Data <= dataFim)
            .Select(v => new { v.Id, v.Total, v.Data, v.SaldoDevedor })
            .ToListAsync();

        var totalVendido = vendas.Sum(v => v.Total);
        var quantidade = vendas.Count;
        var valorMedio = quantidade > 0 ? totalVendido / quantidade : 0;
        var vendasPendentes = vendas.Count(v => v.SaldoDevedor is > 0);
        var vendasPagas = quantidade - vendasPendentes;

        var produtosMaisVendidos = await Context.Vendas
            .Where(v => v.Data >= dataInicio && v.Data <= dataFim)
            .SelectMany(v => v.Itens)
            .GroupBy(i => new { i.ProdutoId, i.Produto.Nome })
            .Select(g => new
            {
                produtoNome = g.Key.Nome,
                quantidade = g.Sum(i => i.Quantidade),
                totalVendido = g.Sum(i => i.Quantidade * i.PrecoUnitario),
            })
            .OrderByDescending(g => g.quantidade)
            .Take(5)
            .ToListAsync();

        var serieDiaria = vendas
            .GroupBy(v => v.Data.Date)
            .Select(g => new { data = g.Key, valor = g.Sum(v => v.Total) })
            .OrderBy(g => g.data)
            .ToList();

        return Ok(new
        {
            totalVendido,
            quantidade,
            valorMedio,
            vendasPagas,
            vendasPendentes,
            produtosMaisVendidos,
            serieDiaria,
        });
    }

    [HttpGet("pagamentos")]
    public async Task<IActionResult> HistoricoPagamentos(int empresaId, [FromQuery] string periodo = "mes", [FromQuery] DateTime? inicio = null, [FromQuery] DateTime? fim = null, [FromQuery] string? forma = null)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Financeiro);
        if (empresaAutorizada is null)
            return Forbid();

        var (dataInicio, dataFim) = ResolverPeriodo(periodo, inicio, fim);

        var query = Context.Pagamentos.Where(p => p.Data >= dataInicio && p.Data <= dataFim);

        if (!string.IsNullOrWhiteSpace(forma))
        {
            if (!Enum.TryParse<FormaPagamentoRecebido>(forma, ignoreCase: true, out var formaEnum))
                return BadRequest(new { mensagem = "Forma de pagamento inválida." });
            query = query.Where(p => p.FormaPagamento == formaEnum);
        }

        var pagamentos = await query
            .OrderByDescending(p => p.Data)
            .Select(p => new
            {
                p.Id,
                p.Valor,
                p.Data,
                p.VendaId,
                p.FormaPagamento,
                ClienteNome = p.Cliente != null ? p.Cliente.Nome : "Consumidor não identificado",
            })
            .ToListAsync();

        return Ok(pagamentos);
    }
}
