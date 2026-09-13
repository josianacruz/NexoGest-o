using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Comandas;

public record AbrirComandaRequest(string? NomeCliente = null);
public record AdicionarItemRequest(int ProdutoId, int Quantidade);
public record AlterarQuantidadeRequest(int Quantidade);
public record FecharComandaRequest(
    string FormaPagamento,
    int? ClienteId = null,
    decimal? ValorRecebido = null,
    int? Parcelas = null);

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

        var ultimoNumero = await Context.Comandas.MaxAsync(c => (int?)c.Numero) ?? 0;

        var comanda = new Comanda
        {
            EmpresaId = empresaAutorizada.Value,
            Numero = ultimoNumero + 1,
            NomeCliente = string.IsNullOrWhiteSpace(request.NomeCliente) ? null : request.NomeCliente.Trim(),
        };
        Context.Comandas.Add(comanda);
        await Context.SaveChangesAsync();

        return Ok(new { comanda.Id, comanda.Numero, comanda.NomeCliente, comanda.Status });
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
                c.NomeCliente,
                c.DataAbertura,
                Itens = c.Itens.Select(i => new { i.Id, i.ProdutoId, i.Produto.Nome, i.Quantidade, i.Produto.Preco })
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

        // Mesmo produto já está na comanda: soma na mesma linha em vez de duplicar.
        var itemExistente = await Context.ItensComanda
            .FirstOrDefaultAsync(i => i.ComandaId == comanda.Id && i.ProdutoId == produto.Id);

        if (itemExistente is not null)
        {
            itemExistente.Quantidade += request.Quantidade;
            await Context.SaveChangesAsync();
            return Ok(new { itemExistente.Id, itemExistente.ProdutoId, produto.Nome, itemExistente.Quantidade });
        }

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

    [HttpPut("{comandaId:int}/itens/{itemId:int}")]
    public async Task<IActionResult> AlterarQuantidade(int empresaId, int comandaId, int itemId, AlterarQuantidadeRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var comanda = await Context.Comandas.FirstOrDefaultAsync(c => c.Id == comandaId);
        if (comanda is null || comanda.Status != StatusComanda.Aberta)
            return NotFound(new { mensagem = "Comanda não encontrada ou já fechada." });

        var item = await Context.ItensComanda.FirstOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId);
        if (item is null)
            return NotFound(new { mensagem = "Item não encontrado nessa comanda." });

        if (request.Quantidade <= 0)
        {
            Context.ItensComanda.Remove(item);
            await Context.SaveChangesAsync();
            return Ok(new { removido = true });
        }

        item.Quantidade = request.Quantidade;
        await Context.SaveChangesAsync();

        return Ok(new { item.Id, item.Quantidade });
    }

    [HttpDelete("{comandaId:int}/itens/{itemId:int}")]
    public async Task<IActionResult> RemoverItem(int empresaId, int comandaId, int itemId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var comanda = await Context.Comandas.FirstOrDefaultAsync(c => c.Id == comandaId);
        if (comanda is null || comanda.Status != StatusComanda.Aberta)
            return NotFound(new { mensagem = "Comanda não encontrada ou já fechada." });

        var item = await Context.ItensComanda.FirstOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId);
        if (item is null)
            return NotFound(new { mensagem = "Item não encontrado nessa comanda." });

        Context.ItensComanda.Remove(item);
        await Context.SaveChangesAsync();

        return Ok(new { removido = true });
    }

    [HttpDelete("{comandaId:int}")]
    public async Task<IActionResult> Cancelar(int empresaId, int comandaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var comanda = await Context.Comandas
            .Include(c => c.Itens)
            .FirstOrDefaultAsync(c => c.Id == comandaId);

        if (comanda is null || comanda.Status != StatusComanda.Aberta)
            return NotFound(new { mensagem = "Comanda não encontrada ou já fechada." });

        Context.ItensComanda.RemoveRange(comanda.Itens);
        Context.Comandas.Remove(comanda);
        await Context.SaveChangesAsync();

        return Ok(new { cancelada = true });
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

        if (request.FormaPagamento == "Fiado" && request.ClienteId is null)
            return BadRequest(new { mensagem = "Venda fiado precisa estar vinculada a um cliente." });

        if (request.FormaPagamento == "Crédito" && request.Parcelas is not null && request.Parcelas < 1)
            return BadRequest(new { mensagem = "O número de parcelas deve ser maior que zero." });

        var itemSemEstoque = comanda.Itens.FirstOrDefault(i => i.Produto.Estoque < i.Quantidade);
        if (itemSemEstoque is not null)
            return BadRequest(new { mensagem = $"Estoque insuficiente de {itemSemEstoque.Produto.Nome}." });

        var venda = new Venda
        {
            EmpresaId = empresaAutorizada.Value,
            ClienteId = request.ClienteId,
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

        if (request.FormaPagamento == "Dinheiro" && request.ValorRecebido is not null)
        {
            if (request.ValorRecebido < total)
            {
                if (request.ClienteId is null)
                    return BadRequest(new { mensagem = "Para receber menos que o total, selecione um cliente — o restante fica registrado como fiado." });

                venda.ValorRecebido = request.ValorRecebido;
                venda.SaldoDevedor = total - request.ValorRecebido;
            }
            else
            {
                venda.ValorRecebido = request.ValorRecebido;
                venda.Troco = request.ValorRecebido - total;
            }
        }
        else if (request.FormaPagamento == "Crédito")
        {
            venda.Parcelas = request.Parcelas ?? 1;
        }
        else if (request.FormaPagamento == "Fiado")
        {
            var valorPago = request.ValorRecebido ?? 0;
            if (valorPago < 0 || valorPago > total)
                return BadRequest(new { mensagem = "Valor pago inválido para uma venda fiado." });

            venda.ValorRecebido = valorPago;
            var saldo = total - valorPago;
            venda.SaldoDevedor = saldo > 0 ? saldo : null;
        }

        Context.Vendas.Add(venda);
        comanda.Venda = venda;
        comanda.Status = StatusComanda.Fechada;

        await Context.SaveChangesAsync();

        return Ok(new { venda.Id, venda.Total, venda.Troco, venda.SaldoDevedor, comanda.Status });
    }
}