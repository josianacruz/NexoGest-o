namespace NexoGestao.Api.Domain;

public enum AbordagemConteudo
{
    Demonstracao,
    Tutorial,
    Comparacao,
    ProblemaSolucao,
}

public enum StatusConteudo
{
    Pendente,
    Pronto,
    Erro,
}

// Um "rascunho" de conteúdo de divulgação por produto — roteiro, legenda,
// chamada para compra e hashtags. Gerado só a partir de Nome/Categoria do
// próprio ProdutoAfiliado (nunca inventa característica, desconto, depoimento
// ou urgência que não esteja nesses dados). O vídeo em si (edição com FFmpeg)
// ainda não é gerado aqui — ver observação no AfiliadosController.
public class ConteudoAfiliado
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public int ProdutoAfiliadoId { get; set; }
    public ProdutoAfiliado ProdutoAfiliado { get; set; } = null!;

    public AbordagemConteudo Abordagem { get; set; }
    public string Roteiro { get; set; } = string.Empty;
    public string Legenda { get; set; } = string.Empty;
    public string ChamadaParaCompra { get; set; } = string.Empty;
    public string Hashtags { get; set; } = string.Empty;

    public StatusConteudo Status { get; set; } = StatusConteudo.Pendente;
    public string? MensagemErro { get; set; }

    public DateTime DataGeracao { get; set; } = DateTime.UtcNow;
}
