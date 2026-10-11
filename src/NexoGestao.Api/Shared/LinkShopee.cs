using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

// Identifica um anúncio da Shopee pelo par loja/item, independente do formato
// do link colado. Formatos reais observados (todos testados com links de
// verdade): "<slug>-i.<loja>.<item>", "/product/<loja>/<item>" e
// "/<slug>/<loja>/<item>" (este último é o destino dos links curtos de
// afiliada). O mesmo produto aparece nos três jeitos — por isso a
// deduplicação usa Chave, nunca o texto do link.
public static class LinkShopee
{
    private static readonly Regex FormatoI = new(@"-i\.(\d+)\.(\d+)(?:[/?#]|$)", RegexOptions.Compiled);
    private static readonly Regex FormatoBarras = new(@"^/(?:[^/]+)/(\d+)/(\d+)/?$", RegexOptions.Compiled);

    private static readonly string[] HostsProduto = { "shopee.com.br" };
    private static readonly string[] HostsLinkCurto = { "s.shopee.com.br" };

    public static bool EhLinkCurto(string link) =>
        Uri.TryCreate(link.Trim(), UriKind.Absolute, out var u)
        && u.Scheme == Uri.UriSchemeHttps
        && HostsLinkCurto.Contains(u.Host.ToLowerInvariant());

    public static bool TentarExtrairChave(string link, out string chave)
    {
        chave = "";
        if (!Uri.TryCreate(link.Trim(), UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = u.Host.ToLowerInvariant();
        if (!HostsProduto.Contains(host) && !host.EndsWith(".shopee.com.br"))
            return false;

        var caminho = Uri.UnescapeDataString(u.AbsolutePath);

        var m = FormatoI.Match(caminho);
        if (!m.Success)
            m = FormatoBarras.Match(caminho);
        if (!m.Success)
            return false;

        chave = $"{m.Groups[1].Value}.{m.Groups[2].Value}";
        return true;
    }

    public static (long? shopId, long? itemId) Ids(string chave)
    {
        var p = chave.Split('.');
        return p.Length == 2 && long.TryParse(p[0], out var s) && long.TryParse(p[1], out var i) ? (s, i) : (null, null);
    }

    // Endereço limpo e estável do produto (sem rastreio de afiliada).
    public static string Canonico(string chave)
    {
        var partes = chave.Split('.');
        return $"https://shopee.com.br/product/{partes[0]}/{partes[1]}";
    }
}

public record LinkCurtoResolvido(string Chave, string LinkCurto);

// Resolve um link curto de afiliada (s.shopee.com.br/...) lendo SÓ o primeiro
// redirecionamento — o mesmo que um clique faria, sem seguir adiante nem abrir
// a página. Proteções: só aceita o host de link curto conhecido, não segue
// redirecionamentos automaticamente, só aceita destino em shopee.com.br, e
// nunca devolve nada do destino além do par loja/item (nada de parâmetros de
// rastreio nem tokens do endereço).
public class ResolvedorLinkAfiliado
{
    private readonly HttpClient _http;

    public ResolvedorLinkAfiliado(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(8);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        _http.DefaultRequestVersion = new Version(1, 1);
        _http.DefaultVersionPolicy = System.Net.Http.HttpVersionPolicy.RequestVersionExact;
    }

    public async Task<LinkCurtoResolvido?> ResolverAsync(string linkCurto, CancellationToken ct = default)
    {
        if (!LinkShopee.EhLinkCurto(linkCurto))
            return null;

        try
        {
            using var requisicao = new HttpRequestMessage(HttpMethod.Head, linkCurto.Trim());
            using var resposta = await _http.SendAsync(requisicao, HttpCompletionOption.ResponseHeadersRead, ct);

            var destino = resposta.Headers.Location;
            if (destino is null)
                return null;

            if (!destino.IsAbsoluteUri)
                destino = new Uri(new Uri(linkCurto.Trim()), destino);

            if (!LinkShopee.TentarExtrairChave(destino.GetLeftPart(UriPartial.Path), out var chave))
                return null;

            return new LinkCurtoResolvido(chave, linkCurto.Trim());
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return null;
        }
    }
}
