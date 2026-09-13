namespace NexoGestao.Api.Domain;

// Uma linha por dia da semana (0=Domingo .. 6=Sábado) por empresa — define o
// "Perfil da loja": em quais dias atende e o horário de cada um. Sem linhas
// configuradas, assume seg-sáb 08:00-18:00 e domingo fechado (ver controller).
public class ConfiguracaoDiaSemana
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int DiaSemana { get; set; }
    public bool Ativo { get; set; } = true;
    public string HoraInicio { get; set; } = "08:00";
    public string HoraFim { get; set; } = "18:00";
}
