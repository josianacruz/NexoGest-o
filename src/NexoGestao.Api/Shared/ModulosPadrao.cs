using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Shared;

// Configuração central dos módulos do sistema — nenhuma outra parte do
// backend ou do frontend deve manter sua própria lista de módulos/menu.
// Front busca essa informação via GET /api/empresas/minhas (campo "modulos").
public static class ModulosPadrao
{
    public static readonly Modulo[] TodosOsModulos = Enum.GetValues<Modulo>();

    // Empresa sem nenhuma linha em ModulosEmpresa (criada antes da configuração de módulos) mantém tudo liberado,
    // EXCETO módulos que precisam ser ligados de propósito. Afiliados é um deles: nunca aparece sozinho para
    // empresas de clientes; o Dono liga explicitamente (PUT /api/empresas/{id}/modulos).
    public static readonly Modulo[] SoComLigacaoExplicita = { Modulo.Afiliados };

    public static IEnumerable<Modulo> LiberadosSemConfiguracao => TodosOsModulos.Where(m => !SoComLigacaoExplicita.Contains(m));

    // Módulos de cada tipo de negócio: vêm dos perfis (PerfisDeAcesso), para existir uma lista só.
    public static readonly IReadOnlyDictionary<TipoNegocio, Modulo[]> PorTipoNegocio = new Dictionary<TipoNegocio, Modulo[]>
    {
        [TipoNegocio.Alimentacao] = PerfisDeAcesso.Modulos["Alimentacao"],
        [TipoNegocio.Comercio] = PerfisDeAcesso.Modulos["Loja"],
        [TipoNegocio.Beleza] = PerfisDeAcesso.Modulos["Salao"],
        [TipoNegocio.Saude] = PerfisDeAcesso.Modulos["Salao"],
        [TipoNegocio.Servicos] = PerfisDeAcesso.Modulos["ServicosGerais"],
    };
}
