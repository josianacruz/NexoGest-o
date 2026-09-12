namespace NexoGestao.Api.Domain;

public class Venda
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int? ClienteId { get; set; }
    public Cliente? Cliente { get; set; }
    public decimal Total { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public DateTime Data { get; set; } = DateTime.UtcNow;

    public ICollection<ItemVenda> Itens { get; set; } = new List<ItemVenda>();
}
