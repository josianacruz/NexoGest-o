using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace NexoGestao.Api.Empresas;

public record CriarEmpresaRequest(string Nome, string? Segmento, bool ComandasHabilitadas = true, TipoNegocio? TipoNegocio = null);
public record AtualizarEmpresaRequest(bool ComandasHabilitadas, string? Nome = null, string? Nicho = null, string? WhatsApp = null);
public record ModuloConfigDto(string Modulo, bool Habilitado);
public record AtualizarModulosRequest(List<ModuloConfigDto> Modulos);

[ApiController]
[Route("api/empresas")]
[Authorize]
public class EmpresasController : ControllerBase
{
    private readonly AppDbContext _context;

    public EmpresasController(AppDbContext context)
    {
        _context = context;
    }

    private bool EhAdminMaster => AdminMaster.Eh(User, HttpContext?.RequestServices?.GetService<IConfiguration>());

    private string UsuarioId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new InvalidOperationException("Usuário não autenticado.");

    [HttpPost]
    public async Task<IActionResult> Criar(CriarEmpresaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome da empresa é obrigatório." });

        var empresa = new Empresa
        {
            Nome = request.Nome,
            Segmento = request.Segmento,
            ComandasHabilitadas = request.ComandasHabilitadas,
            TipoNegocio = request.TipoNegocio,
        };
        _context.Empresas.Add(empresa);

        var membro = new MembroEmpresa
        {
            UsuarioId = UsuarioId,
            Empresa = empresa,
            Papel = PapelUsuario.Dono
        };
        _context.MembrosEmpresa.Add(membro);

        // Sem TipoNegocio informado, a empresa fica sem linhas em ModulosEmpresa —
        // o que, por design (ver TenantControllerBase), equivale a "todos os módulos
        // liberados". Com TipoNegocio, já nasce só com os módulos daquele segmento.
        if (request.TipoNegocio is not null && ModulosPadrao.PorTipoNegocio.TryGetValue(request.TipoNegocio.Value, out var modulos))
        {
            foreach (var modulo in modulos)
            {
                _context.ModulosEmpresa.Add(new ModuloEmpresa { Empresa = empresa, Modulo = modulo, Habilitado = true });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { empresa.Id, empresa.Nome });
    }

    [HttpGet("minhas")]
    public async Task<IActionResult> Minhas()
    {
        var admin = EhAdminMaster;
        var usuarioId = UsuarioId;

        // Administrador máster: todas as empresas do sistema (a dela primeiro; as demais com papel "Admin" = modo suporte).
        // Usuário comum: só as empresas de que é membro.
        var empresas = admin
            ? await _context.Empresas
                .Select(e => new
                {
                    e.Id,
                    e.Nome,
                    e.ComandasHabilitadas,
                    e.TipoNegocio,
                    e.Nicho,
                    e.WhatsApp,
                    Papel = _context.MembrosEmpresa.Where(m => m.EmpresaId == e.Id && m.UsuarioId == usuarioId).Select(m => m.Papel.ToString()).FirstOrDefault() ?? "Admin",
                    ModulosHabilitados = e.Modulos.Where(mo => mo.Habilitado).Select(mo => mo.Modulo).ToList(),
                    TemConfiguracaoDeModulos = e.Modulos.Any(),
                })
                .OrderBy(e => e.Papel == "Admin").ThenBy(e => e.Nome)
                .ToListAsync()
            : await _context.MembrosEmpresa
                .Where(m => m.UsuarioId == usuarioId)
                .Select(m => new
                {
                    m.Empresa.Id,
                    m.Empresa.Nome,
                    m.Empresa.ComandasHabilitadas,
                    m.Empresa.TipoNegocio,
                    m.Empresa.Nicho,
                    m.Empresa.WhatsApp,
                    Papel = m.Papel.ToString(),
                    ModulosHabilitados = m.Empresa.Modulos.Where(mo => mo.Habilitado).Select(mo => mo.Modulo).ToList(),
                    TemConfiguracaoDeModulos = m.Empresa.Modulos.Any(),
                })
                .ToListAsync();

        // Empresa sem nenhuma linha em ModulosEmpresa (criada antes desse recurso, ou
        // criada sem TipoNegocio) mantém tudo liberado — não quebra o que já existia.
        var todosOsModulos = ModulosPadrao.TodosOsModulos.Select(m => m.ToString()).ToList();
        var resultado = empresas.Select(e =>
        {
            var reais = (e.TemConfiguracaoDeModulos ? e.ModulosHabilitados : ModulosPadrao.LiberadosSemConfiguracao.ToList()).ToList();
            return new
            {
                e.Id,
                e.Nome,
                e.ComandasHabilitadas,
                TipoNegocio = e.TipoNegocio?.ToString(),
                Nicho = (e.Nicho ?? Nichos.Padrao(e.TipoNegocio)).ToString(),
                e.WhatsApp,
                e.Papel,
                EhAdmin = admin,
                // O que a empresa realmente tem ligado (é o que a cliente enxerga)…
                ModulosDaEmpresa = reais.Select(m => m.ToString()).ToList(),
                // …e o que ESTA pessoa pode usar: tudo, para o administrador máster; o mesmo da empresa, para os demais.
                Modulos = admin ? todosOsModulos : reais.Select(m => m.ToString()).ToList(),
            };
        });

        return Ok(resultado);
    }

    [HttpPut("{empresaId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, AtualizarEmpresaRequest request)
    {
        var membro = await _context.MembrosEmpresa
            .FirstOrDefaultAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaId);

        if (!EhAdminMaster && (membro is null || membro.Papel != PapelUsuario.Dono))
            return Forbid();

        var empresa = await _context.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId);
        if (empresa is null)
            return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Nicho))
        {
            if (!Enum.TryParse<NichoLoja>(request.Nicho, true, out var nicho) || !Enum.IsDefined(nicho))
                return BadRequest(new { mensagem = "Nicho inválido." });
            empresa.Nicho = nicho;
        }

        // WhatsApp da loja: nulo = não mexe; texto vazio = apaga; senão precisa ser um número brasileiro válido.
        if (request.WhatsApp is not null)
        {
            if (string.IsNullOrWhiteSpace(request.WhatsApp))
                empresa.WhatsApp = null;
            else if (WhatsAppUtil.Normalizar(request.WhatsApp) is { } numero)
                empresa.WhatsApp = numero;
            else
                return BadRequest(new { mensagem = "WhatsApp inválido. Use o DDD e o número, por exemplo (11) 91234-5678." });
        }

        empresa.ComandasHabilitadas = request.ComandasHabilitadas;
        if (!string.IsNullOrWhiteSpace(request.Nome))
            empresa.Nome = request.Nome.Trim();
        await _context.SaveChangesAsync();

        return Ok(new { empresa.Id, empresa.Nome, empresa.ComandasHabilitadas, Nicho = Nichos.Efetivo(empresa).ToString(), empresa.WhatsApp });
    }

    // Endpoint preparado para o futuro painel administrativo da plataforma definir os
    // módulos de cada empresa. Por ora, só o Dono da própria empresa pode chamá-lo —
    // não há papel de "admin da plataforma" ainda, então isso fica restrito por enquanto.
    [HttpPut("{empresaId:int}/modulos")]
    public async Task<IActionResult> AtualizarModulos(int empresaId, AtualizarModulosRequest request)
    {
        var membro = await _context.MembrosEmpresa
            .FirstOrDefaultAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaId);

        if (!EhAdminMaster && (membro is null || membro.Papel != PapelUsuario.Dono))
            return Forbid();

        foreach (var item in request.Modulos)
        {
            if (!Enum.TryParse<Modulo>(item.Modulo, ignoreCase: true, out var modulo))
                continue;

            var existente = await _context.ModulosEmpresa
                .FirstOrDefaultAsync(m => m.EmpresaId == empresaId && m.Modulo == modulo);

            if (existente is null)
                _context.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = empresaId, Modulo = modulo, Habilitado = item.Habilitado });
            else
                existente.Habilitado = item.Habilitado;
        }

        await _context.SaveChangesAsync();

        var modulosAtuais = await _context.ModulosEmpresa
            .Where(m => m.EmpresaId == empresaId && m.Habilitado)
            .Select(m => m.Modulo.ToString())
            .ToListAsync();

        return Ok(new { empresaId, modulos = modulosAtuais });
    }
}
