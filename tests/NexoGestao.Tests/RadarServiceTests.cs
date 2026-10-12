using System.Net;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Radar;
using NexoGestao.Api.Shared;
using Xunit;
using static NexoGestao.Tests.ShopeeAffiliateApiServiceTests;

namespace NexoGestao.Tests;

// Testa a lógica do Radar (gravar, preservar links, snapshots, isolamento por empresa, idempotência diária)
// com a API da Shopee SIMULADA. Não prova nada sobre a API real; ver o aviso em ShopeeAffiliateApiServiceTests.
public class RadarServiceTests
{
    private static string Pagina(params string[] nos) =>
        "{\"data\":{\"productOfferV2\":{\"nodes\":[" + string.Join(",", nos) + "],\"pageInfo\":{\"hasNextPage\":false}}}}";

    private static (RadarService Radar, AppDbContext Db) Monta(ManipuladorFalso api, bool comCredenciaisDeAmbiente = true, string? banco = null)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(banco ?? Guid.NewGuid().ToString()).Options);
        var opcoes = new ShopeeAffiliateOptions
        {
            AppId = comCredenciaisDeAmbiente ? "123456" : null,
            AppSecret = comCredenciaisDeAmbiente ? "segredo-de-teste" : null,
            PausaEntrePaginasMs = 0, TentativasContraLimite = 0, Endpoint = "https://exemplo.invalid/graphql",
        };
        var servico = new ShopeeAffiliateApiService(new HttpClient(api), Options.Create(opcoes));
        return (new RadarService(db, servico, DataProtectionProvider.Create("radar-teste"), NullLogger<RadarService>.Instance), db);
    }

    private static RadarConsulta Consulta(int empresa, decimal? minima = null) =>
        new() { EmpresaId = empresa, Nome = "Cozinha", PalavraChave = "mini processador", Ordenacao = OrdenacaoRadar.Comissao, MaximoProdutos = 50, ComissaoMinimaPercentual = minima };

    [Fact]
    public async Task Sem_credenciais_nao_consulta_nada_e_registra_nao_configurada()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, "{}"));
        var (radar, db) = Monta(api, comCredenciaisDeAmbiente: false);
        db.RadarConsultas.Add(Consulta(1));
        await db.SaveChangesAsync();

        var e = await radar.ExecutarAsync(1, "manual", CancellationToken.None);

        Assert.Equal(StatusExecucaoRadar.NaoConfigurada, e.Status);
        Assert.Empty(api.Chamadas);
        Assert.Empty(await db.ProdutosAfiliados.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Grava_novo_atualiza_existente_preserva_links_e_cria_snapshots()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina(No(1, 9, "Existente", "200.00", "0.10", "20.00", "300"), No(2, 9, "Novo"))));
        var (radar, db) = Monta(api);
        db.RadarConsultas.Add(Consulta(1));
        db.ProdutosAfiliados.Add(new ProdutoAfiliado
        {
            EmpresaId = 1, Nome = "Existente", ShopId = 9, ItemId = 1,
            LinkOriginal = "https://shopee.com.br/product/9/1", LinkAfiliado = "https://s.shopee.com.br/DO-CSV",
            Preco = 150m, Vendas = 10, ComissaoPercentual = 5m, Origem = OrigemProdutoAfiliado.RelatorioShopee,
        });
        await db.SaveChangesAsync();

        var e = await radar.ExecutarAsync(1, "manual", CancellationToken.None);

        Assert.Equal(StatusExecucaoRadar.Concluida, e.Status);
        Assert.Equal(1, e.Novos);
        Assert.Equal(1, e.Atualizados);
        Assert.Equal(2, e.Consultados);

        db.EmpresaAtualId = 1;
        var existente = await db.ProdutosAfiliados.SingleAsync(p => p.ItemId == 1);
        Assert.Equal("https://s.shopee.com.br/DO-CSV", existente.LinkAfiliado); // link guardado nunca é trocado
        Assert.Equal(200m, existente.Preco);
        Assert.Equal(300, existente.Vendas);
        Assert.Equal(10m, existente.ComissaoPercentual);
        Assert.Equal(2m, existente.ComissaoVendedorPercentual);
        Assert.NotNull(existente.UltimaConsultaApi);
        Assert.Contains("API oficial", existente.OrigemDados);

        var novo = await db.ProdutosAfiliados.SingleAsync(p => p.ItemId == 2);
        Assert.Equal(OrigemProdutoAfiliado.ApiOficial, novo.Origem);
        Assert.Equal("https://s.shopee.com.br/abc2", novo.LinkAfiliado);
        Assert.Equal(9, novo.ShopId);

        Assert.Equal(2, await db.ProdutoAfiliadoSnapshots.CountAsync());
        Assert.NotNull(e.AmostraBruta);
    }

    [Fact]
    public async Task Comissao_minima_filtra_depois_da_resposta()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina(No(1, 9, "A", taxa: "0.10"), No(2, 9, "B", taxa: "0.30", comissao: "30.00"))));
        var (radar, db) = Monta(api);
        db.RadarConsultas.Add(Consulta(1, minima: 20m));
        await db.SaveChangesAsync();

        var e = await radar.ExecutarAsync(1, "manual", CancellationToken.None);

        Assert.Equal(1, e.Consultados);
        db.EmpresaAtualId = 1;
        var unico = Assert.Single(await db.ProdutosAfiliados.ToListAsync());
        Assert.Equal(2, unico.ItemId);
    }

    [Fact]
    public async Task Atualizar_uma_empresa_nao_mexe_nos_dados_nem_nas_consultas_de_outra()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina(No(1, 9, "A"))));
        var (radar, db) = Monta(api);
        db.RadarConsultas.Add(Consulta(1));
        db.ProdutosAfiliados.Add(new ProdutoAfiliado { EmpresaId = 2, Nome = "Da empresa 2", ShopId = 9, ItemId = 1, LinkOriginal = "https://shopee.com.br/product/9/1", Preco = 1m });
        await db.SaveChangesAsync();

        await radar.ExecutarAsync(1, "manual", CancellationToken.None);

        var da2 = await db.ProdutosAfiliados.IgnoreQueryFilters().SingleAsync(p => p.EmpresaId == 2);
        Assert.Equal(1m, da2.Preco);
        Assert.Null(da2.UltimaConsultaApi);
        Assert.Equal(1, await db.ProdutosAfiliados.IgnoreQueryFilters().CountAsync(p => p.EmpresaId == 1));

        // Empresa 2 não tem consultas: não consulta nada com as da empresa 1.
        var chamadasAntes = api.Chamadas.Count;
        var e2 = await radar.ExecutarAsync(2, "manual", CancellationToken.None);
        Assert.Equal(StatusExecucaoRadar.ConcluidaComAvisos, e2.Status);
        Assert.Equal(chamadasAntes, api.Chamadas.Count);
    }

    [Fact]
    public async Task Rotina_diaria_roda_so_para_quem_ligou_e_uma_vez_por_dia()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina(No(1, 9, "A"))));
        var (radar, db) = Monta(api);
        db.ConfiguracoesAfiliados.Add(new ConfiguracaoAfiliados { EmpresaId = 1, RadarAtivo = true });
        db.ConfiguracoesAfiliados.Add(new ConfiguracaoAfiliados { EmpresaId = 2, RadarAtivo = false });
        db.RadarConsultas.Add(Consulta(1));
        db.RadarConsultas.Add(Consulta(2));
        await db.SaveChangesAsync();

        Assert.Equal(1, await radar.ExecutarAgendadasAsync(CancellationToken.None));
        Assert.Equal(0, await radar.ExecutarAgendadasAsync(CancellationToken.None)); // mesma data: não repete
        Assert.Single(api.Chamadas);
        Assert.Equal(1, await db.RadarExecucoes.IgnoreQueryFilters().CountAsync(e => e.Origem == "agendada"));
    }

    [Fact]
    public async Task Nao_inicia_segunda_atualizacao_enquanto_uma_esta_em_andamento()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.OK, Pagina()));
        var (radar, db) = Monta(api);
        db.RadarExecucoes.Add(new RadarExecucao { EmpresaId = 1, Status = StatusExecucaoRadar.Executando, Inicio = DateTime.UtcNow.AddMinutes(-2) });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<RadarOcupadoException>(() => radar.ExecutarAsync(1, "manual", CancellationToken.None));
    }

    [Fact]
    public async Task Credenciais_recusadas_viram_execucao_falhou_sem_gravar_produtos()
    {
        var api = new ManipuladorFalso((_, _) => (HttpStatusCode.Unauthorized, "{}"));
        var (radar, db) = Monta(api);
        db.RadarConsultas.Add(Consulta(1));
        await db.SaveChangesAsync();

        var e = await radar.ExecutarAsync(1, "manual", CancellationToken.None);

        Assert.Equal(StatusExecucaoRadar.Falhou, e.Status);
        Assert.Contains("recusou", e.Mensagem);
        Assert.Empty(await db.ProdutosAfiliados.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public void Brasilia_e_utc_menos_3()
    {
        var diff = DateTime.UtcNow - RadarService.AgoraBrasilia();
        Assert.InRange(diff.TotalHours, 2.99, 3.01);
    }
}
