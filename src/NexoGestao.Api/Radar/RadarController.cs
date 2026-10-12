using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Radar;

public record SalvarConsultaRadarRequest(string Nome, string PalavraChave, OrdenacaoRadar Ordenacao,
    decimal? ComissaoMinimaPercentual, int MaximoProdutos, bool Ativa = true);

public record RadarAtivoRequest(bool Ativo);

// Radar Shopee do ponto de vista do Dono: o que será consultado todo dia, se a rotina está ligada,
// o histórico de execuções e a variação dos números. A atualização em si só roda com credenciais da API oficial.
[ApiController]
[Route("api/empresas/{empresaId:int}/afiliados/radar")]
[Authorize]
public class RadarController : TenantControllerBase
{
    private readonly RadarService _radar;
    private readonly IServiceScopeFactory _escopos;
    private readonly ShopeeAffiliateOptions _opcoes;

    public RadarController(AppDbContext context, RadarService radar, IServiceScopeFactory escopos, IOptions<ShopeeAffiliateOptions> opcoes)
        : base(context)
    {
        _radar = radar;
        _escopos = escopos;
        _opcoes = opcoes.Value;
    }

    [HttpGet]
    public async Task<IActionResult> Estado(int empresaId)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var config = await Context.ConfiguracoesAfiliados.FirstOrDefaultAsync();
        var cred = await _radar.ObterCredenciaisAsync();
        var consultas = await Context.RadarConsultas.OrderBy(c => c.Id)
            .Select(c => new { c.Id, c.Nome, c.PalavraChave, Ordenacao = c.Ordenacao.ToString(), c.ComissaoMinimaPercentual, c.MaximoProdutos, c.Ativa })
            .ToListAsync();
        var ultima = await Context.RadarExecucoes.OrderByDescending(e => e.Id).Select(e => new
        {
            e.Id, e.Origem, e.Inicio, e.Fim, Status = e.Status.ToString(), e.Consultas, e.Chamadas, e.Consultados, e.Novos, e.Atualizados, e.Mensagem,
        }).FirstOrDefaultAsync();

        return Ok(new
        {
            RadarAtivo = config?.RadarAtivo ?? false,
            CredenciaisConfiguradas = cred is not null,
            FonteCredenciais = cred?.Origem,
            Agendamento = "Todos os dias às 08:00 (Brasília), quando o Radar está ligado e há credenciais da API oficial.",
            AgendadorInterno = _opcoes.AgendadorInternoHabilitado,
            GatilhoExternoConfigurado = !string.IsNullOrWhiteSpace(_opcoes.ChaveAgendador),
            Consultas = consultas,
            UltimaExecucao = ultima,
            Aviso = cred is null
                ? "A API oficial da Shopee ainda não está configurada (precisa do App ID e do Secret aprovados pela Shopee). Enquanto isso, importe o CSV do painel de afiliados."
                : null,
        });
    }

    [HttpPut("ativo")]
    public async Task<IActionResult> DefinirAtivo(int empresaId, RadarAtivoRequest request)
    {
        var empresa = await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados);
        if (empresa is null)
            return Forbid();

        if (request.Ativo && await _radar.ObterCredenciaisAsync() is null)
            return BadRequest(new { mensagem = "Configure o App ID e o Secret da API oficial antes de ligar a atualização diária." });

        var config = await Context.ConfiguracoesAfiliados.FirstOrDefaultAsync();
        if (config is null)
        {
            config = new ConfiguracaoAfiliados { EmpresaId = empresa.Value };
            Context.ConfiguracoesAfiliados.Add(config);
        }
        config.RadarAtivo = request.Ativo;
        config.AtualizadoEm = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return Ok(new { config.RadarAtivo });
    }

    [HttpPost("consultas")]
    public async Task<IActionResult> CriarConsulta(int empresaId, SalvarConsultaRadarRequest request)
    {
        var empresa = await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados);
        if (empresa is null)
            return Forbid();

        var erro = Validar(request);
        if (erro is not null) return BadRequest(new { mensagem = erro });
        if (await Context.RadarConsultas.CountAsync() >= 20)
            return BadRequest(new { mensagem = "Limite de 20 consultas por empresa." });

        var c = new RadarConsulta { EmpresaId = empresa.Value };
        Aplicar(c, request);
        Context.RadarConsultas.Add(c);
        await Context.SaveChangesAsync();
        return Ok(new { c.Id });
    }

    [HttpPut("consultas/{consultaId:int}")]
    public async Task<IActionResult> AtualizarConsulta(int empresaId, int consultaId, SalvarConsultaRadarRequest request)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var erro = Validar(request);
        if (erro is not null) return BadRequest(new { mensagem = erro });
        var c = await Context.RadarConsultas.FirstOrDefaultAsync(x => x.Id == consultaId);
        if (c is null) return NotFound(new { mensagem = "Consulta não encontrada." });

        Aplicar(c, request);
        await Context.SaveChangesAsync();
        return Ok(new { c.Id });
    }

    [HttpDelete("consultas/{consultaId:int}")]
    public async Task<IActionResult> RemoverConsulta(int empresaId, int consultaId)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var c = await Context.RadarConsultas.FirstOrDefaultAsync(x => x.Id == consultaId);
        if (c is null) return NotFound(new { mensagem = "Consulta não encontrada." });
        Context.RadarConsultas.Remove(c); // os produtos já salvos permanecem
        await Context.SaveChangesAsync();
        return Ok(new { c.Id });
    }

    // Atualização manual: roda em segundo plano (pode levar alguns minutos) e a tela acompanha o histórico.
    [HttpPost("executar")]
    public async Task<IActionResult> Executar(int empresaId)
    {
        var empresa = await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados);
        if (empresa is null)
            return Forbid();

        if (await _radar.ObterCredenciaisAsync() is null)
            return BadRequest(new { mensagem = "A API oficial da Shopee ainda não está configurada (App ID e Secret). Nada foi consultado." });

        var corte = DateTime.UtcNow.AddMinutes(-30);
        if (await Context.RadarExecucoes.AnyAsync(e => e.Status == StatusExecucaoRadar.Executando && e.Inicio > corte))
            return Conflict(new { mensagem = "Já existe uma atualização em andamento." });

        var id = empresa.Value;
        _ = Task.Run(async () =>
        {
            using var escopo = _escopos.CreateScope();
            try { await escopo.ServiceProvider.GetRequiredService<RadarService>().ExecutarAsync(id, "manual", CancellationToken.None); }
            catch (RadarOcupadoException) { }
        });
        return Accepted(new { mensagem = "Atualização iniciada. Acompanhe o histórico." });
    }

    [HttpGet("execucoes")]
    public async Task<IActionResult> Execucoes(int empresaId)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var lista = await Context.RadarExecucoes.OrderByDescending(e => e.Id).Take(15).Select(e => new
        {
            e.Id, e.Origem, e.Inicio, e.Fim, Status = e.Status.ToString(), e.Consultas, e.Chamadas, e.Consultados, e.Novos, e.Atualizados, e.Mensagem,
        }).ToListAsync();
        return Ok(lista);
    }

    // Variação observada entre as fotos diárias do próprio Nexo (nunca estimada). Só aparece com 2+ consultas no período.
    [HttpGet("variacoes")]
    public async Task<IActionResult> Variacoes(int empresaId, [FromQuery] int dias = 7)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        dias = Math.Clamp(dias, 1, 60);
        var desde = DateTime.UtcNow.AddDays(-dias);
        var fotos = await Context.ProdutoAfiliadoSnapshots.Where(s => s.DataConsulta >= desde)
            .OrderBy(s => s.DataConsulta)
            .Select(s => new { s.ProdutoAfiliadoId, s.DataConsulta, s.Vendas, s.Preco, s.ComissaoPercentual })
            .ToListAsync();

        var resultado = fotos.GroupBy(f => f.ProdutoAfiliadoId)
            .Where(g => g.Count() >= 2)
            .Select(g =>
            {
                var primeira = g.First();
                var ultima = g.Last();
                return new
                {
                    ProdutoId = g.Key,
                    De = primeira.DataConsulta,
                    Ate = ultima.DataConsulta,
                    VariacaoVendas = primeira.Vendas is not null && ultima.Vendas is not null ? ultima.Vendas - primeira.Vendas : null,
                    VariacaoPreco = primeira.Preco is not null && ultima.Preco is not null ? ultima.Preco - primeira.Preco : null,
                    VariacaoComissaoPercentual = primeira.ComissaoPercentual is not null && ultima.ComissaoPercentual is not null
                        ? ultima.ComissaoPercentual - primeira.ComissaoPercentual : null,
                };
            })
            .ToList();
        return Ok(resultado);
    }

    private static string? Validar(SalvarConsultaRadarRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Nome) || r.Nome.Trim().Length > 60) return "Informe um nome de até 60 caracteres.";
        if (string.IsNullOrWhiteSpace(r.PalavraChave) || r.PalavraChave.Trim().Length > 100) return "Informe a palavra-chave (até 100 caracteres).";
        if (!Enum.IsDefined(r.Ordenacao)) return "Ordenação inválida.";
        if (r.MaximoProdutos is < 1 or > 500) return "O máximo de produtos deve estar entre 1 e 500.";
        if (r.ComissaoMinimaPercentual is < 0 or > 100) return "A comissão mínima deve estar entre 0 e 100.";
        return null;
    }

    private static void Aplicar(RadarConsulta c, SalvarConsultaRadarRequest r)
    {
        c.Nome = r.Nome.Trim();
        c.PalavraChave = r.PalavraChave.Trim();
        c.Ordenacao = r.Ordenacao;
        c.ComissaoMinimaPercentual = r.ComissaoMinimaPercentual;
        c.MaximoProdutos = r.MaximoProdutos;
        c.Ativa = r.Ativa;
    }
}

// Gatilho EXTERNO da rotina diária (GitHub Actions agendado, ver .github/workflows/radar-diario.yml).
// Protegido por chave própria (Shopee__Affiliate__ChaveAgendador), comparada em tempo constante.
// Sem a chave configurada no servidor, o endpoint responde 404 (como se não existisse).
[ApiController]
[Route("api/interno/radar")]
[AllowAnonymous]
[EnableRateLimiting("publico")]
public class RadarGatilhoController : ControllerBase
{
    private readonly ShopeeAffiliateOptions _opcoes;
    private readonly IServiceScopeFactory _escopos;

    public RadarGatilhoController(IOptions<ShopeeAffiliateOptions> opcoes, IServiceScopeFactory escopos)
    {
        _opcoes = opcoes.Value;
        _escopos = escopos;
    }

    [HttpPost("executar-agendadas")]
    public IActionResult ExecutarAgendadas()
    {
        if (string.IsNullOrWhiteSpace(_opcoes.ChaveAgendador))
            return NotFound();

        var enviada = Request.Headers["X-Cron-Key"].ToString();
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(enviada));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(_opcoes.ChaveAgendador));
        if (!CryptographicOperations.FixedTimeEquals(a, b))
            return Unauthorized(new { mensagem = "Chave inválida." });

        // Responde na hora (o servidor grátis pode demorar a acordar) e processa em segundo plano.
        _ = Task.Run(async () =>
        {
            using var escopo = _escopos.CreateScope();
            await escopo.ServiceProvider.GetRequiredService<RadarService>().ExecutarAgendadasAsync(CancellationToken.None);
        });
        return Accepted(new { mensagem = "Rotina diária disparada." });
    }
}
