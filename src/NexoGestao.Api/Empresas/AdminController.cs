using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Empresas;

public record AplicarPerfilRequest(string Perfil);

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

    // Aplica um perfil de acesso (Salao, Loja ou Completo): liga os módulos do perfil e desliga os demais.
    // Afiliados nunca é mexido aqui (continua de ligação explícita). Nada é apagado: só muda o que aparece e o que a API libera.
    [HttpPut("empresas/{empresaId:int}/perfil")]
    public async Task<IActionResult> AplicarPerfil(int empresaId, AplicarPerfilRequest request)
    {
        if (!EhAdmin)
            return Forbid();

        if (request.Perfil is null || !PerfisDeAcesso.Modulos.TryGetValue(request.Perfil, out var doPerfil))
            return BadRequest(new { mensagem = "Perfil inválido. Use Salao, Loja ou Completo." });

        var empresa = await _context.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId);
        if (empresa is null)
            return NotFound(new { mensagem = "Empresa não encontrada." });

        var existentes = await _context.ModulosEmpresa.Where(m => m.EmpresaId == empresaId).ToListAsync();
        foreach (var modulo in ModulosPadrao.TodosOsModulos.Where(m => m != Modulo.Afiliados))
        {
            var ligar = doPerfil.Contains(modulo);
            var linha = existentes.FirstOrDefault(m => m.Modulo == modulo);
            if (linha is null)
                _context.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = empresaId, Modulo = modulo, Habilitado = ligar });
            else
                linha.Habilitado = ligar;
        }

        var nicho = PerfisDeAcesso.NichoDoPerfil(request.Perfil);
        if (nicho is not null)
            empresa.Nicho = nicho;

        await _context.SaveChangesAsync();

        var ligados = await _context.ModulosEmpresa.Where(m => m.EmpresaId == empresaId && m.Habilitado).Select(m => m.Modulo).ToListAsync();
        return Ok(new { empresaId, Perfil = PerfisDeAcesso.Inferir(ligados), Modulos = ligados.Select(m => m.ToString()).ToList() });
    }
}
