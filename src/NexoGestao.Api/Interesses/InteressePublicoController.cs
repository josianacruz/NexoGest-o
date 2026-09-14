using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Interesses;

public record CriarInteresseRequest(string NomeCliente, string Celular);

// Consumo público (sem login) da Story: o produto nunca é identificado pelo
// Id, só pelo token opaco gerado em ProdutosController.GerarLinkStory.
[ApiController]
[Route("api/publico/interesses/{token}")]
[EnableRateLimiting("publico")]
public class InteressePublicoController : ControllerBase
{
    private readonly AppDbContext Context;

    public InteressePublicoController(AppDbContext context)
    {
        Context = context;
    }

    private async Task<Produto?> BuscarProdutoAsync(string token)
    {
        var produto = await Context.Produtos.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.LinkStoryToken == token);
        if (produto is null)
            return null;

        Context.EmpresaAtualId = produto.EmpresaId;
        return produto;
    }

    [HttpGet]
    public async Task<IActionResult> Obter(string token)
    {
        var produto = await BuscarProdutoAsync(token);
        if (produto is null)
            return NotFound(new { mensagem = "Link inválido." });

        var empresa = await Context.Empresas.FirstOrDefaultAsync(e => e.Id == produto.EmpresaId);
        var disponivel = produto.Ativo && produto.LinkStoryAtivo && produto.Estoque > 0;

        return Ok(new
        {
            disponivel,
            mensagem = disponivel ? null : "Essa peça não está mais disponível.",
            empresaNome = empresa?.Nome,
            produtoNome = produto.Nome,
            preco = produto.Preco,
            fotoUrl = produto.FotoUrl,
        });
    }

    [HttpPost]
    public async Task<IActionResult> Criar(string token, CriarInteresseRequest request)
    {
        var produto = await BuscarProdutoAsync(token);
        if (produto is null)
            return NotFound(new { mensagem = "Link inválido." });

        if (!produto.Ativo || !produto.LinkStoryAtivo || produto.Estoque <= 0)
            return Conflict(new { mensagem = "Essa peça não está mais disponível." });

        if (string.IsNullOrWhiteSpace(request.NomeCliente))
            return BadRequest(new { mensagem = "Informe seu nome." });

        var telefoneNormalizado = TelefoneUtil.Normalizar(request.Celular);
        if (telefoneNormalizado is null)
            return BadRequest(new { mensagem = "Informe um celular válido." });

        var clientesDaEmpresa = await Context.Clientes.ToListAsync();
        var cliente = clientesDaEmpresa.FirstOrDefault(c => TelefoneUtil.Normalizar(c.Telefone) == telefoneNormalizado);
        if (cliente is null)
        {
            cliente = new Cliente
            {
                EmpresaId = produto.EmpresaId,
                Nome = request.NomeCliente.Trim(),
                Telefone = request.Celular.Trim(),
            };
            Context.Clientes.Add(cliente);
            await Context.SaveChangesAsync();
        }

        // Clique duplicado / retry de rede pro mesmo produto+cliente: devolve o
        // interesse já criado em vez de registrar outro igual.
        var jaExistente = await Context.Interesses.FirstOrDefaultAsync(i =>
            i.ProdutoId == produto.Id &&
            i.ClienteId == cliente.Id &&
            i.DataCriacao > DateTime.UtcNow.AddMinutes(-1));
        if (jaExistente is not null)
        {
            return Ok(new { jaExistente.Id, mensagem = "Interesse registrado! A loja pode demorar um pouco para responder." });
        }

        var interesse = new Interesse
        {
            EmpresaId = produto.EmpresaId,
            ProdutoId = produto.Id,
            ProdutoNome = produto.Nome,
            ProdutoPreco = produto.Preco,
            ClienteId = cliente.Id,
            Status = StatusInteresse.Novo,
        };
        Context.Interesses.Add(interesse);
        await Context.SaveChangesAsync();

        return Ok(new { interesse.Id, mensagem = "Interesse registrado! A loja pode demorar um pouco para responder." });
    }
}
