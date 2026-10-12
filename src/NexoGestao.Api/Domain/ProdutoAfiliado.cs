namespace NexoGestao.Api.Domain;

public enum OrigemProdutoAfiliado
{
    Manual,
    LoteDeLinks,
    Csv,
    ApiOficial,
    BuscaAutomatica,
    RelatorioShopee,
}

// Representa um produto de afiliada (hoje só Shopee) cadastrado pela empresa.
// Nunca inventamos Preco/LinkAfiliado aqui — ficam nulos até o próprio
// usuário informar (manual/CSV) ou até a API oficial devolver o dado.
// Comissão, preço, vendas e loja SÓ existem quando vieram de um relatório
// exportado do painel de afiliados da Shopee (Origem == RelatorioShopee):
// são informação do arquivo, na data da importação, sujeita às condições da
// Shopee — nunca calculados nem inferidos pelo Nexo. Vendas == 0 é um valor
// real (produto sem vendas); null significa "o arquivo não trouxe".
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

    // Identificador do anúncio na Shopee (par loja/item) — chave de
    // deduplicação dentro da empresa, independente do formato do link.
    public long? ShopId { get; set; }
    public long? ItemId { get; set; }

    public string? NomeLoja { get; set; }
    public int? Vendas { get; set; }
    public decimal? ComissaoPercentual { get; set; }
    public decimal? ComissaoValor { get; set; }

    // Só preenchidos quando a API oficial da Shopee devolver o campo (Origem == ApiOficial).
    // Os nomes seguem os campos da API (taxa do vendedor / taxa da Shopee); o Nexo NÃO afirma que
    // um deles é a "Comissão Extra" enquanto a documentação oficial não confirmar o significado.
    public decimal? ComissaoVendedorPercentual { get; set; }
    public decimal? ComissaoShopeePercentual { get; set; }
    public DateTime? InicioOferta { get; set; }
    public DateTime? FimOferta { get; set; }
    public double? Avaliacao { get; set; }
    public DateTime? UltimaConsultaApi { get; set; }

    // De onde vieram preço/vendas/comissão e quando (nome do arquivo + data).
    public string? OrigemDados { get; set; }
    public DateTime? DataImportacao { get; set; }

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
