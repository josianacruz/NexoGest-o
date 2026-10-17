namespace NexoGestao.Api.Domain;

// Sessão persistente de login (celular ou desktop). O token completo só existe na resposta do
// login/refresh; aqui fica só o hash (SHA-256), igual ao padrão do WorkerCredencial. Cada renovação
// troca o token (rotação): o antigo é marcado como substituído e nunca mais pode ser usado — se
// alguém roubar um token já trocado, isso denuncia o roubo em vez de dar acesso.
public class RefreshToken
{
    public int Id { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
    public DateTime? RevogadoEm { get; set; }
    public string? SubstituidoPorHash { get; set; }
}
