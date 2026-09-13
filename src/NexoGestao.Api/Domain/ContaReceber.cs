namespace NexoGestao.Api.Domain;

public enum StatusContaReceber
{
    Pendente,
    Pago
}

public class ContaReceber
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public int VendaId { get; set; }
    public Venda Venda { get; set; } = null!;
    public decimal ValorOriginal { get; set; }
    public decimal ValorPendente { get; set; }
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public DateTime DataVencimento { get; set; }
    public StatusContaReceber Status { get; set; } = StatusContaReceber.Pendente;
    public DateTime? DataPagamento { get; set; }
    public string? Observacao { get; set; }
}
