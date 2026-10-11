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
// disco na máquina do worker (ver src/NexoGestao.Worker); aqui só os dados da
// tarefa, do roteiro e dos materiais usados (com fonte e data).
public class VideoAfiliado
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public int ProdutoAfiliadoId { get; set; }
    public ProdutoAfiliado ProdutoAfiliado { get; set; } = null!;

    // "FotosEdicaoDinamica": montagem de fotos reais do anúncio (NÃO é animação de pessoa).
    // "VideoComIA" ainda não existe: sem GPU, sem ferramenta gratuita que preserve o produto.
    public string Modo { get; set; } = "FotosEdicaoDinamica";

    // Fato observado por quem revisou (ex.: "As fotos mostram marcas de uso") que entra no roteiro.
    public string? ObservacaoRevisao { get; set; }
    public string? CategoriaDetectada { get; set; }

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
    // Caminho completo informado pelo worker (só para mostrar ao usuário onde o MP4 está).
    public string? ArquivoLocal { get; set; }
    // O worker "aluga" a tarefa por alguns minutos e renova a cada batimento; se parar de
    // renovar (PC desligou, processo morreu), a tarefa volta para a fila.
    public DateTime? LeaseAte { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
