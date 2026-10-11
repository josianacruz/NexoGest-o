using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Afiliados;

public record SalvarConfiguracaoRequest(string? IdAfiliado, string? AppId, string? AppSecret);

public record CriarProdutoAfiliadoRequest(
    string LinkOriginal,
    string? LinkAfiliado,
    string Nome,
    string? Categoria,
    string? ImagemUrl,
    decimal? Preco);

public record AtualizarProdutoAfiliadoRequest(
    string? LinkAfiliado,
    string Nome,
    string? Categoria,
    string? ImagemUrl,
    decimal? Preco,
    bool Ativo);

public record CadastrarLoteRequest(List<string> Links);
public record ImportarRelatorioRequest(string ConteudoCsv, string? NomeArquivo);

// Sem opções de comissão: removidas a pedido — não existe fonte real pra
// comissão hoje (ver Buscar). SinaisVendas continua existindo mas também
// cai pra Relevancia na prática, já que não há fonte de vendas pública.
public enum PrioridadeBusca { Relevancia, SinaisVendas }

public record BuscarProdutosRequest(
    string PalavraChave,
    string? Nicho,
    decimal? PrecoMin,
    decimal? PrecoMax,
    int QuantidadeMaxima,
    PrioridadeBusca Prioridade,
    bool GerarVideosAutomaticamente = false,
    int LimiteVideosAutomaticos = 0);

[ApiController]
[Route("api/empresas/{empresaId:int}/afiliados")]
[Authorize]
public class AfiliadosController : TenantControllerBase
{
    private readonly IDataProtectionProvider _dataProtection;
    private readonly ShopeeMetadataFetcher _metadataFetcher;

    // Domínios oficiais conhecidos da Shopee — qualquer link fora dessa lista
    // é rejeitado antes de ir para o banco, pra importação em lote/CSV não
    // virar porta de entrada para URLs maliciosas.
    private static readonly string[] DominiosShopeePermitidos =
    {
        "shopee.com.br",
        "shopee.com",
        "s.shopee.com.br",
        "shope.ee",
    };

    private readonly DescobertaShopeeFetcher _descobertaFetcher;
    private readonly ResolvedorLinkAfiliado _resolvedorLink;

    public AfiliadosController(
        AppDbContext context,
        IDataProtectionProvider dataProtection,
        ShopeeMetadataFetcher metadataFetcher,
        DescobertaShopeeFetcher descobertaFetcher,
        ResolvedorLinkAfiliado resolvedorLink) : base(context)
    {
        _dataProtection = dataProtection;
        _metadataFetcher = metadataFetcher;
        _descobertaFetcher = descobertaFetcher;
        _resolvedorLink = resolvedorLink;
    }

    private static bool LinkShopeeValido(string? link)
    {
        if (string.IsNullOrWhiteSpace(link))
            return false;

        if (!Uri.TryCreate(link.Trim(), UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = uri.Host.ToLowerInvariant();
        return DominiosShopeePermitidos.Any(d => host == d || host.EndsWith("." + d));
    }

    // --- Configuração (Id de afiliada + credenciais opcionais da API) ---

    [HttpGet("configuracao")]
    public async Task<IActionResult> ObterConfiguracao(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var config = await Context.ConfiguracoesAfiliados.FirstOrDefaultAsync(c => c.EmpresaId == empresaAutorizada.Value);

        // Nunca devolve AppId/AppSecret — só se cada um está preenchido.
        return Ok(new
        {
            IdAfiliado = config?.IdAfiliado,
            AppIdConfigurado = !string.IsNullOrEmpty(config?.AppIdCriptografado),
            AppSecretConfigurado = !string.IsNullOrEmpty(config?.AppSecretCriptografado),
            ApiOficialHabilitada = config?.ApiOficialHabilitada ?? false,
        });
    }

    [HttpPut("configuracao")]
    public async Task<IActionResult> SalvarConfiguracao(int empresaId, SalvarConfiguracaoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var config = await Context.ConfiguracoesAfiliados.FirstOrDefaultAsync(c => c.EmpresaId == empresaAutorizada.Value);
        if (config is null)
        {
            config = new ConfiguracaoAfiliados { EmpresaId = empresaAutorizada.Value };
            Context.ConfiguracoesAfiliados.Add(config);
        }

        // O Id de afiliada é só rastreio de comissão, não é segredo — guarda em texto puro.
        if (request.IdAfiliado is not null)
            config.IdAfiliado = string.IsNullOrWhiteSpace(request.IdAfiliado) ? null : request.IdAfiliado.Trim();

        // AppId/AppSecret são credenciais reais da API — sempre criptografados,
        // e só sobrescritos quando o usuário de fato manda um valor novo (string
        // vazia explícita remove; null/omitido mantém o que já existia).
        if (request.AppId is not null)
            config.AppIdCriptografado = request.AppId.Length == 0
                ? null
                : CriptografiaUtil.Criptografar(_dataProtection, request.AppId);

        if (request.AppSecret is not null)
            config.AppSecretCriptografado = request.AppSecret.Length == 0
                ? null
                : CriptografiaUtil.Criptografar(_dataProtection, request.AppSecret);

        // A API oficial só pode ficar habilitada quando as duas credenciais
        // existirem — nunca automaticamente, e isso ainda não chama a Shopee:
        // é só o interruptor que os endpoints de integração vão checar quando
        // existirem (ver observação no final do controller).
        config.ApiOficialHabilitada = !string.IsNullOrEmpty(config.AppIdCriptografado)
            && !string.IsNullOrEmpty(config.AppSecretCriptografado);

        config.AtualizadoEm = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        return Ok(new
        {
            IdAfiliado = config.IdAfiliado,
            AppIdConfigurado = !string.IsNullOrEmpty(config.AppIdCriptografado),
            AppSecretConfigurado = !string.IsNullOrEmpty(config.AppSecretCriptografado),
            ApiOficialHabilitada = config.ApiOficialHabilitada,
        });
    }

    // --- Produtos de afiliada ---

    [HttpGet("produtos")]
    public async Task<IActionResult> Listar(
        int empresaId,
        [FromQuery] string? q,
        [FromQuery] decimal? precoMin,
        [FromQuery] decimal? precoMax,
        [FromQuery] int? vendasMin,
        [FromQuery] int? vendasMax,
        [FromQuery] decimal? comissaoPercMin,
        [FromQuery] decimal? comissaoValorMin,
        [FromQuery] string? ordenar,
        [FromQuery] string? direcao)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var consulta = Context.ProdutosAfiliados.AsQueryable();

        // Filtros: produto sem o dado (null) NÃO passa num filtro desse dado —
        // mas vendas == 0 é um valor real e passa, por exemplo, em "vendas até 0".
        if (!string.IsNullOrWhiteSpace(q))
        {
            var termo = q.Trim().ToLower();
            consulta = consulta.Where(p => p.Nome.ToLower().Contains(termo)
                || (p.NomeLoja != null && p.NomeLoja.ToLower().Contains(termo))
                || (p.Categoria != null && p.Categoria.ToLower().Contains(termo)));
        }
        if (precoMin is not null) consulta = consulta.Where(p => p.Preco != null && p.Preco >= precoMin);
        if (precoMax is not null) consulta = consulta.Where(p => p.Preco != null && p.Preco <= precoMax);
        if (vendasMin is not null) consulta = consulta.Where(p => p.Vendas != null && p.Vendas >= vendasMin);
        if (vendasMax is not null) consulta = consulta.Where(p => p.Vendas != null && p.Vendas <= vendasMax);
        if (comissaoPercMin is not null) consulta = consulta.Where(p => p.ComissaoPercentual != null && p.ComissaoPercentual >= comissaoPercMin);
        if (comissaoValorMin is not null) consulta = consulta.Where(p => p.ComissaoValor != null && p.ComissaoValor >= comissaoValorMin);

        var crescente = string.Equals(direcao, "asc", StringComparison.OrdinalIgnoreCase);
        // Ordenação: quem não tem o dado vai sempre pro fim, nunca "empata" com zero.
        IOrderedQueryable<ProdutoAfiliado> ordenada = ordenar switch
        {
            "comissaoPercentual" => crescente
                ? consulta.OrderBy(p => p.ComissaoPercentual == null).ThenBy(p => p.ComissaoPercentual)
                : consulta.OrderBy(p => p.ComissaoPercentual == null).ThenByDescending(p => p.ComissaoPercentual),
            "comissaoValor" => crescente
                ? consulta.OrderBy(p => p.ComissaoValor == null).ThenBy(p => p.ComissaoValor)
                : consulta.OrderBy(p => p.ComissaoValor == null).ThenByDescending(p => p.ComissaoValor),
            "vendas" => crescente
                ? consulta.OrderBy(p => p.Vendas == null).ThenBy(p => p.Vendas)
                : consulta.OrderBy(p => p.Vendas == null).ThenByDescending(p => p.Vendas),
            "preco" => crescente
                ? consulta.OrderBy(p => p.Preco == null).ThenBy(p => p.Preco)
                : consulta.OrderBy(p => p.Preco == null).ThenByDescending(p => p.Preco),
            _ => consulta.OrderByDescending(p => p.DataCadastro),
        };

        var produtos = await ordenada
            .ThenBy(p => p.Id)
            .Select(p => new
            {
                p.Id,
                p.LinkOriginal,
                p.LinkAfiliado,
                p.Nome,
                p.Categoria,
                p.ImagemUrl,
                p.Preco,
                p.NomeLoja,
                p.Vendas,
                p.ComissaoPercentual,
                p.ComissaoValor,
                p.OrigemDados,
                p.DataImportacao,
                Origem = p.Origem.ToString(),
                p.Ativo,
                p.DataCadastro,
                p.DataUltimaAtualizacao,
                PendenciasDados = new[]
                {
                    p.LinkAfiliado == null ? "link de afiliada" : null,
                    p.Preco == null ? "preço" : null,
                    p.ImagemUrl == null ? "imagem" : null,
                }.Where(x => x != null),
                Conteudo = Context.ConteudosAfiliados
                    .Where(c => c.ProdutoAfiliadoId == p.Id)
                    .Select(c => new
                    {
                        c.Id,
                        Abordagem = c.Abordagem.ToString(),
                        c.Roteiro,
                        c.Legenda,
                        c.ChamadaParaCompra,
                        c.Hashtags,
                        Status = c.Status.ToString(),
                        c.DataGeracao,
                    })
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return Ok(produtos);
    }

    [HttpPost("produtos")]
    public async Task<IActionResult> Criar(int empresaId, CriarProdutoAfiliadoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (!LinkShopeeValido(request.LinkOriginal))
            return BadRequest(new { mensagem = "O link original precisa ser um link válido da Shopee (https://shopee.com.br/... ou link curto shope.ee)." });

        if (request.LinkAfiliado is not null && !LinkShopeeValido(request.LinkAfiliado))
            return BadRequest(new { mensagem = "O link de afiliada informado não é um link válido da Shopee." });

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "Informe o nome do produto." });

        if (request.Preco is < 0)
            return BadRequest(new { mensagem = "Preço não pode ser negativo." });

        var jaExiste = await Context.ProdutosAfiliados
            .AnyAsync(p => p.LinkOriginal == request.LinkOriginal.Trim());
        if (jaExiste)
            return BadRequest(new { mensagem = "Esse link já está cadastrado para a sua empresa." });

        var produto = new ProdutoAfiliado
        {
            EmpresaId = empresaAutorizada.Value,
            LinkOriginal = request.LinkOriginal.Trim(),
            LinkAfiliado = request.LinkAfiliado?.Trim(),
            Nome = request.Nome.Trim(),
            Categoria = request.Categoria?.Trim(),
            ImagemUrl = request.ImagemUrl?.Trim(),
            Preco = request.Preco,
            Origem = OrigemProdutoAfiliado.Manual,
        };
        Context.ProdutosAfiliados.Add(produto);
        await Context.SaveChangesAsync();

        return Ok(new { produto.Id });
    }

    [HttpPut("produtos/{produtoId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, int produtoId, AtualizarProdutoAfiliadoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.LinkAfiliado is not null && !LinkShopeeValido(request.LinkAfiliado))
            return BadRequest(new { mensagem = "O link de afiliada informado não é um link válido da Shopee." });

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "Informe o nome do produto." });

        if (request.Preco is < 0)
            return BadRequest(new { mensagem = "Preço não pode ser negativo." });

        var produto = await Context.ProdutosAfiliados.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        produto.LinkAfiliado = request.LinkAfiliado?.Trim();
        produto.Nome = request.Nome.Trim();
        produto.Categoria = request.Categoria?.Trim();
        produto.ImagemUrl = request.ImagemUrl?.Trim();
        produto.Preco = request.Preco;
        produto.Ativo = request.Ativo;
        produto.DataUltimaAtualizacao = DateTime.UtcNow;

        await Context.SaveChangesAsync();
        return Ok(new { produto.Id });
    }

    [HttpDelete("produtos/{produtoId:int}")]
    public async Task<IActionResult> Remover(int empresaId, int produtoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var produto = await Context.ProdutosAfiliados.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        Context.ProdutosAfiliados.Remove(produto);
        await Context.SaveChangesAsync();
        return Ok();
    }

    // Cadastro em lote: cola vários links da Shopee de uma vez. Pra cada link
    // válido e novo, busca nome/imagem/categoria automaticamente (metadados
    // públicos — ver ShopeeMetadataFetcher). Quando a busca falha pra um link
    // específico (timeout, página fora do ar, etc.), o produto ainda é criado
    // — só marcado como pendente de dados, e segue com os demais, sem travar
    // o lote inteiro por causa de um link problemático.
    [HttpPost("produtos/lote")]
    public async Task<IActionResult> CadastrarLote(int empresaId, CadastrarLoteRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.Links is null || request.Links.Count == 0)
            return BadRequest(new { mensagem = "Cole ao menos um link da Shopee." });

        if (request.Links.Count > 50)
            return BadRequest(new { mensagem = "Envie no máximo 50 links por vez (cada um é buscado individualmente, com limite de tempo)." });

        var entradas = request.Links
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .Distinct()
            .ToList();

        // Cada entrada vira (chave loja.item, link de afiliada se for link curto).
        // Link curto de afiliada é resolvido lendo só o 1º redirecionamento.
        var invalidos = new List<string>();
        var porChave = new Dictionary<string, string?>();
        using var limitadorResolucao = new SemaphoreSlim(3);
        var resolucoes = await Task.WhenAll(entradas.Select(async entrada =>
        {
            if (LinkShopee.EhLinkCurto(entrada))
            {
                await limitadorResolucao.WaitAsync();
                try
                {
                    var r = await _resolvedorLink.ResolverAsync(entrada);
                    return (entrada, chave: r?.Chave, afiliada: r is null ? null : entrada);
                }
                finally { limitadorResolucao.Release(); }
            }

            return LinkShopee.TentarExtrairChave(entrada, out var k)
                ? (entrada, chave: (string?)k, afiliada: (string?)null)
                : (entrada, chave: (string?)null, afiliada: (string?)null);
        }));

        foreach (var (entrada, chave, afiliada) in resolucoes)
        {
            if (chave is null) { invalidos.Add(entrada); continue; }
            // O mesmo produto pode vir em vários formatos/links; guarda o 1º link de afiliada visto.
            if (!porChave.TryGetValue(chave, out var atual) || (atual is null && afiliada is not null))
                porChave[chave] = afiliada;
        }

        // Produtos já cadastrados: comparados por loja/item (não pelo texto do link).
        var existentes = (await Context.ProdutosAfiliados.ToListAsync())
            .Select(p => (produto: p, ok: LinkShopee.TentarExtrairChave(p.LinkOriginal, out var k), chave: k))
            .Where(x => x.ok)
            .ToDictionary(x => x.chave, x => x.produto);

        var atualizados = 0;
        var chavesNovas = new List<string>();
        foreach (var (chave, afiliada) in porChave)
        {
            if (existentes.TryGetValue(chave, out var existente))
            {
                // Já existe — só completa o link de afiliada se ainda não tinha.
                if (afiliada is not null && existente.LinkAfiliado is null)
                {
                    existente.LinkAfiliado = afiliada;
                    existente.DataUltimaAtualizacao = DateTime.UtcNow;
                    atualizados++;
                }
            }
            else
            {
                chavesNovas.Add(chave);
            }
        }
        var duplicados = porChave.Count - chavesNovas.Count;

        // No máximo 3 buscas ao mesmo tempo — não sobrecarrega o backend nem
        // parece um ataque de scraping em massa pro servidor da Shopee.
        using var limitador = new SemaphoreSlim(3);
        var tarefas = chavesNovas.Select(async chave =>
        {
            await limitador.WaitAsync();
            try
            {
                var canonico = LinkShopee.Canonico(chave);
                var metadados = await _metadataFetcher.BuscarAsync(canonico);
                return new ProdutoAfiliado
                {
                    EmpresaId = empresaAutorizada.Value,
                    LinkOriginal = canonico,
                    ShopId = LinkShopee.Ids(chave).shopId,
                    ItemId = LinkShopee.Ids(chave).itemId,
                    LinkAfiliado = porChave[chave],
                    Nome = metadados?.Nome ?? "(não foi possível obter o nome automaticamente)",
                    ImagemUrl = metadados?.ImagemUrl,
                    Categoria = metadados?.Categoria,
                    Origem = OrigemProdutoAfiliado.LoteDeLinks,
                };
            }
            finally
            {
                limitador.Release();
            }
        });

        var novos = (await Task.WhenAll(tarefas)).ToList();
        var comDadosCompletos = novos.Count(n => n.ImagemUrl is not null);

        Context.ProdutosAfiliados.AddRange(novos);
        await Context.SaveChangesAsync();

        return Ok(new
        {
            Criados = novos.Count,
            ComDadosAutomaticos = comDadosCompletos,
            SemDadosAutomaticos = novos.Count - comDadosCompletos,
            ComLinkDeAfiliada = novos.Count(n => n.LinkAfiliado is not null),
            Atualizados = atualizados,
            Duplicados = duplicados,
            Invalidos = invalidos,
        });
    }

    // Gera o rascunho de roteiro/legenda/CTA/hashtags pra um produto já
    // cadastrado (texto apenas — o vídeo em si ainda não é montado aqui, ver
    // observação sobre FFmpeg no final do arquivo). Pode ser chamado de novo
    // pra regenerar (ex.: depois de corrigir o nome/categoria manualmente).
    [HttpPost("produtos/{produtoId:int}/preparar-conteudo")]
    public async Task<IActionResult> PrepararConteudo(int empresaId, int produtoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var produto = await Context.ProdutosAfiliados.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        var existente = await Context.ConteudosAfiliados.FirstOrDefaultAsync(c => c.ProdutoAfiliadoId == produtoId);
        var gerado = ConteudoAfiliadoGerador.Gerar(produto, empresaAutorizada.Value);

        if (existente is not null)
        {
            existente.Abordagem = gerado.Abordagem;
            existente.Roteiro = gerado.Roteiro;
            existente.Legenda = gerado.Legenda;
            existente.ChamadaParaCompra = gerado.ChamadaParaCompra;
            existente.Hashtags = gerado.Hashtags;
            existente.Status = gerado.Status;
            existente.MensagemErro = null;
            existente.DataGeracao = DateTime.UtcNow;
        }
        else
        {
            Context.ConteudosAfiliados.Add(gerado);
        }

        await Context.SaveChangesAsync();
        return Ok(new { produtoId, status = gerado.Status.ToString() });
    }

    // Gera conteúdo pra todos os produtos ativos que ainda não têm — usado
    // pelo botão "Preparar conteúdos" em lote na tela.
    [HttpPost("produtos/preparar-conteudo-pendentes")]
    public async Task<IActionResult> PrepararConteudoPendentes(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var idsComConteudo = await Context.ConteudosAfiliados.Select(c => c.ProdutoAfiliadoId).ToListAsync();
        var pendentes = await Context.ProdutosAfiliados
            .Where(p => p.Ativo && !idsComConteudo.Contains(p.Id))
            .ToListAsync();

        foreach (var produto in pendentes)
            Context.ConteudosAfiliados.Add(ConteudoAfiliadoGerador.Gerar(produto, empresaAutorizada.Value));

        await Context.SaveChangesAsync();
        return Ok(new { Preparados = pendentes.Count });
    }

    // Importa o CSV exportado do gerador de links em lote do painel de afiliados
    // (formato real, ver RelatorioShopeeCsv). Os dois links ficam EXATAMENTE como
    // vieram; o mesmo anúncio nunca entra duas vezes (chave loja+item, mesmo que o
    // link venha em outro formato); preço/vendas/comissão são guardados como
    // informação do arquivo, com nome do arquivo e data da importação.
    [HttpPost("produtos/importar-relatorio")]
    public async Task<IActionResult> ImportarRelatorio(int empresaId, ImportarRelatorioRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.ConteudoCsv))
            return BadRequest(new { mensagem = "Envie o conteúdo do arquivo." });

        if (request.ConteudoCsv.Length > 2_000_000)
            return BadRequest(new { mensagem = "Arquivo grande demais (limite de 2 MB)." });

        var leitura = RelatorioShopeeCsv.Ler(request.ConteudoCsv, 500);
        if (leitura.ErroGeral is not null)
            return BadRequest(new { mensagem = leitura.ErroGeral });

        var erros = new List<string>(leitura.Erros);
        var nomeArquivo = string.IsNullOrWhiteSpace(request.NomeArquivo) ? null : Path.GetFileName(request.NomeArquivo.Trim());
        var origemDados = nomeArquivo is null
            ? "Relatório exportado do painel de afiliados da Shopee"
            : $"Relatório exportado do painel de afiliados da Shopee ({nomeArquivo})";
        var agora = DateTime.UtcNow;

        var validas = new List<(LinhaRelatorioShopee Linha, string Chave)>();
        foreach (var l in leitura.Linhas)
        {
            if (!LinkShopee.TentarExtrairChave(l.LinkProduto, out var chave))
            {
                erros.Add($"Linha {l.NumeroLinha}: o Product Link não é um link de produto da Shopee reconhecido.");
                continue;
            }

            var (_, itemDoLink) = LinkShopee.Ids(chave);
            if (itemDoLink?.ToString() != l.ItemId)
            {
                erros.Add($"Linha {l.NumeroLinha}: o Item Id ({l.ItemId}) não bate com o do Product Link ({itemDoLink}).");
                continue;
            }

            if (!LinkShopeeValido(l.LinkOferta))
            {
                erros.Add($"Linha {l.NumeroLinha}: o Offer Link não é um link da Shopee.");
                continue;
            }

            validas.Add((l, chave));
        }

        // Mesmo anúncio repetido no arquivo: vale a primeira linha.
        var vistas = new Dictionary<string, LinhaRelatorioShopee>();
        var duplicadosNoArquivo = 0;
        var linksDeOfertaDiferentes = 0;
        foreach (var (linha, chave) in validas)
        {
            if (vistas.TryGetValue(chave, out var primeira))
            {
                duplicadosNoArquivo++;
                if (primeira.LinkOferta != linha.LinkOferta) linksDeOfertaDiferentes++;
                continue;
            }
            vistas[chave] = linha;
        }

        var existentes = new Dictionary<string, ProdutoAfiliado>();
        foreach (var p in await Context.ProdutosAfiliados.ToListAsync())
        {
            var chaveExistente = p.ShopId is not null && p.ItemId is not null
                ? $"{p.ShopId}.{p.ItemId}"
                : LinkShopee.TentarExtrairChave(p.LinkOriginal, out var k) ? k : null;
            if (chaveExistente is not null)
                existentes[chaveExistente] = p;
        }

        var criados = 0;
        var atualizados = 0;
        foreach (var (chave, l) in vistas)
        {
            var (shopId, itemId) = LinkShopee.Ids(chave);

            if (existentes.TryGetValue(chave, out var existente))
            {
                // Já existe: os links NÃO são tocados (só preenchidos se estavam vazios).
                // Números do arquivo mais novo substituem os antigos — cada um com a data da importação.
                if (existente.LinkAfiliado is null) existente.LinkAfiliado = l.LinkOferta;
                else if (existente.LinkAfiliado != l.LinkOferta) linksDeOfertaDiferentes++;

                existente.ShopId ??= shopId;
                existente.ItemId ??= itemId;
                if (l.Preco is not null) existente.Preco = l.Preco;
                if (l.Vendas is not null) existente.Vendas = l.Vendas;
                if (l.NomeLoja is not null) existente.NomeLoja = l.NomeLoja;
                if (l.ComissaoPercentual is not null) existente.ComissaoPercentual = l.ComissaoPercentual;
                if (l.ComissaoValor is not null) existente.ComissaoValor = l.ComissaoValor;
                existente.OrigemDados = origemDados;
                existente.DataImportacao = agora;
                existente.DataUltimaAtualizacao = agora;
                atualizados++;
                continue;
            }

            Context.ProdutosAfiliados.Add(new ProdutoAfiliado
            {
                EmpresaId = empresaAutorizada.Value,
                LinkOriginal = l.LinkProduto,
                LinkAfiliado = l.LinkOferta,
                Nome = l.Nome,
                ShopId = shopId,
                ItemId = itemId,
                Preco = l.Preco,
                Vendas = l.Vendas,
                NomeLoja = l.NomeLoja,
                ComissaoPercentual = l.ComissaoPercentual,
                ComissaoValor = l.ComissaoValor,
                OrigemDados = origemDados,
                DataImportacao = agora,
                Origem = OrigemProdutoAfiliado.RelatorioShopee,
            });
            criados++;
        }

        await Context.SaveChangesAsync();

        return Ok(new
        {
            Criados = criados,
            Atualizados = atualizados,
            DuplicadosNoArquivo = duplicadosNoArquivo,
            LinksDeOfertaDiferentes = linksDeOfertaDiferentes,
            Erros = erros,
            OrigemDados = origemDados,
            DataImportacao = agora,
        });
    }

    // "Buscar produtos e gerar vídeos": descobre produtos a partir de uma
    // palavra-chave (busca pública, nunca a busca autenticada da Shopee — ver
    // observação 2 no final do arquivo), importa os que ainda não existem e já
    // prepara o conteúdo de texto (roteiro/legenda/hashtags) de cada um.
    [HttpPost("produtos/buscar")]
    public async Task<IActionResult> Buscar(int empresaId, BuscarProdutosRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.PalavraChave))
            return BadRequest(new { mensagem = "Informe uma palavra-chave pra buscar." });

        var quantidadeMaxima = Math.Clamp(request.QuantidadeMaxima <= 0 ? 10 : request.QuantidadeMaxima, 1, 20);

        var limitacoes = new List<string>();

        // Preço: a página pública do produto não expõe preço em lugar nenhum
        // (testado manualmente) — não dá pra filtrar por faixa de preço sem
        // inventar o dado. Avisamos em vez de fingir que filtramos.
        if (request.PrecoMin is not null || request.PrecoMax is not null)
            limitacoes.Add("Faixa de preço não pôde ser aplicada: a página pública do produto não expõe o preço (só disponível com a API oficial da Shopee, ainda não configurada).");

        // Sinais de vendas: idem, sem fonte pública real — cai sempre pra
        // relevância. Nenhum número de vendas é inventado.
        var prioridadeEfetiva = PrioridadeBusca.Relevancia;
        if (request.Prioridade == PrioridadeBusca.SinaisVendas)
            limitacoes.Add("Ordenar por \"sinais de vendas\" exige uma fonte de dados adicional, ainda não disponível. Os resultados abaixo estão ordenados por relevância da busca — nenhum número de vendas foi inventado.");

        // Busca mais candidatos do que o pedido pra sobrar depois de remover
        // duplicados — sem isso, pedir 10 e já ter metade cadastrada devolveria poucos.
        var descoberta = await _descobertaFetcher.BuscarAsync(request.PalavraChave, quantidadeMaxima * 3);
        var candidatosBrutos = descoberta.Candidatos;

        if (descoberta.BloqueadoTemporariamente)
            limitacoes.Add("A busca pública (DuckDuckGo) está temporariamente limitando as requisições — costuma liberar sozinho em minutos. Tente de novo daqui a pouco, ou cadastre os links direto (opção abaixo) enquanto isso.");

        // Comparação por loja/item, não pelo texto do link (o mesmo produto vem
        // em formatos diferentes) — e o link guardado é sempre o canônico.
        var chavesExistentes = (await Context.ProdutosAfiliados.Select(p => p.LinkOriginal).ToListAsync())
            .Select(l => LinkShopee.TentarExtrairChave(l, out var k) ? k : null)
            .Where(k => k is not null)
            .ToHashSet();

        var candidatosNovos = candidatosBrutos
            .Where(c => LinkShopee.TentarExtrairChave(c.LinkOriginal, out var k) && !chavesExistentes.Contains(k))
            .Select(c =>
            {
                LinkShopee.TentarExtrairChave(c.LinkOriginal, out var k);
                return c with { LinkOriginal = LinkShopee.Canonico(k) };
            })
            .Take(quantidadeMaxima)
            .ToList();

        var duplicadosIgnorados = candidatosBrutos.Count - candidatosNovos.Count;

        using var limitador = new SemaphoreSlim(3);
        var tarefas = candidatosNovos.Select(async (candidato, indice) =>
        {
            await limitador.WaitAsync();
            try
            {
                var metadados = await _metadataFetcher.BuscarAsync(candidato.LinkOriginal);
                return (candidato, metadados, indice);
            }
            finally
            {
                limitador.Release();
            }
        });
        var resultados = await Task.WhenAll(tarefas);

        var produtosCriados = new List<ProdutoAfiliado>();
        foreach (var (candidato, metadados, indice) in resultados.OrderBy(r => r.indice))
        {
            // Sem nome, ou o link caiu na home/página genérica da Shopee (produto
            // fora do ar, redirecionado, etc.) em vez da página do produto —
            // em nenhum dos casos dá pra mostrar um card confiável.
            if (metadados?.Nome is null || metadados.Nome.Contains("Shopee Brasil"))
                continue;

            var produto = new ProdutoAfiliado
            {
                EmpresaId = empresaAutorizada.Value,
                LinkOriginal = candidato.LinkOriginal,
                ShopId = LinkShopee.TentarExtrairChave(candidato.LinkOriginal, out var chaveBusca) ? LinkShopee.Ids(chaveBusca).shopId : null,
                ItemId = LinkShopee.TentarExtrairChave(candidato.LinkOriginal, out var chaveBusca2) ? LinkShopee.Ids(chaveBusca2).itemId : null,
                Nome = metadados.Nome,
                ImagemUrl = metadados.ImagemUrl,
                Categoria = metadados.Categoria,
                Origem = OrigemProdutoAfiliado.BuscaAutomatica,
                FonteDescoberta = candidato.Fonte,
                DataConsultaFonte = candidato.DataConsulta,
                MotivoSelecao = $"Encontrado buscando \"{request.PalavraChave}\" — posição {indice + 1} por relevância em {candidato.Fonte}.",
            };
            produtosCriados.Add(produto);
        }

        Context.ProdutosAfiliados.AddRange(produtosCriados);
        await Context.SaveChangesAsync();

        // Já deixa o roteiro/legenda/hashtags prontos pra revisão — é rápido e
        // gratuito (gerador por modelo, sem IA paga). O vídeo em si continua
        // fora daqui: ver observação 3 no final do arquivo.
        var conteudosGerados = new List<ConteudoAfiliado>();
        foreach (var produto in produtosCriados)
        {
            var conteudo = ConteudoAfiliadoGerador.Gerar(produto, empresaAutorizada.Value);
            Context.ConteudosAfiliados.Add(conteudo);
            conteudosGerados.Add(conteudo);
        }
        await Context.SaveChangesAsync();

        if (request.GerarVideosAutomaticamente)
            limitacoes.Add("Geração automática de vídeo por busca ainda não está ligada ao backend (precisa do FFmpeg rodando em algum lugar — ver conversa sobre isso). Prepare os vídeos um a um pela tela normal por enquanto.");

        if (candidatosBrutos.Count == 0 && !descoberta.BloqueadoTemporariamente)
            limitacoes.Add($"A busca por \"{request.PalavraChave}\" não encontrou nenhum link de produto da Shopee indexado publicamente — não significa que não existam produtos, só que não foram encontrados por este meio.");

        return Ok(new
        {
            PalavraChave = request.PalavraChave,
            PrioridadeSolicitada = request.Prioridade.ToString(),
            PrioridadeAplicada = prioridadeEfetiva.ToString(),
            Buscados = candidatosBrutos.Count,
            Importados = produtosCriados.Count,
            DuplicadosIgnorados = duplicadosIgnorados,
            Limitacoes = limitacoes,
            Produtos = produtosCriados.Select((p, i) => new
            {
                p.Id,
                p.LinkOriginal,
                p.Nome,
                p.Categoria,
                p.ImagemUrl,
                p.MotivoSelecao,
                p.FonteDescoberta,
                p.DataConsultaFonte,
                PrecoDisponivel = false,
                Conteudo = new
                {
                    conteudosGerados[i].Roteiro,
                    conteudosGerados[i].Legenda,
                    conteudosGerados[i].ChamadaParaCompra,
                    conteudosGerados[i].Hashtags,
                },
            }),
        });
    }
}

// Observações importantes pra quem for mexer aqui depois:
//
// 1) Integração oficial: a conta informada pelo usuário ainda não tem acesso
//    confirmado ao Shopee Affiliate Open Platform / API de afiliados. Este
//    controller não faz nenhuma chamada autenticada à Shopee — só guarda
//    credenciais (criptografadas) para quando o acesso for confirmado. Nessa
//    hora, a automação de consulta de ofertas/geração de link entra como um
//    novo serviço (ex.: ShopeeApiClient) chamado só quando
//    ConfiguracaoAfiliados.ApiOficialHabilitada == true.
//
// 2) Busca por palavra-chave dentro do site da Shopee: testada e BLOQUEADA.
//    A página de busca/categoria da própria Shopee não entrega a lista de
//    produtos no HTML público (só o "esqueleto" da página — os itens são
//    carregados depois, via chamada interna não documentada, que exige
//    sessão); no navegador, a busca pede login. Por isso o endpoint Buscar
//    (produtos/buscar) usa a busca pública do DuckDuckGo com
//    "site:shopee.com.br <palavra-chave>" — um mecanismo de busca de
//    terceiros consultado pelos resultados que ele mesmo já indexa
//    publicamente, não a Shopee. Cobre só o que esse buscador já indexou
//    pra aquela palavra-chave: não é garantia de achar todos os produtos do
//    nicho (ver DescobertaShopeeFetcher).
//
// 3) Geração de vídeo: os textos (roteiro, legenda, CTA, hashtags) já são
//    gerados automaticamente em PrepararConteudo e em Buscar. A montagem do
//    vídeo em si (FFmpeg) continua fora do backend — não está disponível
//    neste ambiente (nem local, nem confirmado no plano gratuito do Render
//    sem Dockerfile customizado) e não deve rodar dentro do processo da API
//    que atende os clientes em produção. Por isso Buscar aceita
//    GerarVideosAutomaticamente mas nunca executa isso — só avisa na
//    resposta (ver campo Limitacoes).
