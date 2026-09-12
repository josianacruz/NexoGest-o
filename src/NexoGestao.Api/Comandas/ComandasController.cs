using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Comandas;

public record AbrirComandaRequest(int Numero);
public record AdicionarItemRequest(int ProdutoId, int Quantidade);
public record FecharComandaRequest(string FormaPagamento);

[ApiController]
[Route("api/empresas/{empresaId:int}/comandas")]
[Authorize]
public class ComandasController : TenantControllerBase
{
    public ComandasController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Abrir(int empresaId, AbrirComandaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.Numero <= 0)
            return BadRequest(new { mensagem = "O número da comanda deve ser maior que zero." });

        var jaAberta = await Context.Comandas
            .AnyAsync(c => c.Numero == request.Numero && c.Status == StatusComanda.Aberta);
        if (jaAberta)
            return BadRequest(new { mensagem = "Já existe uma comanda aberta com esse número." });

        var comanda = new Comanda
        {
            EmpresaId = empresaAutorizada.Value,
            Numero = request.Numero,
        };
        Context.Comandas.Add(comanda);
        await Context.SaveChangesAsync();

        return Ok(new { comanda.Id, comanda.Numero, comanda.Status });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var comandas = await Context.Comandas
            .Where(c => c.Status == StatusComanda.Aberta)
            .OrderBy(c => c.Numero)
            .Select(c => new
            {
                c.Id,
                c.Numero,
                Itens = c.Itens.Select(i => new { i.ProdutoId, i.Produto.Nome, i.Quantidade, i.Produto.Preco })
            })
            .ToListAsync();

        return Ok(comandas);
    }

    [HttpPost("{comandaId:int}/itens")]
    public async Task<IActionResult> AdicionarItem(int empresaId, int comandaId, AdicionarItemRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.Quantidade <= 0)
            return BadRequest(new { mensagem = "A quantidade deve ser maior que zero." });

        var comanda = await Context.Comandas.FirstOrDefaultAsync(c => c.Id == comandaId);
        if (comanda is null || comanda.Status != StatusComanda.Aberta)
            return NotFound(new { mensagem = "Comanda não encontrada ou já fechada." });

        var produto = await Context.Produtos.FirstOrDefaultAsync(p => p.Id == request.ProdutoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        var item = new ItemComanda
        {
            ComandaId = comanda.Id,
            ProdutoId = produto.Id,
            Quantidade = request.Quantidade
        };
        Context.ItensComanda.Add(item);
        await Context.SaveChangesAsync();

        return Ok(new { item.Id, item.ProdutoId, produto.Nome, item.Quantidade });
    }

    [HttpPost("{comandaId:int}/fechar")]
    public async Task<IActionResult> Fechar(int empresaId, int comandaId, FecharComandaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var comanda = await Context.Comandas
            .Include(c => c.Itens)
            .ThenInclude(i => i.Produto)
            .FirstOrDefaultAsync(c => c.Id == comandaId);

        if (comanda is null || comanda.Status != StatusComanda.Aberta)
            return NotFound(new { mensagem = "Comanda não encontrada ou já fechada." });

        if (comanda.Itens.Count == 0)
            return BadRequest(new { mensagem = "A comanda precisa ter pelo menos um item para ser fechada." });

        if (string.IsNullOrWhiteSpace(request.FormaPagamento))
            return BadRequest(new { mensagem = "Informe a forma de pagamento." });

        var itemSemEstoque = comanda.Itens.FirstOrDefault(i => i.Produto.Estoque < i.Quantidade);
        if (itemSemEstoque is not null)
            return BadRequest(new { mensagem = $"Estoque insuficiente de {itemSemEstoque.Produto.Nome}." });

        var venda = new Venda
        {
            EmpresaId = empresaAutorizada.Value,
            FormaPagamento = request.FormaPagamento,
        };

        decimal total = 0;
        foreach (var item in comanda.Itens)
        {
            venda.Itens.Add(new ItemVenda
            {
                ProdutoId = item.ProdutoId,
                Quantidade = item.Quantidade,
                PrecoUnitario = item.Produto.Preco,
            });
            total += item.Produto.Preco * item.Quantidade;
            item.Produto.Estoque -= item.Quantidade;
        }
        venda.Total = total;

        Context.Vendas.Add(venda);
        comanda.Venda = venda;
        comanda.Status = StatusComanda.Fechada;

        await Context.SaveChangesAsync();

        return Ok(new { venda.Id, venda.Total, comanda.Status });
    }
}