using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Shared;

// Administrador máster do sistema (a dona da plataforma, para testes e suporte): acesso a TODAS as empresas e módulos.
//
// Quem é: os e-mails em Admin:Emails (variável Admin__Emails no Render; separados por vírgula). É conferido A CADA
// pedido, então tirar um e-mail da lista revoga o acesso na hora, mesmo com o login ainda aberto no celular.
// Nada de nome ou e-mail fixo no código.
public static class AdminMaster
{
    public static HashSet<string> Lista(IConfiguration? configuracao)
    {
        var bruto = configuracao?["Admin:Emails"] ?? "";
        return bruto.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public static bool Eh(ClaimsPrincipal? usuario, IConfiguration? configuracao)
    {
        var email = usuario?.FindFirstValue(ClaimTypes.Email) ?? usuario?.FindFirstValue(JwtRegisteredClaimNames.Email);
        return !string.IsNullOrWhiteSpace(email) && Lista(configuracao).Contains(email);
    }
}

// Perfis de acesso por tipo de negócio: FONTE ÚNICA de quais módulos cada tipo enxerga. O menu lateral do site mostra só
// os módulos que a empresa tem ligados, e a API recusa (403) os demais. É usado em três lugares: na criação da empresa
// (ModulosPadrao.PorTipoNegocio), na escolha do tipo no primeiro acesso e no console da administradora.
public static class PerfisDeAcesso
{
    // "Início" e "Configurações" aparecem para todos e não são módulos.
    private static readonly Modulo[] DoSalao = { Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Cobrancas, Modulo.Marketing, Modulo.Financeiro };
    // Varejo: inclui "Interesses" (clientes que pedem produtos), próprio de quem vende peças.
    private static readonly Modulo[] DaLoja = { Modulo.Clientes, Modulo.Produtos, Modulo.Vendas, Modulo.Cobrancas, Modulo.Marketing, Modulo.Interesses, Modulo.Financeiro };
    // Alimentação: comandas e cardápio; sem Agenda e Serviços. Mantém Clientes e Cobranças porque o fiado precisa deles.
    private static readonly Modulo[] DaAlimentacao = { Modulo.Clientes, Modulo.Produtos, Modulo.Vendas, Modulo.Comandas, Modulo.Cobrancas, Modulo.Marketing, Modulo.Financeiro };
    private static readonly Modulo[] DosServicosGerais = { Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Vendas, Modulo.Cobrancas, Modulo.Marketing, Modulo.Financeiro };

    public static readonly IReadOnlyDictionary<string, Modulo[]> Modulos = new Dictionary<string, Modulo[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["Salao"] = DoSalao,
        ["Loja"] = DaLoja,
        ["Alimentacao"] = DaAlimentacao,
        ["ServicosGerais"] = DosServicosGerais,
        // Tudo (exceto Afiliados, que continua de ligação explícita).
        ["Completo"] = Enum.GetValues<Modulo>().Where(m => m != Modulo.Afiliados).ToArray(),
    };

    // Perfis que a própria dona escolhe no primeiro acesso ("Completo" é só da administradora).
    public static readonly string[] EscolhiveisPelaDona = { "Salao", "Loja", "Alimentacao", "ServicosGerais" };

    public static NichoLoja? NichoDoPerfil(string perfil) => perfil.ToLowerInvariant() switch
    {
        "salao" or "servicosgerais" => NichoLoja.BelezaServicos,
        "loja" => NichoLoja.Moda,
        "alimentacao" => NichoLoja.Alimentos,
        _ => null,
    };

    public static TipoNegocio? TipoDoPerfil(string perfil) => perfil.ToLowerInvariant() switch
    {
        "salao" => TipoNegocio.Beleza,
        "loja" => TipoNegocio.Comercio,
        "alimentacao" => TipoNegocio.Alimentacao,
        "servicosgerais" => TipoNegocio.Servicos,
        _ => null,
    };

    // Nome do perfil que corresponde exatamente ao conjunto de módulos ligados; "Personalizado" se nenhum bate.
    public static string Inferir(IEnumerable<Modulo> ligados)
    {
        var conjunto = ligados.Where(m => m != Modulo.Afiliados).ToHashSet();
        foreach (var (nome, modulos) in Modulos)
        {
            if (conjunto.SetEquals(modulos.Where(m => m != Modulo.Afiliados)))
                return nome;
        }
        return "Personalizado";
    }
}

// Liga os módulos de um perfil e desliga os demais (Afiliados nunca é mexido), e acerta o nicho e o tipo do negócio.
// Nada é apagado: só muda o que aparece e o que a API libera.
public static class AplicadorDePerfil
{
    public static async Task AplicarAsync(NexoGestao.Api.Data.AppDbContext context, Empresa empresa, string perfil)
    {
        var doPerfil = PerfisDeAcesso.Modulos[perfil];
        var existentes = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(context.ModulosEmpresa.Where(m => m.EmpresaId == empresa.Id));
        foreach (var modulo in ModulosPadrao.TodosOsModulos.Where(m => m != Modulo.Afiliados))
        {
            var ligar = doPerfil.Contains(modulo);
            var linha = existentes.FirstOrDefault(m => m.Modulo == modulo);
            if (linha is null)
                context.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = empresa.Id, Modulo = modulo, Habilitado = ligar });
            else
                linha.Habilitado = ligar;
        }

        if (PerfisDeAcesso.NichoDoPerfil(perfil) is { } nicho)
            empresa.Nicho = nicho;
        if (PerfisDeAcesso.TipoDoPerfil(perfil) is { } tipo)
            empresa.TipoNegocio = tipo;

        await context.SaveChangesAsync();
    }
}
