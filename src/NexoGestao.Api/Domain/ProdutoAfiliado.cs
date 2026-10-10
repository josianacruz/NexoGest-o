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
// Nunca inventamos Preco/LinkAfiliado aqui — ficam nulos até o próprio
// usuário informar (manual/CSV) ou até a API oficial devolver o dado.
// Sem campo de comissão: removido porque não existe nenhuma fonte real
// pra esse dado hoje (nem a página pública do produto, nem a API oficial
// da Shopee — essa última nunca foi ligada) e mantê-lo gerava a impressão
// de que a comissão vinha de algum lugar confiável.
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
}
