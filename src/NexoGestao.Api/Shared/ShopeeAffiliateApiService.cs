using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace NexoGestao.Api.Shared;

// Configuração da integração com a API oficial de afiliados da Shopee (GraphQL).
// App ID e Secret NUNCA ficam no código nem no repositório: vêm de variáveis de ambiente
// (Shopee__Affiliate__AppId / Shopee__Affiliate__AppSecret), user-secrets locais ou, por empresa,
// do cadastro criptografado em Afiliados > Configuração.
//
// ATENÇÃO: o formato abaixo (endpoint, assinatura, nomes de campos) foi montado a partir de material
// de TERCEIROS (bibliotecas não oficiais). A documentação oficial fica atrás do login do painel e ainda
// não foi lida. Tudo o que depende disso está marcado e é ajustável por configuração, e o serviço
// só roda com credenciais configuradas.
public class ShopeeAffiliateOptions
{
    public string? AppId { get; set; }
    public string? AppSecret { get; set; }
    public string Endpoint { get; set; } = "https://open-api.affiliate.shopee.com.br/graphql";
    // Terceiros relatam taxa como fração (0.38 = 38%). Confirmar na doc oficial; se vier em %, ponha false.
    public bool TaxaEhFracao { get; set; } = true;
    public int ItensPorPagina { get; set; } = 50;
    public int MaximoPaginasPorConsulta { get; set; } = 10;
    public int PausaEntrePaginasMs { get; set; } = 1500;
    public int TentativasContraLimite { get; set; } = 3;
    public int TimeoutSegundos { get; set; } = 30;
    // Chave que o agendador externo (GitHub Actions) envia para disparar a atualização diária.
    public string? ChaveAgendador { get; set; }
    // Agendador interno (BackgroundService) às 8h de Brasília. Desligado por padrão.
    public bool AgendadorInternoHabilitado { get; set; }
}

public record CredenciaisShopee(string AppId, string Secret, string Origem);

public record ConsultaOfertas(string PalavraChave, int Ordenacao, int MaximoProdutos);

public record OfertaShopee(
    long? ItemId, long? ShopId, string? Nome, string? NomeLoja,
    decimal? Preco, int? Vendas,
    decimal? ComissaoPercentual, decimal? ComissaoValor,
    decimal? ComissaoVendedorPercentual, decimal? ComissaoShopeePercentual,
    DateTime? InicioOferta, DateTime? FimOferta, double? Avaliacao,
    string? LinkProduto, string? LinkOferta, string? ImagemUrl);

public record ResultadoConsultaApi(
    List<OfertaShopee> Ofertas, int Chamadas, List<string> Avisos, string? AmostraBruta,
    bool CredenciaisRecusadas, bool LimiteExcedido);

public class ShopeeAffiliateApiService
{
    private readonly HttpClient _http;
    private readonly ShopeeAffiliateOptions _opcoes;

    public ShopeeAffiliateApiService(HttpClient http, IOptions<ShopeeAffiliateOptions> opcoes)
    {
        _http = http;
        _opcoes = opcoes.Value;
        _http.Timeout = TimeSpan.FromSeconds(Math.Clamp(_opcoes.TimeoutSegundos, 5, 120));
    }

    // Credenciais globais (variáveis de ambiente); a empresa pode ter as próprias, que têm prioridade.
    public CredenciaisShopee? CredenciaisDoAmbiente() =>
        string.IsNullOrWhiteSpace(_opcoes.AppId) || string.IsNullOrWhiteSpace(_opcoes.AppSecret)
            ? null
            : new CredenciaisShopee(_opcoes.AppId.Trim(), _opcoes.AppSecret.Trim(), "variáveis de ambiente");

    // Assinatura descrita por material de terceiros: SHA-256 hex de AppId + timestamp + corpo + Secret.
    public static string Assinar(string appId, long timestamp, string corpo, string secret)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(appId + timestamp.ToString(CultureInfo.InvariantCulture) + corpo + secret));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    // Consulta GraphQL de ofertas de produtos. Nomes de campos conforme terceiros; o serviço lê só o que vier.
    public static string MontarCorpoConsulta(string palavraChave, int ordenacao, int pagina, int limite)
    {
        var keyword = JsonSerializer.Serialize(palavraChave); // literal de texto válido também em GraphQL
        var query =
            $"query {{ productOfferV2(keyword: {keyword}, sortType: {ordenacao}, page: {pagina}, limit: {limite}) {{ " +
            "nodes { itemId shopId productName shopName price sales commissionRate commission " +
            "sellerCommissionRate shopeeCommissionRate ratingStar productLink offerLink imageUrl " +
            "periodStartTime periodEndTime } pageInfo { page limit hasNextPage } } }";
        return JsonSerializer.Serialize(new { query });
    }

    public async Task<ResultadoConsultaApi> BuscarOfertasAsync(CredenciaisShopee cred, ConsultaOfertas consulta, CancellationToken ct)
    {
        var ofertas = new List<OfertaShopee>();
        var avisos = new List<string>();
        string? amostra = null;
        var chamadas = 0;
        var limite = Math.Clamp(_opcoes.ItensPorPagina, 1, 500);
        var maxPaginas = Math.Clamp(_opcoes.MaximoPaginasPorConsulta, 1, 50);
        var alvo = Math.Clamp(consulta.MaximoProdutos, 1, 500);

        for (var pagina = 1; pagina <= maxPaginas && ofertas.Count < alvo; pagina++)
        {
            JsonDocument? doc = null;
            var tentativa = 0;
            while (true)
            {
                chamadas++;
                var corpo = MontarCorpoConsulta(consulta.PalavraChave, consulta.Ordenacao, pagina, limite);
                var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                using var req = new HttpRequestMessage(HttpMethod.Post, _opcoes.Endpoint)
                {
                    Content = new StringContent(corpo, Encoding.UTF8, "application/json"),
                };
                req.Headers.TryAddWithoutValidation("Authorization",
                    $"SHA256 Credential={cred.AppId}, Timestamp={ts}, Signature={Assinar(cred.AppId, ts, corpo, cred.Secret)}");

                HttpResponseMessage resp;
                try { resp = await _http.SendAsync(req, ct); }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
                {
                    avisos.Add($"Falha de rede ao consultar a API: {ex.Message}");
                    return new ResultadoConsultaApi(ofertas, chamadas, avisos, amostra, false, false);
                }

                using (resp)
                {
                    var texto = await resp.Content.ReadAsStringAsync(ct);
                    if (resp.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                    {
                        avisos.Add($"A API recusou as credenciais (HTTP {(int)resp.StatusCode}). Confira App ID, Secret e se o acesso foi aprovado.");
                        return new ResultadoConsultaApi(ofertas, chamadas, avisos, Corta(texto, 600), true, false);
                    }

                    try { doc = JsonDocument.Parse(texto); }
                    catch (JsonException)
                    {
                        avisos.Add($"Resposta inesperada da API (HTTP {(int)resp.StatusCode}, não é JSON).");
                        return new ResultadoConsultaApi(ofertas, chamadas, avisos, Corta(texto, 600), false, false);
                    }

                    if (TemErroDeLimite(doc.RootElement, (int)resp.StatusCode) && tentativa < _opcoes.TentativasContraLimite)
                    {
                        tentativa++;
                        doc.Dispose();
                        await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, tentativa) * 2), ct); // espera crescente
                        continue;
                    }
                    break;
                }
            }

            using (doc)
            {
                var raiz = doc!.RootElement;
                if (TemErroDeLimite(raiz, 0))
                {
                    avisos.Add("A API informou limite de requisições; a atualização parou e retoma na próxima execução.");
                    return new ResultadoConsultaApi(ofertas, chamadas, avisos, amostra, false, true);
                }
                if (raiz.TryGetProperty("errors", out var erros) && erros.ValueKind == JsonValueKind.Array && erros.GetArrayLength() > 0)
                {
                    avisos.Add("A API respondeu com erro: " + Corta(erros[0].GetRawText(), 300));
                    amostra ??= Corta(raiz.GetRawText(), 1500);
                    return new ResultadoConsultaApi(ofertas, chamadas, avisos, amostra, false, false);
                }

                if (!raiz.TryGetProperty("data", out var data) || !data.TryGetProperty("productOfferV2", out var oferta) ||
                    !oferta.TryGetProperty("nodes", out var nodes) || nodes.ValueKind != JsonValueKind.Array)
                {
                    avisos.Add("A resposta não tem o formato esperado (data.productOfferV2.nodes).");
                    amostra ??= Corta(raiz.GetRawText(), 1500);
                    return new ResultadoConsultaApi(ofertas, chamadas, avisos, amostra, false, false);
                }

                foreach (var no in nodes.EnumerateArray())
                {
                    if (ofertas.Count >= alvo) break;
                    if (amostra is null) amostra = Corta(no.GetRawText(), 1500);
                    var o = ExtrairOferta(no, _opcoes.TaxaEhFracao, avisos);
                    if (o is not null) ofertas.Add(o);
                }

                var temMais = oferta.TryGetProperty("pageInfo", out var pi) && pi.TryGetProperty("hasNextPage", out var hn) &&
                              hn.ValueKind == JsonValueKind.True;
                if (!temMais || nodes.GetArrayLength() == 0) break;
            }

            await Task.Delay(Math.Clamp(_opcoes.PausaEntrePaginasMs, 0, 10000), ct);
        }

        return new ResultadoConsultaApi(ofertas, chamadas, avisos, amostra, false, false);
    }

    private static bool TemErroDeLimite(JsonElement raiz, int statusHttp)
    {
        if (statusHttp == 429) return true;
        if (!raiz.TryGetProperty("errors", out var erros) || erros.ValueKind != JsonValueKind.Array) return false;
        foreach (var e in erros.EnumerateArray())
        {
            var bruto = e.GetRawText();
            // 10030 é o código de limite relatado por terceiros; também reconhece mensagens com "rate limit".
            if (bruto.Contains("10030") || bruto.Contains("rate limit", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    // Leitura tolerante: só preenche o que a API realmente devolveu; nada é calculado nem inventado.
    public static OfertaShopee? ExtrairOferta(JsonElement no, bool taxaEhFracao, List<string> avisos)
    {
        long? itemId = Longo(no, "itemId");
        long? shopId = Longo(no, "shopId");
        var link = Texto(no, "productLink");
        if (itemId is null && link is null) return null; // sem identificação não dá para salvar

        var preco = Decimal(no, "price") ?? Decimal(no, "priceMin");
        var taxa = Taxa(Decimal(no, "commissionRate"), taxaEhFracao);
        var valor = Decimal(no, "commission");
        if (preco is not null && taxa is not null && valor is not null && preco > 0)
        {
            var esperado = preco.Value * taxa.Value / 100m;
            if (esperado > 0 && Math.Abs(esperado - valor.Value) / esperado > 0.2m)
                avisos.Add($"Item {itemId}: a comissão em R$ informada ({valor:0.00}) difere de preço × taxa ({esperado:0.00}); conferir a unidade da taxa.");
        }

        return new OfertaShopee(
            itemId, shopId, Texto(no, "productName"), Texto(no, "shopName"),
            preco, (int?)Longo(no, "sales"),
            taxa, valor,
            Taxa(Decimal(no, "sellerCommissionRate"), taxaEhFracao), Taxa(Decimal(no, "shopeeCommissionRate"), taxaEhFracao),
            Data(no, "periodStartTime"), Data(no, "periodEndTime"),
            (double?)(Decimal(no, "ratingStar") ?? Decimal(no, "rating")),
            link, Texto(no, "offerLink"), Texto(no, "imageUrl"));
    }

    private static decimal? Taxa(decimal? v, bool fracao) => v is null ? null : (fracao ? Math.Round(v.Value * 100m, 4) : v);

    private static string? Corta(string? t, int max) => t is null ? null : (t.Length <= max ? t : t[..max]);

    private static string? Texto(JsonElement e, string nome) =>
        e.TryGetProperty(nome, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString() : null;

    private static long? Longo(JsonElement e, string nome)
    {
        if (!e.TryGetProperty(nome, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String && long.TryParse(v.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var s)) return s;
        return null;
    }

    private static decimal? Decimal(JsonElement e, string nome)
    {
        if (!e.TryGetProperty(nome, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var s)) return s;
        return null;
    }

    // Aceita ISO 8601 ou segundos Unix.
    private static DateTime? Data(JsonElement e, string nome)
    {
        if (!e.TryGetProperty(nome, out var v)) return null;
        if (v.ValueKind == JsonValueKind.String &&
            DateTime.TryParse(v.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var d))
            return d;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var unix) && unix > 0)
            return DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime;
        if (v.ValueKind == JsonValueKind.String && long.TryParse(v.GetString(), out var u2) && u2 > 0)
            return DateTimeOffset.FromUnixTimeSeconds(u2).UtcDateTime;
        return null;
    }
}
