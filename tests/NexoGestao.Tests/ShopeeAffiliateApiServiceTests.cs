using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// ATENÇÃO: as respostas abaixo são SIMULADAS a partir do formato descrito por material de terceiros.
// Elas provam que o nosso código lê, assina e trata erros como projetado; NÃO provam como a API real
// da Shopee responde (a documentação oficial ainda não foi lida e o acesso ainda não foi liberado).
public class ShopeeAffiliateApiServiceTests
{
    internal sealed class ManipuladorFalso(Func<HttpRequestMessage, string, (HttpStatusCode, string)> responde) : HttpMessageHandler
    {
        public List<(HttpRequestMessage Req, string Corpo)> Chamadas { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var corpo = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            Chamadas.Add((request, corpo));
            var (status, texto) = responde(request, corpo);
            return new HttpResponseMessage(status) { Content = new StringContent(texto, Encoding.UTF8, "application/json") };
        }
    }

    internal static ShopeeAffiliateApiService Servico(ManipuladorFalso m, Action<ShopeeAffiliateOptions>? ajusta = null)
    {
        var o = new ShopeeAffiliateOptions { PausaEntrePaginasMs = 0, TentativasContraLimite = 0, ItensPorPagina = 2, Endpoint = "https://exemplo.invalid/graphql" };
        ajusta?.Invoke(o);
        return new ShopeeAffiliateApiService(new HttpClient(m), Options.Create(o));
    }

    internal static readonly CredenciaisShopee Cred = new("123456", "segredo-de-teste", "teste");

    private static string Pagina(bool temMais, params string[] nos) =>
        "{\"data\":{\"productOfferV2\":{\"nodes\":[" + string.Join(",", nos) + "],\"pageInfo\":{\"page\":1,\"limit\":2,\"hasNextPage\":" + (temMais ? "true" : "false") + "}}}}";

    internal static string No(long item, long shop, string nome, string preco = "100.00", string taxa = "0.10", string comissao = "10.00", string vendas = "250") =>
        $"{{\"itemId\":\"{item}\",\"shopId\":\"{shop}\",\"productName\":\"{nome}\",\"shopName\":\"Loja X\",\"price\":\"{preco}\",\"sales\":{vendas}," +
        $"\"commissionRate\":\"{taxa}\",\"commission\":\"{comissao}\",\"sellerCommissionRate\":\"0.02\",\"shopeeCommissionRate\":\"0.08\",\"ratingStar\":\"4.8\"," +
        $"\"productLink\":\"https://shopee.com.br/product/{shop}/{item}\",\"offerLink\":\"https://s.shopee.com.br/abc{item}\",\"imageUrl\":\"https://down-br.img.susercontent.com/file/x{item}\"," +
        "\"periodStartTime\":\"2026-10-01T00:00:00Z\",\"periodEndTime\":1798675200}";

    [Fact]
    public void Assinatura_e_o_sha256_de_appId_timestamp_corpo_secret()
    {
        // Valor de referência calculado de forma independente (Python hashlib).
        Assert.Equal("3fae6cb9ca323a576e55c69074d420be04608759398a4b7a43a79cd1811c3060",
            ShopeeAffiliateApiService.Assinar("1", 1700000000, "{}", "s"));
    }

    [Fact]
    public void Palavra_chave_com_aspas_e_barras_nao_quebra_nem_injeta_a_consulta()
    {
        const string original = "mini \"processador\" \\ } { x";
        var corpo = ShopeeAffiliateApiService.MontarCorpoConsulta(original, 5, 1, 50);
        using var doc = JsonDocument.Parse(corpo); // continua sendo JSON válido
        var query = doc.RootElement.GetProperty("query").GetString()!;

        // O texto entra como literal escapado (\uXXXX/\\ valem igual em JSON e GraphQL): ao ler o literal de volta,
        // sai exatamente a palavra original e nenhum caractere dela escapa do literal.
        var inicio = query.IndexOf("keyword: ", StringComparison.Ordinal) + "keyword: ".Length;
        var fim = query.IndexOf(", sortType:", StringComparison.Ordinal);
        Assert.Equal(original, JsonSerializer.Deserialize<string>(query[inicio..fim]));
        Assert.Contains("sortType: 5", query);
    }

    [Fact]
    public void Extrai_somente_o_que_veio_e_converte_taxa_de_fracao_para_percentual()
    {
        var avisos = new List<string>();
        using var doc = JsonDocument.Parse(No(55, 66, "Mini Processador", "100.00", "0.10", "10.00"));
        var o = ShopeeAffiliateApiService.ExtrairOferta(doc.RootElement, true, avisos)!;
        Assert.Equal(55, o.ItemId);
        Assert.Equal(66, o.ShopId);
        Assert.Equal(100m, o.Preco);
        Assert.Equal(10m, o.ComissaoPercentual);
        Assert.Equal(10m, o.ComissaoValor);
        Assert.Equal(2m, o.ComissaoVendedorPercentual);
        Assert.Equal(8m, o.ComissaoShopeePercentual);
        Assert.Equal(250, o.Vendas);
        Assert.Equal(4.8, o.Avaliacao);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), o.InicioOferta);
        Assert.NotNull(o.FimOferta); // veio como segundos Unix
        Assert.Empty(avisos);
    }

    [Fact]
    public void Campo_ausente_fica_nulo_e_zero_vendas_e_valor_real()
    {
        var avisos = new List<string>();
        using var doc = JsonDocument.Parse("{\"itemId\":1,\"shopId\":2,\"sales\":0}");
        var o = ShopeeAffiliateApiService.ExtrairOferta(doc.RootElement, true, avisos)!;
        Assert.Equal(0, o.Vendas);
        Assert.Null(o.Preco);
        Assert.Null(o.ComissaoPercentual);
        Assert.Null(o.ComissaoValor);
        Assert.Null(o.ComissaoVendedorPercentual);
    }

    [Fact]
    public void Oferta_sem_identificacao_e_ignorada()
    {
        using var doc = JsonDocument.Parse("{\"productName\":\"sem id\",\"price\":\"10\"}");
        Assert.Null(ShopeeAffiliateApiService.ExtrairOferta(doc.RootElement, true, new List<string>()));
    }

    [Fact]
    public void Avisa_quando_comissao_em_reais_nao_bate_com_preco_vezes_taxa()
    {
        var avisos = new List<string>();
        using var doc = JsonDocument.Parse(No(7, 8, "X", "100.00", "0.10", "50.00"));
        ShopeeAffiliateApiService.ExtrairOferta(doc.RootElement, true, avisos);
        Assert.Single(avisos);
        Assert.Contains("difere", avisos[0]);
    }

    [Fact]
    public async Task Busca_varias_paginas_assina_cada_chamada_e_respeita_o_maximo()
    {
        var pagina = 0;
        var m = new ManipuladorFalso((_, _) =>
        {
            pagina++;
            return pagina == 1
                ? (HttpStatusCode.OK, Pagina(true, No(1, 9, "A"), No(2, 9, "B")))
                : (HttpStatusCode.OK, Pagina(false, No(3, 9, "C")));
        });
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("mini processador", 5, 100), CancellationToken.None);

        Assert.Equal(3, r.Ofertas.Count);
        Assert.Equal(2, r.Chamadas);
        Assert.False(r.CredenciaisRecusadas);

        foreach (var (req, corpo) in m.Chamadas)
        {
            var auth = req.Headers.GetValues("Authorization").Single();
            Assert.StartsWith("SHA256 Credential=123456, Timestamp=", auth);
            var ts = long.Parse(auth.Split("Timestamp=")[1].Split(',')[0]);
            var assinatura = auth.Split("Signature=")[1];
            Assert.Equal(ShopeeAffiliateApiService.Assinar("123456", ts, corpo, "segredo-de-teste"), assinatura);
            Assert.DoesNotContain("segredo-de-teste", auth); // o Secret nunca viaja, só a assinatura
        }
    }

    [Fact]
    public async Task Para_no_maximo_de_produtos_pedido()
    {
        var m = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina(true, No(1, 9, "A"), No(2, 9, "B"))));
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("x", 5, 2), CancellationToken.None);
        Assert.Equal(2, r.Ofertas.Count);
        Assert.Single(m.Chamadas);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task Credenciais_recusadas_sao_reportadas_sem_inventar_dados(HttpStatusCode status)
    {
        var m = new ManipuladorFalso((_, _) => (status, "{}"));
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("x", 5, 10), CancellationToken.None);
        Assert.True(r.CredenciaisRecusadas);
        Assert.Empty(r.Ofertas);
        Assert.Single(r.Avisos);
    }

    [Fact]
    public async Task Limite_de_requisicoes_para_a_atualizacao_e_avisa()
    {
        var m = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "{\"errors\":[{\"message\":\"rate limit\",\"extensions\":{\"code\":10030}}]}"));
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("x", 5, 10), CancellationToken.None);
        Assert.True(r.LimiteExcedido);
        Assert.Empty(r.Ofertas);
    }

    [Fact]
    public async Task Resposta_que_nao_e_json_gera_aviso_e_nao_quebra()
    {
        var m = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "<html>manutenção</html>"));
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("x", 5, 10), CancellationToken.None);
        Assert.Empty(r.Ofertas);
        Assert.Contains(r.Avisos, a => a.Contains("não é JSON"));
    }

    [Fact]
    public async Task Erro_de_campo_desconhecido_guarda_amostra_para_diagnostico()
    {
        var m = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "{\"errors\":[{\"message\":\"Cannot query field \\\"ratingStar\\\"\"}]}"));
        var r = await Servico(m).BuscarOfertasAsync(Cred, new ConsultaOfertas("x", 5, 10), CancellationToken.None);
        Assert.Empty(r.Ofertas);
        Assert.NotNull(r.AmostraBruta);
        Assert.Contains(r.Avisos, a => a.Contains("erro"));
    }

    [Fact]
    public void Sem_variaveis_de_ambiente_nao_ha_credenciais()
    {
        var s = Servico(new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "{}")));
        Assert.Null(s.CredenciaisDoAmbiente());
        var s2 = Servico(new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "{}")), o => { o.AppId = "1"; o.AppSecret = "s"; });
        Assert.NotNull(s2.CredenciaisDoAmbiente());
    }
}
