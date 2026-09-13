using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;
using NexoGestao.Api.Vendas;

namespace NexoGestao.Api.Interesses;

public record ConverterInteresseRequest(
    string FormaPagamento,
    decimal? ValorRecebido = null,
    int? Parcelas = null,
    DateTime? DataVencimento = null);

[ApiController]
[Route("api/empresas/{empresaId:int}/interesses")]
[Authorize]
public class InteressesController : TenantControllerBase
{
    public InteressesController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId, [FromQuery] string? status)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Interesses);
        if (empresaAutorizada is null)
            return Forbid();

        var query = Context.Interesses.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<StatusInteresse>(status, ignoreCase: true, out var statusFiltro))
                return BadRequest(new { mensagem = "Status inválido." });
            query = query.Where(i => i.Status == statusFiltro);
        }

        var interesses = await query
            .OrderByDescending(i => i.DataCriacao)
            .Select(i => new
            {
                i.Id,
                i.ClienteId,
                ClienteNome = i.Cliente.Nome,
                ClienteTelefone = i.Cliente.Telefone,
                i.ProdutoId,
                i.ProdutoNome,
                i.ProdutoPreco,
                Status = i.Status.ToString(),
                i.VendaId,
                i.DataCriacao,
            })
            .ToListAsync();

        return Ok(interesses);
    }

    [HttpPut("{interesseId:int}/reservar")]
    public async Task<IActionResult> Reservar(int empresaId, int interesseId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Interesses);
        if (empresaAutorizada is null)
            return Forbid();

        var interesse = await Context.Interesses.FirstOrDefaultAsync(i => i.Id == interesseId);
        if (interesse is null)
            return NotFound(new { mensagem = "Interesse não encontrado." });

        if (interesse.Status != StatusInteresse.Novo)
            return BadRequest(new { mensagem = "Só é possível reservar um interesse novo." });

        interesse.Status = StatusInteresse.Reservado;
        await Context.SaveChangesAsync();

        return Ok(new { interesse.Id, Status = interesse.Status.ToString() });
    }

    [HttpPut("{interesseId:int}/perdido")]
    public async Task<IActionResult> MarcarPerdido(int empresaId, int interesseId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Interesses);
        if (empresaAutorizada is null)
            return Forbid();

        var interesse = await Context.Interesses.FirstOrDefaultAsync(i => i.Id == interesseId);
        if (interesse is null)
            return NotFound(new { mensagem = "Interesse não encontrado." });

        if (interesse.Status == StatusInteresse.Convertido)
            return BadRequest(new { mensagem = "Esse interesse já foi convertido em venda." });

        interesse.Status = StatusInteresse.Perdido;
        await Context.SaveChangesAsync();

        return Ok(new { interesse.Id, Status = interesse.Status.ToString() });
    }

    // Reaproveita inteiramente o VendasController.Criar já existente (mesma
    // validação, baixa de estoque e geração de ContaReceber/Cobrança) — só
    // monta o pedido a partir do produto/cliente do interesse.
    [HttpPost("{interesseId:int}/converter")]
    public async Task<IActionResult> Converter(int empresaId, int interesseId, ConverterInteresseRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Interesses);
        if (empresaAutorizada is null)
            return Forbid();

        var interesse = await Context.Interesses.FirstOrDefaultAsync(i => i.Id == interesseId);
        if (interesse is null)
            return NotFound(new { mensagem = "Interesse não encontrado." });

        if (interesse.Status is StatusInteresse.Convertido or StatusInteresse.Perdido)
            return BadRequest(new { mensagem = "Esse interesse não pode mais ser convertido." });

        var produto = await Context.Produtos.FirstOrDefaultAsync(p => p.Id == interesse.ProdutoId);
        if (produto is null || produto.Estoque <= 0)
            return BadRequest(new { mensagem = "Produto sem estoque disponível para converter em venda." });

        var vendasController = new VendasController(Context) { ControllerContext = ControllerContext };
        var criarVendaRequest = new CriarVendaRequest(
            interesse.ClienteId,
            request.FormaPagamento,
            new List<ItemVendaRequest> { new(interesse.ProdutoId, 1) },
            request.ValorRecebido,
            request.Parcelas,
            request.DataVencimento);

        var resultadoVenda = await vendasController.Criar(empresaId, criarVendaRequest);

        if (resultadoVenda is not OkObjectResult ok || ok.Value is null)
            return resultadoVenda;

        var vendaId = (int)ok.Value.GetType().GetProperty("Id")!.GetValue(ok.Value)!;

        interesse.Status = StatusInteresse.Convertido;
        interesse.VendaId = vendaId;
        await Context.SaveChangesAsync();

        return Ok(ok.Value);
    }
}
