using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Vendas;

public record ItemVendaRequest(int ProdutoId, int Quantidade);
public record RegistrarPagamentoRequest(decimal Valor);
public record CriarVendaRequest(
    int? ClienteId,
    string FormaPagamento,
    List<ItemVendaRequest> Itens,
    decimal? ValorRecebido = null,
    int? Parcelas = null,
    DateTime? DataVencimento = null);

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

        if (string.IsNullOrWhiteSpace(request.FormaPagamento))
            return BadRequest(new { mensagem = "Informe a forma de pagamento." });

        if (request.Itens.Any(i => i.Quantidade <= 0))
            return BadRequest(new { mensagem = "A quantidade de cada item deve ser maior que zero." });

        if (request.FormaPagamento == "Fiado" && request.ClienteId is null)
            return BadRequest(new { mensagem = "Venda fiado precisa estar vinculada a um cliente." });

        if (request.FormaPagamento == "Fiado" && request.DataVencimento is null)
            return BadRequest(new { mensagem = "Informe a data de vencimento da venda fiado." });

        if (request.FormaPagamento == "Crédito" && request.Parcelas is not null && request.Parcelas < 1)
            return BadRequest(new { mensagem = "O número de parcelas deve ser maior que zero." });

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

        if (request.FormaPagamento == "Dinheiro" && request.ValorRecebido is not null)
        {
            if (request.ValorRecebido < total)
            {
                // Pagou menos que o total em dinheiro: o restante vira fiado, vinculado a um cliente.
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

        // Criada junto com a venda na mesma SaveChangesAsync (via navegação, sem
        // precisar do Id ainda) pra nunca existir uma venda fiado sem conta a receber.
        ContaReceber? contaReceber = null;
        if (request.FormaPagamento == "Fiado" && venda.SaldoDevedor is > 0)
        {
            contaReceber = new ContaReceber
            {
                EmpresaId = empresaAutorizada.Value,
                ClienteId = request.ClienteId!.Value,
                Venda = venda,
                ValorOriginal = total,
                ValorPendente = venda.SaldoDevedor.Value,
                DataVencimento = DateTime.SpecifyKind(request.DataVencimento!.Value, DateTimeKind.Utc),
            };
            Context.ContasReceber.Add(contaReceber);
        }

        await Context.SaveChangesAsync();

        var estoqueNegativo = produtos.Where(p => p.Estoque < 0).Select(p => p.Nome).ToList();

        return Ok(new
        {
            venda.Id,
            venda.Total,
            venda.Troco,
            venda.SaldoDevedor,
            venda.Data,
            estoqueNegativo,
            ContaReceberId = contaReceber?.Id
        });
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
                v.ValorRecebido,
                v.Troco,
                v.Parcelas,
                v.SaldoDevedor,
                v.Data,
                ClienteNome = v.Cliente != null ? v.Cliente.Nome : null,
                Itens = v.Itens.Select(i => new { i.ProdutoId, i.Quantidade, i.PrecoUnitario })
            })
            .ToListAsync();

        return Ok(vendas);
    }

    [HttpPost("{vendaId:int}/pagamentos")]
    public async Task<IActionResult> RegistrarPagamento(int empresaId, int vendaId, RegistrarPagamentoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var venda = await Context.Vendas.FirstOrDefaultAsync(v => v.Id == vendaId);
        if (venda is null || venda.SaldoDevedor is null or <= 0)
            return NotFound(new { mensagem = "Essa venda não tem saldo devedor em aberto." });

        if (request.Valor <= 0 || request.Valor > venda.SaldoDevedor)
            return BadRequest(new { mensagem = "Valor de pagamento inválido." });

        venda.ValorRecebido = (venda.ValorRecebido ?? 0) + request.Valor;
        var novoSaldo = venda.SaldoDevedor.Value - request.Valor;
        venda.SaldoDevedor = novoSaldo > 0 ? novoSaldo : null;

        // Mantém a conta a receber vinculada em dia com o pagamento registrado aqui.
        var contaReceber = await Context.ContasReceber.FirstOrDefaultAsync(c => c.VendaId == vendaId);
        if (contaReceber is not null)
        {
            contaReceber.ValorPendente = Math.Max(0, contaReceber.ValorPendente - request.Valor);
            if (contaReceber.ValorPendente == 0)
            {
                contaReceber.Status = StatusContaReceber.Pago;
                contaReceber.DataPagamento = DateTime.UtcNow;
            }
        }

        await Context.SaveChangesAsync();

        return Ok(new { venda.Id, venda.SaldoDevedor });
    }
}
