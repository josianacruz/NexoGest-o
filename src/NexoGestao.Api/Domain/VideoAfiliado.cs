namespace NexoGestao.Api.Domain;

public enum StatusVideoAfiliado
{
    Pendente,
    Processando,
    Pronto,
    Erro,
    SemMateriais,
}

// Tarefa de geração de vídeo de um produto. O MP4 NUNCA fica no banco: fica em
// disco na máquina do worker (ver FilaVideosService); aqui só os dados da
// tarefa, do roteiro e dos materiais usados (com fonte e data).
public class VideoAfiliado
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public int ProdutoAfiliadoId { get; set; }
    public ProdutoAfiliado ProdutoAfiliado { get; set; } = null!;

    public StatusVideoAfiliado Status { get; set; } = StatusVideoAfiliado.Pendente;
    public string? Mensagem { get; set; }
    public int Tentativas { get; set; }

    public string? VersaoRoteiro { get; set; }
    public string? RoteiroJson { get; set; }
    public string? Legenda { get; set; }
    public string? Hashtags { get; set; }

    // Fotos do anúncio usadas (URLs públicas do próprio anúncio) e quando foram lidas.
    public string? MateriaisJson { get; set; }
    public DateTime? MateriaisLidosEm { get; set; }
    public string? MusicaCredito { get; set; }

    public double? DuracaoSegundos { get; set; }
    public long? TamanhoBytes { get; set; }
    public double? TempoProcessamentoSegundos { get; set; }
    public string? ArquivoRelativo { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
