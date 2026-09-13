namespace NexoGestao.Api.Domain;

public enum StatusInteresse { Novo, Reservado, Convertido, Perdido }

// Registro do fluxo Story -> interesse. ProdutoNome/ProdutoPreco ficam
// gravados aqui (igual Agendamento.ServicoNome) pra manter o histórico
// mesmo que o produto mude de preço ou seja removido depois.
public class Interesse
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public int ProdutoId { get; set; }
    public Produto Produto { get; set; } = null!;
    public string ProdutoNome { get; set; } = string.Empty;
    public decimal ProdutoPreco { get; set; }

    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;

    public StatusInteresse Status { get; set; } = StatusInteresse.Novo;

    // Preenchido quando convertido em venda — reaproveita Vendas/Cobranças
    // já existentes, não duplica nada financeiro aqui.
    public int? VendaId { get; set; }
    public Venda? Venda { get; set; }

    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
}
