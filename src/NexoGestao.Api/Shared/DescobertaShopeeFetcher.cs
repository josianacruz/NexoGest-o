using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public record CandidatoProduto(string LinkOriginal, string Fonte, DateTime DataConsulta);

public record ResultadoDescoberta(List<CandidatoProduto> Candidatos, bool BloqueadoTemporariamente);

// Descobre links de produtos da Shopee a partir de uma palavra-chave usando
// a busca pública do DuckDuckGo (site:shopee.com.br <palavra-chave>) — não
// é a busca da própria Shopee (que exige login, testado e documentado em
// AfiliadosController) nem scraping autenticado: é consultar um mecanismo de
// busca de terceiros pelos resultados que ele já indexa publicamente, sem
// login, sem CAPTCHA, sem contornar nenhum bloqueio.
//
// Limitação honesta: cobre só o que o DuckDuckGo já indexou pra aquela
// palavra-chave — não é garantia de achar "todos" os produtos do nicho.
public class DescobertaShopeeFetcher
{
    private static readonly Regex LinkProduto = new(
        @"shopee\.com\.br/[^""&<>\s]*-i\.(\d+)\.(\d+)",
        RegexOptions.Compiled);

    private readonly HttpClient _http;

    public DescobertaShopeeFetcher(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(8);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
        _http.DefaultRequestVersion = new Version(1, 1);
        _http.DefaultVersionPolicy = System.Net.Http.HttpVersionPolicy.RequestVersionExact;

        // Evita o cabeçalho "Expect: 100-continue" que o .NET manda por
        // padrão em POST — não é a causa confirmada do bloqueio abaixo, mas
        // é uma prática melhor de qualquer forma (menos uma volta de rede).
        _http.DefaultRequestHeaders.ExpectContinue = false;
    }

    public async Task<ResultadoDescoberta> BuscarAsync(string palavraChave, int maxResultados, CancellationToken ct = default)
    {
        var query = $"site:shopee.com.br {palavraChave}";
        var conteudo = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("q", query) });

        string html;
        try
        {
            using var resposta = await _http.PostAsync("https://html.duckduckgo.com/html/", conteudo, ct);

            // O DuckDuckGo responde 202 com uma página de "anomalia" quando
            // detecta volume alto de requisições automatizadas vindas do
            // mesmo IP num curto período — não é "sem resultados", é um
            // bloqueio passageiro (visto na prática: passa em minutos/horas).
            // Avisamos isso em vez de devolver uma lista vazia sem explicação.
            if ((int)resposta.StatusCode == 202)
                return new ResultadoDescoberta(new List<CandidatoProduto>(), BloqueadoTemporariamente: true);

            if (!resposta.IsSuccessStatusCode)
                return new ResultadoDescoberta(new List<CandidatoProduto>(), BloqueadoTemporariamente: false);

            var bytes = await resposta.Content.ReadAsByteArrayAsync(ct);
            html = System.Text.Encoding.UTF8.GetString(bytes);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return new ResultadoDescoberta(new List<CandidatoProduto>(), BloqueadoTemporariamente: false);
        }

        var agora = DateTime.UtcNow;
        var vistos = new HashSet<string>();
        var candidatos = new List<CandidatoProduto>();

        foreach (Match m in LinkProduto.Matches(html))
        {
            // O mesmo produto aparece com o nome codificado e decodificado — a
            // chave de deduplicação é "lojaId.itemId" (os dois últimos grupos),
            // que é o identificador real do anúncio na Shopee.
            var chave = $"{m.Groups[1].Value}.{m.Groups[2].Value}";
            if (!vistos.Add(chave))
                continue;

            var link = "https://" + Uri.UnescapeDataString(m.Value);
            candidatos.Add(new CandidatoProduto(link, "DuckDuckGo (site:shopee.com.br)", agora));

            if (candidatos.Count >= maxResultados)
                break;
        }

        return new ResultadoDescoberta(candidatos, BloqueadoTemporariamente: false);
    }
}
