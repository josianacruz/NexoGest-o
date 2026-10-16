namespace NexoGestao.Api.Domain;

// Biblioteca de fotos da loja: cada foto enviada fica guardada para ser reaproveitada em 1 toque (Stories, produtos).
// O navegador reduz a foto antes de enviar; aqui ela fica como bytes, com uma miniatura pequena para a lista.
public class MidiaLoja
{
    public const int MaxBytes = 400 * 1024;
    public const int MaxMiniatura = 24 * 1024;
    public const int MaxNaBiblioteca = 60;

    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Nome { get; set; } = string.Empty;
    public string ContentType { get; set; } = "image/jpeg";
    public byte[] Dados { get; set; } = Array.Empty<byte>();
    public string Miniatura { get; set; } = string.Empty; // data URL pequena
    public string Hash { get; set; } = string.Empty;      // SHA-256: a mesma foto não entra duas vezes
    public int Usos { get; set; }
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public DateTime UltimoUsoEm { get; set; } = DateTime.UtcNow;
}
