namespace NexoGestao.Api.Domain;

public enum OrigemProdutoAfiliado
{
    Manual,
    LoteDeLinks,
    Csv,
    ApiOficial,
    BuscaAutomatica,
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

    // Preenchidos só quando Origem == BuscaAutomatica — de onde veio o link
    // e quando foi consultado, pra deixar rastreável (nunca afirmamos que um
    // dado "é" de uma certa data sem registrar isso).
    public string? FonteDescoberta { get; set; }
    public DateTime? DataConsultaFonte { get; set; }
    public string? MotivoSelecao { get; set; }

    // Comissão nunca é "verificada" sem uma fonte válida pra conta do usuário
    // (API oficial configurada e habilitada). Até lá, fica sempre false — ver
    // AfiliadosController.Buscar.
    public bool ComissaoVerificada { get; set; } = false;
}
