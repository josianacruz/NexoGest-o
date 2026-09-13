using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Shared;

// Configuração central dos módulos do sistema — nenhuma outra parte do
// backend ou do frontend deve manter sua própria lista de módulos/menu.
// Front busca essa informação via GET /api/empresas/minhas (campo "modulos").
public static class ModulosPadrao
{
    public static readonly Modulo[] TodosOsModulos = Enum.GetValues<Modulo>();

    public static readonly IReadOnlyDictionary<TipoNegocio, Modulo[]> PorTipoNegocio = new Dictionary<TipoNegocio, Modulo[]>
    {
        [TipoNegocio.Alimentacao] = new[]
        {
            Modulo.Clientes, Modulo.Produtos, Modulo.Vendas, Modulo.Comandas, Modulo.Cobrancas, Modulo.Marketing,
        },
        [TipoNegocio.Comercio] = new[]
        {
            Modulo.Clientes, Modulo.Produtos, Modulo.Vendas, Modulo.Cobrancas, Modulo.Marketing, Modulo.Interesses,
        },
        [TipoNegocio.Beleza] = new[]
        {
            Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Cobrancas, Modulo.Marketing,
        },
        [TipoNegocio.Saude] = new[]
        {
            Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Cobrancas,
        },
        [TipoNegocio.Servicos] = new[]
        {
            Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Cobrancas, Modulo.Marketing,
        },
    };
}
