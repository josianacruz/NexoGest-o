namespace NexoGestao.Api.Domain;

public enum PapelUsuario
{
    Dono,
    Gerente,
    Atendente
}

public class MembroEmpresa
{
    public int Id { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public PapelUsuario Papel { get; set; }
}
