namespace NexoGestao.Api.Domain;

public enum FormaPagamentoRecebido
{
    Pix,
    Dinheiro,
    CartaoCredito,
    CartaoDebito,
    TransferenciaBancaria,
    Outros
}

// Registro histórico de cada recebimento — cada vez que dinheiro efetivamente
// entra (seja no momento da venda ou na quitação de uma conta a receber),
// nasce uma linha aqui. É a partir daqui que os relatórios financeiros são
// calculados (nunca a partir de recálculos sobre Venda/ContaReceber).
public class Pagamento
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int? ClienteId { get; set; }
    public Cliente? Cliente { get; set; }
    public int VendaId { get; set; }
    public Venda Venda { get; set; } = null!;
    public int? ContaReceberId { get; set; }
    public ContaReceber? ContaReceber { get; set; }
    public decimal Valor { get; set; }
    public FormaPagamentoRecebido FormaPagamento { get; set; }
    public DateTime Data { get; set; } = DateTime.UtcNow;
    public string? Observacao { get; set; }
}
