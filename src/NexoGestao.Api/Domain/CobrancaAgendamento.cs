namespace NexoGestao.Api.Domain;

public enum StatusCobrancaAgendamento
{
    Pendente,
    Paga
}

// Cobrança que nasce de um agendamento (cancelamento fora do prazo ou saldo
// deixado ao concluir o atendimento) — deliberadamente separada de
// ContaReceber (módulo Cobranças/Vendas) pra não mexer naquele módulo.
public class CobrancaAgendamento
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int AgendamentoId { get; set; }
    public Agendamento Agendamento { get; set; } = null!;
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public decimal Valor { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public StatusCobrancaAgendamento Status { get; set; } = StatusCobrancaAgendamento.Pendente;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    public DateTime? DataPagamento { get; set; }
}
