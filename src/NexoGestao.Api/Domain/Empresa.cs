namespace NexoGestao.Api.Domain;

public class Empresa
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Segmento { get; set; }
    public bool ComandasHabilitadas { get; set; } = true;
    public TipoNegocio? TipoNegocio { get; set; }
    public string? WhatsApp { get; set; } // só dígitos, com 55 na frente; aparece na página pública de agendamento
    public NichoLoja? Nicho { get; set; } // nulo = usa o padrão do TipoNegocio (ver Nichos.Efetivo)
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    // Fim do teste grátis. Nulo = sem limite (empresas antigas e as liberadas pela administradora). Ver TesteGratis.
    public DateTime? AcessoAte { get; set; }

    public ICollection<MembroEmpresa> Membros { get; set; } = new List<MembroEmpresa>();
    public ICollection<ModuloEmpresa> Modulos { get; set; } = new List<ModuloEmpresa>();
}
