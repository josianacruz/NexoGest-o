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
    decimal? Preco,
    decimal? ComissaoPercentual);

public record AtualizarProdutoAfiliadoRequest(
    string? LinkAfiliado,
    string Nome,
    string? Categoria,
    string? ImagemUrl,
    decimal? Preco,
    decimal? ComissaoPercentual,
    bool Ativo);

public record CadastrarLoteRequest(List<string> Links);
public record ImportarCsvRequest(string ConteudoCsv);

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

    public AfiliadosController(AppDbContext context, IDataProtectionProvider dataProtection, ShopeeMetadataFetcher metadataFetcher) : base(context)
    {
        _dataProtection = dataProtection;
        _metadataFetcher = metadataFetcher;
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
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        var produtos = await Context.ProdutosAfiliados
            .OrderByDescending(p => p.DataCadastro)
            .Select(p => new
            {
                p.Id,
                p.LinkOriginal,
                p.LinkAfiliado,
                p.Nome,
                p.Categoria,
                p.ImagemUrl,
                p.Preco,
                p.ComissaoPercentual,
                Origem = p.Origem.ToString(),
                p.Ativo,
                p.DataCadastro,
                p.DataUltimaAtualizacao,
                PendenciasDados = new[]
                {
                    p.LinkAfiliado == null ? "link de afiliada" : null,
                    p.Preco == null ? "preço" : null,
                    p.ComissaoPercentual == null ? "comissão" : null,
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

        if (request.Preco is < 0 || request.ComissaoPercentual is < 0)
            return BadRequest(new { mensagem = "Preço e comissão não podem ser negativos." });

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
            ComissaoPercentual = request.ComissaoPercentual,
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

        if (request.Preco is < 0 || request.ComissaoPercentual is < 0)
            return BadRequest(new { mensagem = "Preço e comissão não podem ser negativos." });

        var produto = await Context.ProdutosAfiliados.FirstOrDefaultAsync(p => p.Id == produtoId);
        if (produto is null)
            return NotFound(new { mensagem = "Produto não encontrado." });

        produto.LinkAfiliado = request.LinkAfiliado?.Trim();
        produto.Nome = request.Nome.Trim();
        produto.Categoria = request.Categoria?.Trim();
        produto.ImagemUrl = request.ImagemUrl?.Trim();
        produto.Preco = request.Preco;
        produto.ComissaoPercentual = request.ComissaoPercentual;
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

        var linksNormalizados = request.Links
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .Distinct()
            .ToList();

        var linksInvalidos = linksNormalizados.Where(l => !LinkShopeeValido(l)).ToList();

        var linksExistentes = await Context.ProdutosAfiliados
            .Where(p => linksNormalizados.Contains(p.LinkOriginal))
            .Select(p => p.LinkOriginal)
            .ToListAsync();

        var linksParaCriar = linksNormalizados
            .Except(linksInvalidos)
            .Except(linksExistentes)
            .ToList();

        // No máximo 3 buscas ao mesmo tempo — não sobrecarrega o backend nem
        // parece um ataque de scraping em massa pro servidor da Shopee.
        using var limitador = new SemaphoreSlim(3);
        var tarefas = linksParaCriar.Select(async link =>
        {
            await limitador.WaitAsync();
            try
            {
                var metadados = await _metadataFetcher.BuscarAsync(link);
                return new ProdutoAfiliado
                {
                    EmpresaId = empresaAutorizada.Value,
                    LinkOriginal = link,
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
            Duplicados = linksExistentes.Count,
            Invalidos = linksInvalidos,
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

    // Importação CSV manual: colunas esperadas (cabeçalho obrigatório, nessa ordem)
    // LinkOriginal,LinkAfiliado,Nome,Categoria,ImagemUrl,Preco,ComissaoPercentual
    // LinkAfiliado/ImagemUrl/Preco/ComissaoPercentual podem vir vazios.
    [HttpPost("produtos/importar-csv")]
    public async Task<IActionResult> ImportarCsv(int empresaId, ImportarCsvRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Afiliados);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.ConteudoCsv))
            return BadRequest(new { mensagem = "Envie o conteúdo do CSV." });

        var linhas = request.ConteudoCsv
            .Split('\n')
            .Select(l => l.TrimEnd('\r'))
            .Where(l => l.Length > 0)
            .ToList();

        if (linhas.Count < 2)
            return BadRequest(new { mensagem = "O CSV precisa ter cabeçalho e ao menos uma linha de dados." });

        if (linhas.Count > 501)
            return BadRequest(new { mensagem = "Envie no máximo 500 linhas por importação." });

        var erros = new List<string>();
        var candidatos = new List<ProdutoAfiliado>();

        for (var i = 1; i < linhas.Count; i++)
        {
            var colunas = linhas[i].Split(',').Select(c => c.Trim().Trim('"')).ToArray();
            if (colunas.Length < 3)
            {
                erros.Add($"Linha {i + 1}: faltam colunas (precisa de LinkOriginal, LinkAfiliado, Nome no mínimo).");
                continue;
            }

            var linkOriginal = colunas[0];
            var linkAfiliado = colunas.Length > 1 && colunas[1].Length > 0 ? colunas[1] : null;
            var nome = colunas.Length > 2 ? colunas[2] : "";
            var categoria = colunas.Length > 3 && colunas[3].Length > 0 ? colunas[3] : null;
            var imagemUrl = colunas.Length > 4 && colunas[4].Length > 0 ? colunas[4] : null;
            decimal? preco = colunas.Length > 5 && decimal.TryParse(colunas[5], out var p) ? p : null;
            decimal? comissao = colunas.Length > 6 && decimal.TryParse(colunas[6], out var c) ? c : null;

            if (!LinkShopeeValido(linkOriginal))
            {
                erros.Add($"Linha {i + 1}: link original inválido ou fora do domínio da Shopee.");
                continue;
            }

            if (linkAfiliado is not null && !LinkShopeeValido(linkAfiliado))
            {
                erros.Add($"Linha {i + 1}: link de afiliada inválido ou fora do domínio da Shopee.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(nome))
            {
                erros.Add($"Linha {i + 1}: nome do produto vazio.");
                continue;
            }

            candidatos.Add(new ProdutoAfiliado
            {
                EmpresaId = empresaAutorizada.Value,
                LinkOriginal = linkOriginal,
                LinkAfiliado = linkAfiliado,
                Nome = nome,
                Categoria = categoria,
                ImagemUrl = imagemUrl,
                Preco = preco,
                ComissaoPercentual = comissao,
                Origem = OrigemProdutoAfiliado.Csv,
            });
        }

        var linksCandidatos = candidatos.Select(c => c.LinkOriginal).ToList();
        var linksExistentes = await Context.ProdutosAfiliados
            .Where(p => linksCandidatos.Contains(p.LinkOriginal))
            .Select(p => p.LinkOriginal)
            .ToListAsync();

        // Também evita duplicar dentro do próprio arquivo CSV enviado.
        var vistos = new HashSet<string>();
        var paraCriar = new List<ProdutoAfiliado>();
        var duplicados = 0;
        foreach (var candidato in candidatos)
        {
            if (linksExistentes.Contains(candidato.LinkOriginal) || !vistos.Add(candidato.LinkOriginal))
            {
                duplicados++;
                continue;
            }
            paraCriar.Add(candidato);
        }

        Context.ProdutosAfiliados.AddRange(paraCriar);
        await Context.SaveChangesAsync();

        return Ok(new
        {
            Criados = paraCriar.Count,
            Duplicados = duplicados,
            Erros = erros,
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
// 2) Busca automática de categoria/"mais vendidos": testada e BLOQUEADA.
//    A página de busca/categoria da Shopee não entrega a lista de produtos
//    no HTML público (só o "esqueleto" da página — os itens são carregados
//    depois, via chamada interna não documentada, que exige sessão). Testei
//    com curl simulando um bot de preview (mesmo método usado pra link
//    individual) e a página de categoria retorna sem nenhum item; no
//    navegador, a própria busca pede login. Não implementei nada que chame
//    esse endpoint interno (seria contornar uma restrição, não um "meio
//    permitido"). Por isso o cadastro aqui é só por link colado — que já
//    cobre "pouco trabalho manual" porque nome/imagem/categoria vêm sozinhos.
//
// 3) Geração de vídeo: ainda NÃO implementada. Os textos (roteiro, legenda,
//    CTA, hashtags) já são gerados automaticamente em PrepararConteudo. A
//    montagem do vídeo em si precisa do FFmpeg, que não está disponível
//    neste ambiente (nem local, nem confirmado no plano gratuito do Render
//    sem Dockerfile customizado) — ver relatório entregue ao usuário.
