using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Afiliados;

public record CriarCredencialWorkerRequest(string? Nome);

// Lado do USUÁRIO (Dono, logado) para gerenciar o worker local da própria empresa:
// criar a credencial (o token aparece uma única vez), ver se o worker está conectado e revogar.
[ApiController]
[Route("api/empresas/{empresaId:int}/afiliados/worker")]
[Authorize]
public class WorkerGestaoController : TenantControllerBase
{
    public WorkerGestaoController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Estado(int empresaId)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var limite = DateTime.UtcNow.AddMinutes(-2);
        var credenciais = await Context.WorkerCredenciais
            .Where(c => c.RevogadaEm == null)
            .OrderByDescending(c => c.Id)
            .Select(c => new
            {
                c.Id,
                c.Nome,
                c.Prefixo,
                c.CriadaEm,
                c.UltimoContato,
                Online = c.UltimoContato != null && c.UltimoContato >= limite,
                c.Maquina,
                c.Versao,
                c.Pasta,
                c.EspacoUsadoBytes,
                c.EspacoLivreBytes,
            })
            .ToListAsync();

        return Ok(new { Credenciais = credenciais });
    }

    [HttpPost("credenciais")]
    public async Task<IActionResult> Criar(int empresaId, CriarCredencialWorkerRequest request)
    {
        var empresa = await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados);
        if (empresa is null)
            return Forbid();

        // Limite simples: poucas credenciais ativas por empresa.
        if (await Context.WorkerCredenciais.CountAsync(c => c.RevogadaEm == null) >= 5)
            return BadRequest(new { mensagem = "Já existem 5 credenciais ativas. Revogue uma antes de criar outra." });

        var token = "nxw_" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var nome = string.IsNullOrWhiteSpace(request.Nome) ? "Worker" : request.Nome.Trim();
        var credencial = new WorkerCredencial
        {
            EmpresaId = empresa.Value,
            Nome = nome[..Math.Min(60, nome.Length)],
            TokenHash = WorkerController.HashDoToken(token),
            Prefixo = token[..8],
        };
        Context.WorkerCredenciais.Add(credencial);
        await Context.SaveChangesAsync();

        // O token completo só existe nesta resposta; depois só o hash fica guardado.
        return Ok(new { credencial.Id, credencial.Nome, credencial.Prefixo, Token = token });
    }

    [HttpDelete("credenciais/{credencialId:int}")]
    public async Task<IActionResult> Revogar(int empresaId, int credencialId)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Afiliados) is null)
            return Forbid();

        var credencial = await Context.WorkerCredenciais.FirstOrDefaultAsync(c => c.Id == credencialId && c.RevogadaEm == null);
        if (credencial is null)
            return NotFound(new { mensagem = "Credencial não encontrada." });

        credencial.RevogadaEm = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return Ok(new { credencial.Id });
    }
}
