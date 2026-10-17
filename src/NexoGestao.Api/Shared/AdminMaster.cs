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

// Perfis de acesso por tipo de cliente: quais módulos cada perfil enxerga. Aplicados pela administradora, empresa a empresa
// (nunca automaticamente em empresas que já existem).
public static class PerfisDeAcesso
{
    public static readonly IReadOnlyDictionary<string, Modulo[]> Modulos = new Dictionary<string, Modulo[]>(StringComparer.OrdinalIgnoreCase)
    {
        // Salão de beleza: agenda e agendamento público, serviços/tabela, promoções e Stories (Marketing), clientes.
        ["Salao"] = new[] { Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Marketing },
        // Loja/varejo: estoque (produtos), vendas/caixa e clientes.
        ["Loja"] = new[] { Modulo.Clientes, Modulo.Produtos, Modulo.Vendas },
        // Alimentação (lanchonete, restaurante, confeitaria): comandas, cardápio (Marketing), estoque, vendas/caixa e clientes.
        ["Alimentacao"] = new[] { Modulo.Clientes, Modulo.Produtos, Modulo.Vendas, Modulo.Comandas, Modulo.Marketing },
        // Tudo (exceto Afiliados, que continua de ligação explícita).
        ["Completo"] = ModulosPadrao.LiberadosSemConfiguracao.ToArray(),
    };

    public static NichoLoja? NichoDoPerfil(string perfil) => perfil.ToLowerInvariant() switch
    {
        "salao" => NichoLoja.BelezaServicos,
        "loja" => NichoLoja.Moda,
        "alimentacao" => NichoLoja.Alimentos,
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
