using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Vendas;

public record ItemVendaRequest(int ProdutoId, int Quantidade);
public record RegistrarPagamentoRequest(
    decimal Valor,
    FormaPagamentoRecebido FormaPagamento,
    DateTime? DataPagamento = null,
    string? Observacao = null);
public record CriarVendaRequest(
    int? ClienteId,
    string FormaPagamento,
    List<ItemVendaRequest> Itens,
    decimal? ValorRecebido = null,
    int? Parcelas = null,
    DateTime? DataVencimento = null,
    FormaPagamentoRecebido? FormaPagamentoRecebimento = null);

[ApiController]
[Route("api/empresas/{empresaId:int}/vendas")]
[Authorize]
public class VendasController : TenantControllerBase
{
    public VendasController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarVendaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Vendas);
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

        if (request.FormaPagamento == "Fiado" && (request.ValorRecebido ?? 0) > 0 &&
            (request.FormaPagamentoRecebimento is null || !Enum.IsDefined(request.FormaPagamentoRecebimento.Value)))
            return BadRequest(new { mensagem = "Informe a forma de pagamento do valor recebido agora." });

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

        // Transação + trava de linha (FOR UPDATE) por produto: duas vendas
        // concorrentes do mesmo item nunca leem o mesmo estoque "por baixo do
        // outro" — a segunda só lê depois que a primeira baixou e commitou.
        await using var transacao = await Context.Database.BeginTransactionAsync();

        decimal total = 0;
        var registrosSemEstoque = new List<RegistroVendaSemEstoque>();
        var estoqueFinalPorProduto = new Dictionary<int, int>();
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

            var estoqueAtual = estoqueFinalPorProduto.TryGetValue(produto.Id, out var jaLido)
                ? jaLido
                : await EstoqueUtil.TravarEObterEstoqueAsync(Context, produto.Id);

            // Quanto dessa venda não tinha estoque disponível (pra registrar no relatório).
            var disponivel = Math.Max(0, estoqueAtual);
            var semEstoque = Math.Max(0, itemReq.Quantidade - disponivel);
            if (semEstoque > 0)
            {
                registrosSemEstoque.Add(new RegistroVendaSemEstoque
                {
                    EmpresaId = empresaAutorizada.Value,
                    ProdutoId = produto.Id,
                    Venda = venda,
                    Quantidade = semEstoque,
                });
            }

            estoqueFinalPorProduto[produto.Id] = estoqueAtual - itemReq.Quantidade;
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

        if (registrosSemEstoque.Count > 0)
            Context.RegistrosVendaSemEstoque.AddRange(registrosSemEstoque);

        // Tudo que não virou saldo devedor entrou no caixa agora — registra o
        // recebimento pra alimentar os relatórios (sem isso, uma venda paga na
        // hora nunca apareceria em "quanto já recebi").
        var recebidoImediato = total - (venda.SaldoDevedor ?? 0);
        if (recebidoImediato > 0)
        {
            var formaRecebida = PagamentoUtil.ParaFormaRecebida(request.FormaPagamento, request.FormaPagamentoRecebimento)!.Value;
            Context.Pagamentos.Add(new Pagamento
            {
                EmpresaId = empresaAutorizada.Value,
                ClienteId = request.ClienteId,
                Venda = venda,
                Valor = recebidoImediato,
                FormaPagamento = formaRecebida,
            });
        }

        await Context.SaveChangesAsync();

        foreach (var (produtoId, estoqueFinal) in estoqueFinalPorProduto)
            await EstoqueUtil.DefinirEstoqueAsync(Context, produtoId, estoqueFinal);

        await transacao.CommitAsync();

        var estoqueNegativo = produtos
            .Where(p => estoqueFinalPorProduto.TryGetValue(p.Id, out var e) && e < 0)
            .Select(p => p.Nome)
            .ToList();

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
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Vendas);
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

    [HttpGet("sem-estoque")]
    public async Task<IActionResult> ListarSemEstoque(int empresaId, [FromQuery] string periodo = "dia")
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Vendas);
        if (empresaAutorizada is null)
            return Forbid();

        var agora = DateTime.UtcNow;
        var desde = periodo switch
        {
            "semana" => agora.Date.AddDays(-7),
            "mes" => agora.Date.AddMonths(-1),
            _ => agora.Date,
        };

        var registros = await Context.RegistrosVendaSemEstoque
            .Where(r => r.Data >= desde)
            .GroupBy(r => new { r.ProdutoId, r.Produto.Nome })
            .Select(g => new
            {
                ProdutoId = g.Key.ProdutoId,
                ProdutoNome = g.Key.Nome,
                Quantidade = g.Sum(r => r.Quantidade),
            })
            .OrderByDescending(r => r.Quantidade)
            .ToListAsync();

        return Ok(registros);
    }

    [HttpPost("{vendaId:int}/pagamentos")]
    public async Task<IActionResult> RegistrarPagamento(int empresaId, int vendaId, RegistrarPagamentoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Vendas);
        if (empresaAutorizada is null)
            return Forbid();

        if (!Enum.IsDefined(request.FormaPagamento))
            return BadRequest(new { mensagem = "Forma de pagamento inválida." });

        if (request.Valor <= 0)
            return BadRequest(new { mensagem = "Valor de pagamento inválido." });

        var contaReceber = await Context.ContasReceber.FirstOrDefaultAsync(c => c.VendaId == vendaId);
        if (contaReceber is null || contaReceber.Status == StatusContaReceber.Pago)
            return NotFound(new { mensagem = "Essa venda não tem saldo devedor em aberto." });

        // Transação: um segundo clique concorrente encontra a conta já Paga e
        // recebe 404 em vez de gerar um Pagamento duplicado.
        await using var transacao = await Context.Database.BeginTransactionAsync();

        PagamentoUtil.ResultadoPagamento? resultado;
        try
        {
            resultado = await PagamentoUtil.RegistrarPagamentoContaAsync(
                Context, empresaAutorizada.Value, contaReceber.Id, request.Valor, request.FormaPagamento,
                request.DataPagamento, request.Observacao);
        }
        catch (ArgumentOutOfRangeException)
        {
            return BadRequest(new { mensagem = "Valor de pagamento inválido." });
        }

        if (resultado is null)
            return NotFound(new { mensagem = "Essa venda não tem saldo devedor em aberto." });

        await transacao.CommitAsync();

        var venda = await Context.Vendas.FirstOrDefaultAsync(v => v.Id == vendaId);
        return Ok(new { Id = vendaId, venda?.SaldoDevedor });
    }
}
