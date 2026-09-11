using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace NexoGestao.Api.Empresas;

public record CriarEmpresaRequest(string Nome, string? Segmento);

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
        var empresa = new Empresa
        {
            Nome = request.Nome,
            Segmento = request.Segmento
        };
        _context.Empresas.Add(empresa);

        var membro = new MembroEmpresa
        {
            UsuarioId = UsuarioId,
            Empresa = empresa,
            Papel = PapelUsuario.Dono
        };
        _context.MembrosEmpresa.Add(membro);

        await _context.SaveChangesAsync();

        return Ok(new { empresa.Id, empresa.Nome });
    }

    [HttpGet("minhas")]
    public async Task<IActionResult> Minhas()
    {
        var empresas = await _context.MembrosEmpresa
            .Where(m => m.UsuarioId == UsuarioId)
            .Select(m => new { m.Empresa.Id, m.Empresa.Nome, Papel = m.Papel.ToString() })
            .ToListAsync();

        return Ok(empresas);
    }
}
