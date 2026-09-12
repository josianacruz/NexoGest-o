using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Clientes;

public record CriarClienteRequest(string Nome, string? Telefone, string? Email);

[ApiController]
[Route("api/empresas/{empresaId:int}/clientes")]
[Authorize]
public class ClientesController : TenantControllerBase
{
    public ClientesController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarClienteRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do cliente é obrigatório." });

        var cliente = new Cliente
        {
            EmpresaId = empresaAutorizada.Value,
            Nome = request.Nome,
            Telefone = request.Telefone,
            Email = request.Email
        };
        Context.Clientes.Add(cliente);
        await Context.SaveChangesAsync();

        return Ok(new { cliente.Id, cliente.Nome });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var clientes = await Context.Clientes
            .OrderBy(c => c.Nome)
            .Select(c => new { c.Id, c.Nome, c.Telefone, c.Email })
            .ToListAsync();

        return Ok(clientes);
    }
}
