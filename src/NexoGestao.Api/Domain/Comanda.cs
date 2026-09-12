namespace NexoGestao.Api.Domain;

public enum StatusComanda
{
    Aberta,
    Fechada
}

public class Comanda
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int Numero { get; set; }
    public string? NomeCliente { get; set; }
    public StatusComanda Status { get; set; } = StatusComanda.Aberta;
    public int? VendaId { get; set; }
    public Venda? Venda { get; set; }
    public DateTime DataAbertura { get; set; } = DateTime.UtcNow;

    public ICollection<ItemComanda> Itens { get; set; } = new List<ItemComanda>();
}