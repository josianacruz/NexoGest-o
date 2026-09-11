using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Produtos;

public record CriarProdutoRequest(string Nome, string? Categoria, decimal Preco, decimal Custo, int Estoque, int EstoqueMinimo);

[ApiController]
[Route("api/empresas/{empresaId:int}/produtos")]
[Authorize]
public class ProdutosController : TenantControllerBase
{
    public ProdutosController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarProdutoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var produto = new Produto
        {
            EmpresaId = empresaAutorizada.Value,
            Nome = request.Nome,
            Categoria = request.Categoria,
            Preco = request.Preco,
            Custo = request.Custo,
            Estoque = request.Estoque,
            EstoqueMinimo = request.EstoqueMinimo
        };
        Context.Produtos.Add(produto);
        await Context.SaveChangesAsync();

        return Ok(new { produto.Id, produto.Nome });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var produtos = await Context.Produtos
            .OrderBy(p => p.Nome)
            .Select(p => new { p.Id, p.Nome, p.Categoria, p.Preco, p.Estoque, p.Ativo })
            .ToListAsync();

        return Ok(produtos);
    }
}
