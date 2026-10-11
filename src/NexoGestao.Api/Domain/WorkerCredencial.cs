namespace NexoGestao.Api.Domain;

// Credencial do worker local de vídeo. Restrita a UMA empresa e revogável a qualquer momento.
// O token é mostrado uma única vez, ao criar; aqui só fica o hash (SHA-256) e um prefixo para
// identificar a credencial na tela. O worker usa só conexão de SAÍDA para a API.
public class WorkerCredencial
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Nome { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public string Prefixo { get; set; } = string.Empty;
    public DateTime CriadaEm { get; set; } = DateTime.UtcNow;
    public DateTime? RevogadaEm { get; set; }

    // Estado informado pelo próprio worker a cada contato.
    public DateTime? UltimoContato { get; set; }
    public string? Maquina { get; set; }
    public string? Versao { get; set; }
    public string? Pasta { get; set; }
    public long? EspacoUsadoBytes { get; set; }
    public long? EspacoLivreBytes { get; set; }
}
