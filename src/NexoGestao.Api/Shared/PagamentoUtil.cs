using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Shared;

// Ponto único de baixa de uma conta a receber — usado tanto pela tela de
// Cobranças quanto pelo pagamento inline de fiado na tela de Vendas, pra não
// duplicar a regra (e não deixar as duas divergirem) de quitar
// ContaReceber + Venda + registrar o Pagamento que alimenta os relatórios.
public static class PagamentoUtil
{
    public sealed record ResultadoPagamento(ContaReceber Conta, Pagamento Pagamento);

    // Traduz a forma de pagamento "comercial" da Venda/Comanda (como o cliente
    // pagou/vai pagar) pra forma de pagamento "financeira" (como o dinheiro
    // efetivamente entrou) usada nos relatórios. Fiado exige a escolha
    // explícita porque o valor pago na hora pode ter vindo de qualquer meio.
    public static FormaPagamentoRecebido? ParaFormaRecebida(string formaPagamentoVenda, FormaPagamentoRecebido? escolhida) =>
        formaPagamentoVenda switch
        {
            "PIX" => FormaPagamentoRecebido.Pix,
            "Dinheiro" => FormaPagamentoRecebido.Dinheiro,
            "Débito" => FormaPagamentoRecebido.CartaoDebito,
            "Crédito" => FormaPagamentoRecebido.CartaoCredito,
            "Fiado" => escolhida,
            _ => FormaPagamentoRecebido.Outros,
        };

    public static async Task<ResultadoPagamento?> RegistrarPagamentoContaAsync(
        AppDbContext context,
        int empresaId,
        int contaId,
        decimal? valorSolicitado,
        FormaPagamentoRecebido formaPagamento,
        DateTime? dataPagamento = null,
        string? observacao = null)
    {
        var conta = await context.ContasReceber.FirstOrDefaultAsync(c => c.Id == contaId);
        if (conta is null || conta.Status == StatusContaReceber.Pago)
            return null;

        var valor = valorSolicitado ?? conta.ValorPendente;
        if (valor <= 0 || valor > conta.ValorPendente)
            throw new ArgumentOutOfRangeException(nameof(valorSolicitado), "Valor de pagamento inválido.");

        var data = dataPagamento is null
            ? DateTime.UtcNow
            : DateTime.SpecifyKind(dataPagamento.Value.Date, DateTimeKind.Utc);

        conta.ValorPendente -= valor;

        var venda = await context.Vendas.FirstOrDefaultAsync(v => v.Id == conta.VendaId);
        if (venda is not null)
        {
            venda.ValorRecebido = (venda.ValorRecebido ?? 0) + valor;
            venda.SaldoDevedor = conta.ValorPendente > 0 ? conta.ValorPendente : null;
        }

        if (conta.ValorPendente <= 0)
        {
            conta.ValorPendente = 0;
            conta.Status = StatusContaReceber.Pago;
            conta.DataPagamento = data;
        }

        var pagamento = new Pagamento
        {
            EmpresaId = empresaId,
            ClienteId = conta.ClienteId,
            VendaId = conta.VendaId,
            ContaReceberId = conta.Id,
            Valor = valor,
            FormaPagamento = formaPagamento,
            Data = data,
            Observacao = string.IsNullOrWhiteSpace(observacao) ? null : observacao.Trim(),
        };
        context.Pagamentos.Add(pagamento);

        await context.SaveChangesAsync();

        return new ResultadoPagamento(conta, pagamento);
    }
}
