namespace NexoGestao.Api.Domain;

public enum StatusAgendamento
{
    Agendado,
    Confirmado,
    Concluido,
    Cancelado,
    Faltou
}

public class Agendamento
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;

    // Referência opcional ao serviço cadastrado (pra pré-preencher o formulário),
    // mas nome/duração/valor ficam gravados aqui também — igual ao preço da venda,
    // o agendamento guarda o que valia na hora, mesmo que o serviço mude depois.
    public int? ServicoId { get; set; }
    public Servico? Servico { get; set; }
    public string ServicoNome { get; set; } = string.Empty;

    public DateTime DataHora { get; set; }
    public int DuracaoMinutos { get; set; }
    public decimal Valor { get; set; }
    public string? Observacao { get; set; }
    public StatusAgendamento Status { get; set; } = StatusAgendamento.Agendado;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
}
