namespace NexoGestao.Api.Domain;

public class ItemComanda
{
    public int Id { get; set; }
    public int ComandaId { get; set; }
    public Comanda Comanda { get; set; } = null!;
    public int ProdutoId { get; set; }
    public Produto Produto { get; set; } = null!;
    public int Quantidade { get; set; }
}