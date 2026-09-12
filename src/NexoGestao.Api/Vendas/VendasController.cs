using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Vendas;

public record ItemVendaRequest(int ProdutoId, int Quantidade);
public record CriarVendaRequest(int? ClienteId, string FormaPagamento, List<ItemVendaRequest> Itens);

[ApiController]
[Route("api/empresas/{empresaId:int}/vendas")]
[Authorize]
public class VendasController : TenantControllerBase
{
    public VendasController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarVendaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.Itens is null || request.Itens.Count == 0)
            return BadRequest(new { mensagem = "A venda precisa ter pelo menos um item." });

        var produtoIds = request.Itens.Select(i => i.ProdutoId).ToList();
        var produtos = await Context.Produtos
            .Where(p => produtoIds.Contains(p.Id))
            .ToListAsync();

        if (produtos.Count != produtoIds.Distinct().Count())
            return BadRequest(new { mensagem = "Um ou mais produtos não foram encontrados nessa empresa." });

        var venda = new Venda
        {
            EmpresaId = empresaAutorizada.Value,
            ClienteId = request.ClienteId,
            FormaPagamento = request.FormaPagamento,
        };

        decimal total = 0;
        foreach (var itemReq in request.Itens)
        {
            var produto = produtos.First(p => p.Id == itemReq.ProdutoId);

            // O preço nunca vem do frontend — sempre o preço atual do produto no banco
            var item = new ItemVenda
            {
                ProdutoId = produto.Id,
                Quantidade = itemReq.Quantidade,
                PrecoUnitario = produto.Preco,
            };
            venda.Itens.Add(item);
            total += produto.Preco * itemReq.Quantidade;

            // Baixa de estoque
            produto.Estoque -= itemReq.Quantidade;
        }
        venda.Total = total;

        Context.Vendas.Add(venda);
        await Context.SaveChangesAsync();

        return Ok(new { venda.Id, venda.Total, venda.Data });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var vendas = await Context.Vendas
            .OrderByDescending(v => v.Data)
            .Select(v => new
            {
                v.Id,
                v.Total,
                v.FormaPagamento,
                v.Data,
                ClienteNome = v.Cliente != null ? v.Cliente.Nome : null,
                Itens = v.Itens.Select(i => new { i.ProdutoId, i.Quantidade, i.PrecoUnitario })
            })
            .ToListAsync();

        return Ok(vendas);
    }
}
