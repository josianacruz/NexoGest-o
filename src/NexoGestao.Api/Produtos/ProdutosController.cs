using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Produtos;

public record CriarProdutoRequest(string Nome, string? Categoria, decimal Preco, decimal Custo, int Estoque, int EstoqueMinimo, string? FotoUrl = null);
public record AtualizarProdutoRequest(string Nome, string? Categoria, decimal Preco, decimal Custo, int Estoque, int EstoqueMinimo, string? FotoUrl = null);
public record AtivarLinkStoryRequest(bool Ativo);

[ApiController]
[Route("api/empresas/{empresaId:int}/produtos")]
[Authorize]
public class ProdutosController : TenantControllerBase
{
    public ProdutosController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarProdutoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Produtos);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do produto é obrigatório." });

        if (request.Preco < 0 || request.Custo < 0)
            return BadRequest(new { mensagem = "Preço e custo não podem ser negativos." });

        if (request.Estoque < 0 || request.EstoqueMinimo < 0)
            return BadRequest(new { mensagem = "Estoque e estoque mínimo não podem ser negativos." });

        var produto = new Produto
        {
            EmpresaId = empresaAutorizada.Value,
            Nome = request.Nome,
            Categoria = request.Categoria,
            Preco = request.Preco,
            Custo = request.Custo,
            Estoque = request.Estoque,
            EstoqueMinimo = request.EstoqueMinimo,
            FotoUrl = request.FotoUrl,
        };
        Context.Produtos.Add(produto);
        await Context.SaveChangesAsync();

        return Ok(new { produto.Id, produto.Nome });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Produtos);
        if (empresaAutorizada is null)
            return Forbid();

        var produtos = await Context.Produtos
            .OrderBy(p => p.Nome)
            .Select(p => new
            {
                p.Id, p.Nome, p.Categoria, p.Preco, p.Custo, p.Estoque, p.EstoqueMinimo, p.Ativo,
                p.FotoUrl, p.LinkStoryToken, p.LinkStoryAtivo,
            })
            .ToListAsync();

        return Ok(produtos);
    }

    [HttpPut("{produtoId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, int produtoId, AtualizarProdutoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Produtos);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do produto é obrigatório." });

        if (request.Preco < 0 || request.Custo < 0)
            return BadRequest(new { mensagem = "Preço e custo não podem ser negativos." });

        if (request.Estoque < 0 || request.EstoqueMinimo < 0)
            return BadRequest(new { mensagem = "Estoque e estoque mínimo não podem ser negativos." });

        var produto = await Context.Produtos.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        produto.Nome = request.Nome;
        produto.Categoria = request.Categoria;
        produto.Preco = request.Preco;
        produto.Custo = request.Custo;
        produto.Estoque = request.Estoque;
        produto.EstoqueMinimo = request.EstoqueMinimo;
        produto.FotoUrl = request.FotoUrl;

        await Context.SaveChangesAsync();

        return Ok(new { produto.Id, produto.Nome, produto.Estoque });
    }

    // Gera (ou reaproveita) o token opaco do link público da Story — o produtoId
    // nunca é exposto, só esse token aleatório de 192 bits.
    [HttpPost("{produtoId:int}/link-story")]
    public async Task<IActionResult> GerarLinkStory(int empresaId, int produtoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Produtos);
        if (empresaAutorizada is null)
            return Forbid();

        var produto = await Context.Produtos.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        if (produto.LinkStoryToken is null)
            produto.LinkStoryToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        produto.LinkStoryAtivo = true;

        await Context.SaveChangesAsync();

        return Ok(new { produto.LinkStoryToken, produto.LinkStoryAtivo });
    }

    [HttpPut("{produtoId:int}/link-story")]
    public async Task<IActionResult> AtualizarLinkStory(int empresaId, int produtoId, AtivarLinkStoryRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Produtos);
        if (empresaAutorizada is null)
            return Forbid();

        var produto = await Context.Produtos.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        produto.LinkStoryAtivo = request.Ativo;
        await Context.SaveChangesAsync();

        return Ok(new { produto.LinkStoryToken, produto.LinkStoryAtivo });
    }
}
