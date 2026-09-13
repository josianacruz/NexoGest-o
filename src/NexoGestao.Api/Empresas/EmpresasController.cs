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
public record AtualizarEmpresaRequest(bool ComandasHabilitadas);
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
        var empresas = await _context.MembrosEmpresa
            .Where(m => m.UsuarioId == UsuarioId)
            .Select(m => new
            {
                m.Empresa.Id,
                m.Empresa.Nome,
                m.Empresa.ComandasHabilitadas,
                TipoNegocio = m.Empresa.TipoNegocio,
                Papel = m.Papel.ToString(),
                ModulosHabilitados = m.Empresa.Modulos.Where(mo => mo.Habilitado).Select(mo => mo.Modulo).ToList(),
                TemConfiguracaoDeModulos = m.Empresa.Modulos.Any(),
            })
            .ToListAsync();

        // Empresa sem nenhuma linha em ModulosEmpresa (criada antes desse recurso, ou
        // criada sem TipoNegocio) mantém tudo liberado — não quebra o que já existia.
        var resultado = empresas.Select(e => new
        {
            e.Id,
            e.Nome,
            e.ComandasHabilitadas,
            TipoNegocio = e.TipoNegocio?.ToString(),
            e.Papel,
            Modulos = (e.TemConfiguracaoDeModulos ? e.ModulosHabilitados : ModulosPadrao.TodosOsModulos.ToList())
                .Select(m => m.ToString())
                .ToList(),
        });

        return Ok(resultado);
    }

    [HttpPut("{empresaId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, AtualizarEmpresaRequest request)
    {
        var membro = await _context.MembrosEmpresa
            .FirstOrDefaultAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaId);

        if (membro is null || membro.Papel != PapelUsuario.Dono)
            return Forbid();

        var empresa = await _context.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId);
        if (empresa is null)
            return NotFound();

        empresa.ComandasHabilitadas = request.ComandasHabilitadas;
        await _context.SaveChangesAsync();

        return Ok(new { empresa.Id, empresa.ComandasHabilitadas });
    }

    // Endpoint preparado para o futuro painel administrativo da plataforma definir os
    // módulos de cada empresa. Por ora, só o Dono da própria empresa pode chamá-lo —
    // não há papel de "admin da plataforma" ainda, então isso fica restrito por enquanto.
    [HttpPut("{empresaId:int}/modulos")]
    public async Task<IActionResult> AtualizarModulos(int empresaId, AtualizarModulosRequest request)
    {
        var membro = await _context.MembrosEmpresa
            .FirstOrDefaultAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaId);

        if (membro is null || membro.Papel != PapelUsuario.Dono)
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
