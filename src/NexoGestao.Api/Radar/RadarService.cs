using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Radar;

public class RadarOcupadoException(string mensagem) : Exception(mensagem);

// Atualização do Radar pela API oficial: consulta as ofertas, grava/atualiza os produtos da empresa
// (sem apagar nada, sem tocar nos links já guardados) e registra uma foto diária dos números.
// Só roda com credenciais configuradas; sem elas, registra "não configurada" e para.
public class RadarService
{
    private static readonly string[] DominiosShopee = { "shopee.com.br", "shopee.com", "s.shopee.com.br", "shope.ee" };

    private readonly AppDbContext _db;
    private readonly ShopeeAffiliateApiService _api;
    private readonly IDataProtectionProvider _protecao;
    private readonly ILogger<RadarService> _log;

    public RadarService(AppDbContext db, ShopeeAffiliateApiService api, IDataProtectionProvider protecao, ILogger<RadarService> log)
    {
        _db = db;
        _api = api;
        _protecao = protecao;
        _log = log;
    }

    // Brasil não tem horário de verão desde 2019: Brasília = UTC-3 o ano todo.
    public static DateTime AgoraBrasilia() => DateTime.UtcNow.AddHours(-3);

    public async Task<CredenciaisShopee?> ObterCredenciaisAsync()
    {
        var config = await _db.ConfiguracoesAfiliados.FirstOrDefaultAsync();
        var appId = CriptografiaUtil.Descriptografar(_protecao, config?.AppIdCriptografado);
        var secret = CriptografiaUtil.Descriptografar(_protecao, config?.AppSecretCriptografado);
        if (!string.IsNullOrWhiteSpace(appId) && !string.IsNullOrWhiteSpace(secret))
            return new CredenciaisShopee(appId, secret, "cadastro da empresa");
        return _api.CredenciaisDoAmbiente();
    }

    public async Task<RadarExecucao> ExecutarAsync(int empresaId, string origem, CancellationToken ct)
    {
        _db.EmpresaAtualId = empresaId;

        var corte = DateTime.UtcNow.AddMinutes(-30);
        if (await _db.RadarExecucoes.AnyAsync(e => e.Status == StatusExecucaoRadar.Executando && e.Inicio > corte, ct))
            throw new RadarOcupadoException("Já existe uma atualização em andamento. Aguarde terminar.");

        var execucao = new RadarExecucao { EmpresaId = empresaId, Origem = origem };
        _db.RadarExecucoes.Add(execucao);
        await _db.SaveChangesAsync(ct);

        var avisos = new List<string>();
        try
        {
            var cred = await ObterCredenciaisAsync();
            if (cred is null)
            {
                Finaliza(execucao, StatusExecucaoRadar.NaoConfigurada,
                    "Sem App ID e Secret da API oficial. Configure-os depois que a Shopee liberar o acesso; nada foi consultado.");
                await _db.SaveChangesAsync(ct);
                return execucao;
            }

            var consultas = await _db.RadarConsultas.Where(c => c.Ativa).OrderBy(c => c.Id).ToListAsync(ct);
            execucao.Consultas = consultas.Count;
            if (consultas.Count == 0)
            {
                Finaliza(execucao, StatusExecucaoRadar.ConcluidaComAvisos, "Nenhuma consulta ativa. Cadastre ao menos um nicho/palavra-chave.");
                await _db.SaveChangesAsync(ct);
                return execucao;
            }

            var produtos = await _db.ProdutosAfiliados.ToListAsync(ct);
            var porChave = new Dictionary<string, ProdutoAfiliado>();
            var porLink = new Dictionary<string, ProdutoAfiliado>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in produtos)
            {
                porLink[p.LinkOriginal] = p;
                var chave = p.ShopId is not null && p.ItemId is not null
                    ? $"{p.ShopId}.{p.ItemId}"
                    : LinkShopee.TentarExtrairChave(p.LinkOriginal, out var k) ? k : null;
                if (chave is not null) porChave[chave] = p;
            }

            var agora = DateTime.UtcNow;
            var credenciaisRecusadas = false;
            var limite = false;
            foreach (var consulta in consultas)
            {
                var r = await _api.BuscarOfertasAsync(cred,
                    new ConsultaOfertas(consulta.PalavraChave, (int)consulta.Ordenacao, consulta.MaximoProdutos), ct);
                execucao.Chamadas += r.Chamadas;
                avisos.AddRange(r.Avisos.Select(a => $"[{consulta.Nome}] {a}"));
                execucao.AmostraBruta ??= r.AmostraBruta;
                credenciaisRecusadas |= r.CredenciaisRecusadas;
                limite |= r.LimiteExcedido;

                foreach (var o in r.Ofertas)
                {
                    if (consulta.ComissaoMinimaPercentual is not null &&
                        (o.ComissaoPercentual is null || o.ComissaoPercentual < consulta.ComissaoMinimaPercentual))
                        continue;

                    execucao.Consultados++;
                    var chave = o.ShopId is not null && o.ItemId is not null
                        ? $"{o.ShopId}.{o.ItemId}"
                        : o.LinkProduto is not null && LinkShopee.TentarExtrairChave(o.LinkProduto, out var k) ? k : null;
                    if (chave is null)
                    {
                        avisos.Add($"[{consulta.Nome}] Oferta sem identificação de loja/item; ignorada.");
                        continue;
                    }

                    if (!porChave.TryGetValue(chave, out var produto))
                    {
                        var (shopId, itemId) = LinkShopee.Ids(chave);
                        var link = LinkValido(o.LinkProduto) ? o.LinkProduto! : LinkShopee.Canonico(chave);
                        if (porLink.TryGetValue(link, out var jaExiste))
                        {
                            produto = jaExiste; // mesmo link guardado antes sem loja/item
                        }
                        else
                        {
                            produto = new ProdutoAfiliado
                            {
                                EmpresaId = empresaId,
                                LinkOriginal = link,
                                Nome = o.Nome ?? $"Produto {itemId}",
                                Origem = OrigemProdutoAfiliado.ApiOficial,
                            };
                            _db.ProdutosAfiliados.Add(produto);
                            execucao.Novos++;
                        }
                        produto.ShopId ??= shopId;
                        produto.ItemId ??= itemId;
                        porChave[chave] = produto;
                        porLink[produto.LinkOriginal] = produto;
                    }
                    else
                    {
                        execucao.Atualizados++;
                    }

                    // Os links já guardados (CSV ou colados) nunca são trocados; só preenche se estava vazio.
                    if (produto.LinkAfiliado is null && LinkValido(o.LinkOferta)) produto.LinkAfiliado = o.LinkOferta;
                    if (string.IsNullOrWhiteSpace(produto.Nome) && o.Nome is not null) produto.Nome = o.Nome;
                    produto.ImagemUrl ??= o.ImagemUrl;
                    if (o.Preco is not null) produto.Preco = o.Preco;
                    if (o.Vendas is not null) produto.Vendas = o.Vendas;
                    if (o.NomeLoja is not null) produto.NomeLoja = o.NomeLoja;
                    if (o.ComissaoPercentual is not null) produto.ComissaoPercentual = o.ComissaoPercentual;
                    if (o.ComissaoValor is not null) produto.ComissaoValor = o.ComissaoValor;
                    produto.ComissaoVendedorPercentual = o.ComissaoVendedorPercentual;
                    produto.ComissaoShopeePercentual = o.ComissaoShopeePercentual;
                    produto.InicioOferta = o.InicioOferta;
                    produto.FimOferta = o.FimOferta;
                    if (o.Avaliacao is not null) produto.Avaliacao = o.Avaliacao;
                    produto.OrigemDados = $"API oficial da Shopee (afiliados), consulta \"{consulta.Nome}\"";
                    produto.DataImportacao = agora;
                    produto.UltimaConsultaApi = agora;
                    produto.DataUltimaAtualizacao = agora;

                    _db.ProdutoAfiliadoSnapshots.Add(new ProdutoAfiliadoSnapshot
                    {
                        EmpresaId = empresaId,
                        ProdutoAfiliado = produto,
                        DataConsulta = agora,
                        Fonte = "API oficial da Shopee",
                        Preco = produto.Preco,
                        Vendas = produto.Vendas,
                        ComissaoPercentual = produto.ComissaoPercentual,
                        ComissaoValor = produto.ComissaoValor,
                        ComissaoVendedorPercentual = produto.ComissaoVendedorPercentual,
                        ComissaoShopeePercentual = produto.ComissaoShopeePercentual,
                        InicioOferta = produto.InicioOferta,
                        FimOferta = produto.FimOferta,
                    });
                }

                await _db.SaveChangesAsync(ct);
                if (credenciaisRecusadas || limite) break;
            }

            var status = credenciaisRecusadas || (execucao.Consultados == 0 && avisos.Count > 0)
                ? StatusExecucaoRadar.Falhou
                : avisos.Count > 0 || limite ? StatusExecucaoRadar.ConcluidaComAvisos : StatusExecucaoRadar.Concluida;
            Finaliza(execucao, status, Resume(avisos));
        }
        catch (OperationCanceledException)
        {
            Finaliza(execucao, StatusExecucaoRadar.Falhou, "Atualização interrompida.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Falha na atualização do Radar da empresa {Empresa}", empresaId);
            Finaliza(execucao, StatusExecucaoRadar.Falhou, "Erro inesperado: " + ex.Message);
        }

        await _db.SaveChangesAsync(CancellationToken.None);
        return execucao;
    }

    // Todas as empresas com o Radar ligado. Idempotente por dia (Brasília): quem já teve execução
    // "agendada" hoje é pulada, então chamar mais de uma vez não duplica consultas.
    public async Task<int> ExecutarAgendadasAsync(CancellationToken ct)
    {
        var hojeBrasilia = AgoraBrasilia().Date;
        var inicioDoDiaUtc = hojeBrasilia.AddHours(3);
        var empresas = await _db.ConfiguracoesAfiliados.IgnoreQueryFilters()
            .Where(c => c.RadarAtivo).Select(c => c.EmpresaId).ToListAsync(ct);

        var rodadas = 0;
        foreach (var empresaId in empresas)
        {
            _db.EmpresaAtualId = empresaId;
            var jaRodou = await _db.RadarExecucoes.AnyAsync(e => e.Origem == "agendada" && e.Inicio >= inicioDoDiaUtc, ct);
            if (jaRodou) continue;
            try { await ExecutarAsync(empresaId, "agendada", ct); rodadas++; }
            catch (RadarOcupadoException) { /* já em andamento */ }
            _db.ChangeTracker.Clear();
        }
        return rodadas;
    }

    private static bool LinkValido(string? link) =>
        Uri.TryCreate(link, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps &&
        DominiosShopee.Any(d => u.Host.Equals(d, StringComparison.OrdinalIgnoreCase) || u.Host.EndsWith("." + d, StringComparison.OrdinalIgnoreCase));

    private static void Finaliza(RadarExecucao e, StatusExecucaoRadar status, string? mensagem)
    {
        e.Status = status;
        e.Fim = DateTime.UtcNow;
        e.Mensagem = mensagem is { Length: > 1500 } ? mensagem[..1500] : mensagem;
    }

    private static string? Resume(List<string> avisos) =>
        avisos.Count == 0 ? null : string.Join(" | ", avisos.Take(5)) + (avisos.Count > 5 ? $" | … e mais {avisos.Count - 5} aviso(s)." : "");
}

// Executa as atualizações às 8h de Brasília quando habilitado (Shopee:Affiliate:AgendadorInternoHabilitado).
// Com o servidor sempre ligado isso basta; no Render grátis (que dorme) use o gatilho externo
// (POST /api/interno/radar/executar-agendadas, ver .github/workflows/radar-diario.yml).
// Se o servidor estava fora do ar às 8h, executa assim que voltar no mesmo dia.
public class RadarAgendadorService : BackgroundService
{
    private readonly IServiceScopeFactory _escopos;
    private readonly ShopeeAffiliateOptions _opcoes;
    private readonly ILogger<RadarAgendadorService> _log;

    public RadarAgendadorService(IServiceScopeFactory escopos, IOptions<ShopeeAffiliateOptions> opcoes, ILogger<RadarAgendadorService> log)
    {
        _escopos = escopos;
        _opcoes = opcoes.Value;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken parar)
    {
        if (!_opcoes.AgendadorInternoHabilitado)
        {
            _log.LogInformation("Agendador interno do Radar desligado (Shopee:Affiliate:AgendadorInternoHabilitado=false).");
            return;
        }

        _log.LogInformation("Agendador do Radar ligado: atualização diária às 08:00 (Brasília).");
        using var relogio = new PeriodicTimer(TimeSpan.FromMinutes(5));
        while (await relogio.WaitForNextTickAsync(parar))
        {
            if (RadarService.AgoraBrasilia().Hour < 8) continue;
            try
            {
                using var escopo = _escopos.CreateScope();
                var n = await escopo.ServiceProvider.GetRequiredService<RadarService>().ExecutarAgendadasAsync(parar);
                if (n > 0) _log.LogInformation("Radar: {N} empresa(s) atualizada(s) pela rotina diária.", n);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "Falha na rotina diária do Radar"); }
        }
    }
}
