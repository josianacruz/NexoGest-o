namespace NexoGestao.Api.Domain;

public enum OrigemProdutoAfiliado
{
    Manual,
    LoteDeLinks,
    Csv,
    ApiOficial,
}

// Representa um produto de afiliada (hoje só Shopee) cadastrado pela empresa.
// Nunca inventamos Preco/Comissao/LinkAfiliado aqui — ficam nulos até o
// próprio usuário informar (manual/CSV) ou até a API oficial devolver o dado.
public class ProdutoAfiliado
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public string LinkOriginal { get; set; } = string.Empty;
    public string? LinkAfiliado { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string? ImagemUrl { get; set; }
    public decimal? Preco { get; set; }
    public decimal? ComissaoPercentual { get; set; }

    public OrigemProdutoAfiliado Origem { get; set; } = OrigemProdutoAfiliado.Manual;
    public bool Ativo { get; set; } = true;
    public DateTime DataCadastro { get; set; } = DateTime.UtcNow;
    public DateTime DataUltimaAtualizacao { get; set; } = DateTime.UtcNow;
}
