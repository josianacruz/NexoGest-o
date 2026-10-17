using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Empresas;

public record AplicarPerfilRequest(string Perfil);
public record AlterarAcessoRequest(int? Dias, bool Ilimitado = false);

// Console da administradora máster (Admin:Emails): vê todas as empresas e define o perfil de acesso de cada uma.
// Qualquer outra pessoa recebe 403, mesmo logada.
[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuracao;

    public AdminController(AppDbContext context, IConfiguration configuracao)
    {
        _context = context;
        _configuracao = configuracao;
    }

    private bool EhAdmin => AdminMaster.Eh(User, _configuracao);

    [HttpGet("empresas")]
    public async Task<IActionResult> Listar()
    {
        if (!EhAdmin)
            return Forbid();

        var linhas = await _context.Empresas
            .AsNoTracking()
            .OrderBy(e => e.Nome)
            .Select(e => new
            {
                e.Id,
                e.Nome,
                e.TipoNegocio,
                e.Nicho,
                e.DataCriacao,
                Ligados = e.Modulos.Where(m => m.Habilitado).Select(m => m.Modulo).ToList(),
                TemConfiguracao = e.Modulos.Any(),
                Donos = _context.MembrosEmpresa
                    .Where(m => m.EmpresaId == e.Id && m.Papel == PapelUsuario.Dono)
                    .Join(_context.Users, m => m.UsuarioId, u => u.Id, (m, u) => u.Email)
                    .ToList(),
            })
            .ToListAsync();

        return Ok(linhas.Select(e =>
        {
            var ligados = e.TemConfiguracao ? e.Ligados : ModulosPadrao.LiberadosSemConfiguracao.ToList();
            return new
            {
                e.Id,
                e.Nome,
                TipoNegocio = e.TipoNegocio?.ToString(),
                Nicho = (e.Nicho ?? Nichos.Padrao(e.TipoNegocio)).ToString(),
                e.DataCriacao,
                Perfil = PerfisDeAcesso.Inferir(ligados),
                Modulos = ligados.Select(m => m.ToString()).ToList(),
                e.Donos,
            };
        }));
    }

    // Uso do servidor: quanto do banco gratuito está ocupado e o que cada empresa consome (para você se antecipar antes
    // de o limite estourar). Só números: nada de dados de clientes finais.
    [HttpGet("uso")]
    public async Task<IActionResult> Uso()
    {
        if (!EhAdmin)
            return Forbid();

        var agora = DateTime.UtcNow;
        var clientes = await _context.Clientes.IgnoreQueryFilters().GroupBy(c => c.EmpresaId).Select(g => new { Id = g.Key, N = g.Count(), Ultima = g.Max(c => (DateTime?)c.DataCadastro) }).ToDictionaryAsync(x => x.Id);
        var produtos = await _context.Produtos.IgnoreQueryFilters().GroupBy(p => p.EmpresaId).Select(g => new { Id = g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Id);
        var servicos = await _context.Servicos.IgnoreQueryFilters().GroupBy(p => p.EmpresaId).Select(g => new { Id = g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Id);
        var vendas = await _context.Vendas.IgnoreQueryFilters().GroupBy(v => v.EmpresaId).Select(g => new { Id = g.Key, N = g.Count(), Ultima = g.Max(v => (DateTime?)v.Data) }).ToDictionaryAsync(x => x.Id);
        var agendamentos = await _context.Agendamentos.IgnoreQueryFilters().GroupBy(a => a.EmpresaId).Select(g => new { Id = g.Key, N = g.Count(), Ultima = g.Max(a => (DateTime?)a.DataCriacao) }).ToDictionaryAsync(x => x.Id);
        var fotos = await _context.MidiasLoja.IgnoreQueryFilters().GroupBy(m => m.EmpresaId).Select(g => new { Id = g.Key, N = g.Count(), Bytes = g.Sum(m => (long)m.Dados.Length) }).ToDictionaryAsync(x => x.Id);

        var empresas = await _context.Empresas.AsNoTracking().OrderByDescending(e => e.DataCriacao)
            .Select(e => new
            {
                e.Id,
                e.Nome,
                e.TipoNegocio,
                e.DataCriacao,
                e.AcessoAte,
                Donos = _context.MembrosEmpresa.Where(m => m.EmpresaId == e.Id && m.Papel == PapelUsuario.Dono)
                    .Join(_context.Users, m => m.UsuarioId, u => u.Id, (m, u) => u.Email).ToList(),
            })
            .ToListAsync();

        var linhas = empresas.Select(e =>
        {
            clientes.TryGetValue(e.Id, out var c);
            vendas.TryGetValue(e.Id, out var v);
            agendamentos.TryGetValue(e.Id, out var a);
            fotos.TryGetValue(e.Id, out var f);
            var ultima = new[] { c?.Ultima, v?.Ultima, a?.Ultima }.Max();
            return new
            {
                e.Id,
                e.Nome,
                TipoNegocio = e.TipoNegocio?.ToString(),
                e.DataCriacao,
                DiasDeTesteRestantes = TesteGratis.DiasRestantes(e.AcessoAte, agora),
                SemLimite = e.AcessoAte == null,
                e.Donos,
                Clientes = c?.N ?? 0,
                Produtos = produtos.TryGetValue(e.Id, out var p) ? p.N : 0,
                Servicos = servicos.TryGetValue(e.Id, out var s) ? s.N : 0,
                Vendas = v?.N ?? 0,
                Agendamentos = a?.N ?? 0,
                Fotos = f?.N ?? 0,
                FotosBytes = f?.Bytes ?? 0L,
                UltimaAtividade = ultima,
            };
        }).ToList();

        return Ok(new
        {
            BancoBytes = await LimitesDoServidor.TamanhoDoBancoAsync(_context),
            BancoLimiteBytes = LimitesDoServidor.BancoMaxBytes(_configuracao),
            TotalEmpresas = linhas.Count,
            TotalUsuarios = await _context.Users.CountAsync(),
            MaxUsuarios = LimitesDoServidor.MaxUsuarios(_configuracao),
            NovasEm7Dias = linhas.Count(l => l.DataCriacao > agora.AddDays(-7)),
            AlertaNoCelularConfigurado = !string.IsNullOrWhiteSpace(_configuracao["Alertas:NtfyTopico"]),
            Empresas = linhas,
        });
    }

    // Prazo de acesso da empresa: soma dias ao teste (a partir de hoje, ou do fim atual se ainda não venceu) ou libera sem limite.
    [HttpPut("empresas/{empresaId:int}/acesso")]
    public async Task<IActionResult> AlterarAcesso(int empresaId, AlterarAcessoRequest request)
    {
        if (!EhAdmin)
            return Forbid();

        var empresa = await _context.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId);
        if (empresa is null)
            return NotFound(new { mensagem = "Empresa não encontrada." });

        var agora = DateTime.UtcNow;
        if (request.Ilimitado)
            empresa.AcessoAte = null;
        else if (request.Dias is >= 1 and <= 3650)
            empresa.AcessoAte = (empresa.AcessoAte is { } fim && fim > agora ? fim : agora).AddDays(request.Dias.Value);
        else
            return BadRequest(new { mensagem = "Informe de 1 a 3650 dias, ou libere sem limite." });

        await _context.SaveChangesAsync();
        HttpContext?.RequestServices?.GetService<Microsoft.Extensions.Caching.Memory.IMemoryCache>()?.Remove(TesteGratis.ChaveDeCache(empresaId));
        return Ok(new { empresaId, empresa.AcessoAte, DiasRestantes = TesteGratis.DiasRestantes(empresa.AcessoAte, agora) });
    }

    // Aplica um perfil de acesso (Salao, Loja, Alimentacao, ServicosGerais ou Completo): liga os módulos do perfil e desliga os demais.
    // Afiliados nunca é mexido aqui (continua de ligação explícita). Nada é apagado: só muda o que aparece e o que a API libera.
    [HttpPut("empresas/{empresaId:int}/perfil")]
    public async Task<IActionResult> AplicarPerfil(int empresaId, AplicarPerfilRequest request)
    {
        if (!EhAdmin)
            return Forbid();

        if (request.Perfil is null || !PerfisDeAcesso.Modulos.TryGetValue(request.Perfil, out var doPerfil))
            return BadRequest(new { mensagem = "Perfil inválido. Use Salao, Loja, Alimentacao, ServicosGerais ou Completo." });

        var empresa = await _context.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId);
        if (empresa is null)
            return NotFound(new { mensagem = "Empresa não encontrada." });

        await AplicadorDePerfil.AplicarAsync(_context, empresa, request.Perfil);

        var ligados = await _context.ModulosEmpresa.Where(m => m.EmpresaId == empresaId && m.Habilitado).Select(m => m.Modulo).ToListAsync();
        return Ok(new { empresaId, Perfil = PerfisDeAcesso.Inferir(ligados), Modulos = ligados.Select(m => m.ToString()).ToList() });
    }
}
