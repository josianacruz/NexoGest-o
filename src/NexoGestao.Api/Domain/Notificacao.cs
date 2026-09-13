namespace NexoGestao.Api.Domain;

// Registro simples e denormalizado (guarda o nome do cliente/serviço na hora,
// igual outras entidades do sistema) pra não depender do agendamento ainda existir.
public class Notificacao
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Titulo { get; set; } = string.Empty;
    public string ClienteNome { get; set; } = string.Empty;
    public string ServicoNome { get; set; } = string.Empty;
    public DateTime DataHoraAgendamento { get; set; }
    public int? AgendamentoId { get; set; }
    public bool Lida { get; set; } = false;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
}
