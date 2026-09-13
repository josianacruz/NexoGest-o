namespace NexoGestao.Api.Domain;

public class ModuloEmpresa
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public Modulo Modulo { get; set; }
    public bool Habilitado { get; set; } = true;
}
