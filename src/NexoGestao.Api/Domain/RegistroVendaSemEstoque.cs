namespace NexoGestao.Api.Domain;

// Guarda quanto de cada produto foi vendido além do estoque disponível no
// momento da venda, pra dar visibilidade de quanto se vendeu "no fiado do estoque".
public class RegistroVendaSemEstoque
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int ProdutoId { get; set; }
    public Produto Produto { get; set; } = null!;
    public int VendaId { get; set; }
    public Venda Venda { get; set; } = null!;
    public int Quantidade { get; set; }
    public DateTime Data { get; set; } = DateTime.UtcNow;
}
