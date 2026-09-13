namespace NexoGestao.Api.Domain;

public enum StatusVaga { Ativa, Preenchida, Expirada }

// Uma vaga = um horário específico divulgado pra fora, com token exclusivo e
// intransferível. Uma vez preenchida (ou trocada de data/hora na tela), vira
// inválida — nunca reaproveitada por outro link.
public class VagaDivulgada
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public DateTime DataHora { get; set; }
    public StatusVaga Status { get; set; } = StatusVaga.Ativa;
    public int? AgendamentoId { get; set; }
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
}
