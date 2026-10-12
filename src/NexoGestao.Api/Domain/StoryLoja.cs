namespace NexoGestao.Api.Domain;

public enum TipoStory { Novidade, Promocao, Lembrete }

// Novidade curta que o Dono publica e os clientes veem na página pública de agendamento.
// É conteúdo público: só texto simples (a tela mostra como texto, nunca como HTML) e some sozinho depois de ExpiraEm.
public class StoryLoja
{
    public const int MaxTexto = 180;
    public static readonly TimeSpan Validade = TimeSpan.FromHours(24);

    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public TipoStory Tipo { get; set; } = TipoStory.Novidade;
    public string Texto { get; set; } = string.Empty;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
}
