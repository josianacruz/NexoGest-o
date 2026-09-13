namespace NexoGestao.Api.Domain;

// Uma linha por empresa. Se não existir, os valores padrão (ver
// ConfiguracaoAgendaController) valem sem cobrar nada de ninguém —
// nada disso é fixo pra um tipo de negócio específico.
public class ConfiguracaoAgenda
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public int HorasAntesLembrete { get; set; } = 24;
    public int HorasMinimasCancelamento { get; set; } = 24;
    public bool CobrarCancelamentoForaPrazo { get; set; } = false;
}
