using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public record MetadadosShopee(string? Nome, string? ImagemUrl, string? Categoria);

// Busca só metadados PÚBLICOS que a própria Shopee expõe no HTML pra gerar
// preview de link (og:title/og:image) — o mesmo mecanismo que WhatsApp/
// Facebook usam. Sem login, sem JavaScript, sem CAPTCHA, sem contornar nada:
// é uma requisição HTTP comum com identificação de bot de preview, e a
// Shopee libera isso de propósito (confirmado no robots.txt dela).
//
// Testado manualmente contra um link real de produto antes de implementar:
// og:title e og:image vêm sempre; preço e comissão NUNCA vêm (não existem
// nessa página pública) — por isso este fetcher nunca tenta devolvê-los.
public class ShopeeMetadataFetcher
{
    // A Shopee não garante a ordem dos atributos dentro de <meta> (já vimos
    // tanto 'property="og:title" content="..."' quanto o inverso) — por isso
    // primeiro isolamos a tag <meta ... /> inteira e só depois procuramos
    // "content=" dentro dela, em vez de assumir uma ordem fixa.
    private static Regex TagOg(string propriedade) => new(
        $@"<meta[^>]*\bproperty=""{propriedade}""[^>]*>",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex ConteudoAttr = new(@"\bcontent=""([^""]*)""", RegexOptions.Compiled);
    private static readonly Regex OgTitleTag = TagOg("og:title");
    private static readonly Regex OgImageTag = TagOg("og:image");

    private readonly HttpClient _http;

    public ShopeeMetadataFetcher(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(6);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)");

        // A CDN da Shopee devolve um cabeçalho Alt-Svc anunciando HTTP/3, e o
        // processamento desse cabeçalho no SocketsHttpHandler quebra com
        // NullReferenceException nesta versão do .NET quando o cliente foi
        // criado via AddHttpClient. Forçar HTTP/1.1 evita esse caminho de
        // código por completo — não afeta os dados públicos que buscamos.
        _http.DefaultRequestVersion = new Version(1, 1);
        _http.DefaultVersionPolicy = System.Net.Http.HttpVersionPolicy.RequestVersionExact;
    }

    private static string? ExtrairConteudoDaTag(Regex tagRegex, string html)
    {
        var tag = tagRegex.Match(html);
        if (!tag.Success)
            return null;
        var conteudo = ConteudoAttr.Match(tag.Value);
        return conteudo.Success ? conteudo.Groups[1].Value : null;
    }

    public async Task<MetadadosShopee?> BuscarAsync(string link, CancellationToken ct = default)
    {
        try
        {
            using var resposta = await _http.GetAsync(link, ct);
            if (!resposta.IsSuccessStatusCode)
                return null;

            // A Shopee não declara charset no Content-Type, e o .NET então
            // tenta adivinhar a codificação — às vezes errando e corrompendo
            // acento (ç virando "Ã§"). O HTML é sempre UTF-8 de verdade, então
            // decodificamos os bytes manualmente em vez de confiar no palpite.
            var bytes = await resposta.Content.ReadAsByteArrayAsync(ct);
            var html = System.Text.Encoding.UTF8.GetString(bytes);

            var tituloBruto = ExtrairConteudoDaTag(OgTitleTag, html);
            var titulo = tituloBruto is null ? null : System.Net.WebUtility.HtmlDecode(tituloBruto);
            var imagem = ExtrairConteudoDaTag(OgImageTag, html);

            // Título da página de produto vem como "Nome do produto | Shopee Brasil" — removemos o sufixo.
            var nome = titulo?.Split(" | Shopee")[0].Trim();

            string? categoria = null;
            var breadcrumbBloco = Regex.Match(html, @"""@type"":""BreadcrumbList"".*?\](?=\}|,""@)", RegexOptions.Singleline);
            if (breadcrumbBloco.Success)
            {
                var nomes = Regex.Matches(breadcrumbBloco.Value, @"""name"":""([^""]+)""")
                    .Select(m => m.Groups[1].Value)
                    .Where(n => n != "Shopee")
                    .ToList();
                // Penúltimo nível é a categoria mais específica — o último costuma ser o próprio nome do produto.
                if (nomes.Count >= 2)
                    categoria = System.Net.WebUtility.HtmlDecode(nomes[^2]);
            }

            if (nome is null && imagem is null)
                return null;

            return new MetadadosShopee(nome, imagem, categoria);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return null;
        }
    }
}
