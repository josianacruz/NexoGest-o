using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NexoGestao.Api.Data;

namespace NexoGestao.Api.Shared;

// Período de teste gratuito. Empresa criada pelo cadastro recebe Empresa.AcessoAte = hoje + 30 dias; passado o prazo,
// o painel e a página pública daquela empresa são bloqueados e a pessoa é mandada falar com a administradora.
// Empresa sem AcessoAte (as que já existiam antes deste recurso, e as que a administradora liberou) nunca expira.
public static class TesteGratis
{
    public const int DiasPadrao = 30;
    public const string WhatsAppPadrao = "5516993090151";

    public static int Dias(IConfiguration? c) => int.TryParse(c?["Limites:DiasDeTeste"], out var v) && v > 0 ? v : DiasPadrao;

    // Número da administradora para a cliente pedir a liberação (só dígitos, com 55).
    public static string WhatsAppDeContato(IConfiguration? c) => WhatsAppUtil.Normalizar(c?["Contato:WhatsApp"]) ?? WhatsAppPadrao;

    public static bool Expirado(DateTime? acessoAte, DateTime agora) => acessoAte is { } fim && fim < agora;

    // Dias que ainda restam (nulo = sem limite). Nunca negativo.
    public static int? DiasRestantes(DateTime? acessoAte, DateTime agora) =>
        acessoAte is { } fim ? Math.Max(0, (int)Math.Ceiling((fim - agora).TotalDays)) : null;

    public static string MensagemDeBloqueio(IConfiguration? c)
    {
        var n = WhatsAppDeContato(c);
        var d = n.StartsWith("55") ? n[2..] : n;
        var formatado = d.Length == 11 ? $"({d[..2]}) {d.Substring(2, 5)}-{d[7..]}" : d;
        return $"O período de teste grátis terminou. Para continuar usando, fale com a gente pelo WhatsApp {formatado}.";
    }

    public static string ChaveDeCache(int empresaId) => $"acesso-ate:{empresaId}";
}

// Bloqueia (402) qualquer chamada às rotas de uma empresa cujo teste terminou: o painel (api/empresas/{id}/...) e a página
// pública (api/publico/empresas/{id}/...). A administradora nunca é bloqueada. O prazo fica 60 s em memória para não pesar no banco.
public class TesteGratisMiddleware
{
    private static readonly Regex Rota = new(@"^/api/(?:publico/)?empresas/(\d+)(?:/|$)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private readonly RequestDelegate _proximo;

    public TesteGratisMiddleware(RequestDelegate proximo) => _proximo = proximo;

    public async Task InvokeAsync(HttpContext contexto, AppDbContext banco, IMemoryCache cache, IConfiguration configuracao)
    {
        var m = Rota.Match(contexto.Request.Path.Value ?? "");
        if (!m.Success || HttpMethods.IsOptions(contexto.Request.Method) || AdminMaster.Eh(contexto.User, configuracao))
        {
            await _proximo(contexto);
            return;
        }

        var id = int.Parse(m.Groups[1].Value);
        var acessoAte = await cache.GetOrCreateAsync(TesteGratis.ChaveDeCache(id), async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60);
            return await banco.Empresas.IgnoreQueryFilters().Where(e => e.Id == id).Select(e => e.AcessoAte).FirstOrDefaultAsync();
        });

        if (TesteGratis.Expirado(acessoAte, DateTime.UtcNow))
        {
            contexto.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            await contexto.Response.WriteAsJsonAsync(new
            {
                codigo = "teste-expirado",
                // A cliente final (página pública) não deve ver o aviso de teste do estabelecimento.
                mensagem = (contexto.Request.Path.Value ?? "").StartsWith("/api/publico/", StringComparison.OrdinalIgnoreCase)
                    ? "Esta página está temporariamente indisponível. Fale diretamente com o estabelecimento."
                    : TesteGratis.MensagemDeBloqueio(configuracao),
                whatsapp = TesteGratis.WhatsAppDeContato(configuracao),
            });
            return;
        }

        await _proximo(contexto);
    }
}
