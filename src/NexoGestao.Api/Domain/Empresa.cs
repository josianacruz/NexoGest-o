namespace NexoGestao.Api.Domain;

public class Empresa
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Segmento { get; set; }
    public bool ComandasHabilitadas { get; set; } = true;
    public TipoNegocio? TipoNegocio { get; set; }
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    public ICollection<MembroEmpresa> Membros { get; set; } = new List<MembroEmpresa>();
    public ICollection<ModuloEmpresa> Modulos { get; set; } = new List<ModuloEmpresa>();
}
