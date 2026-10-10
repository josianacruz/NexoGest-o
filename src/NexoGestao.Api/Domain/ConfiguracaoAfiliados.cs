namespace NexoGestao.Api.Domain;

// Uma por empresa. O Id de afiliada é só um identificador de rastreio de
// comissão — NUNCA é tratado como credencial. AppId/AppSecret são as
// credenciais da API oficial da Shopee (quando a empresa tiver acesso
// confirmado) e ficam sempre criptografadas em repouso via CriptografiaUtil;
// nenhum endpoint devolve o valor descriptografado, só se "está configurado".
public class ConfiguracaoAfiliados
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;

    public string? IdAfiliado { get; set; }

    public string? AppIdCriptografado { get; set; }
    public string? AppSecretCriptografado { get; set; }

    // Só true depois que a empresa confirmar (manualmente, por fora) que tem
    // acesso aprovado à API oficial de afiliados da Shopee. Enquanto false,
    // nenhum endpoint de integração oficial é chamado — tudo fica manual/CSV.
    public bool ApiOficialHabilitada { get; set; } = false;

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
