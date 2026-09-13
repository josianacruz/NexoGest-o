using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Clientes;

public record CriarClienteRequest(string Nome, string? Telefone, string? Email);
public record AtualizarClienteRequest(string Nome, string? Telefone, string? Email);

[ApiController]
[Route("api/empresas/{empresaId:int}/clientes")]
[Authorize]
public class ClientesController : TenantControllerBase
{
    public ClientesController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarClienteRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Clientes);
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
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Clientes);
        if (empresaAutorizada is null)
            return Forbid();

        var hoje = DateTime.UtcNow.Date;

        var clientes = await Context.Clientes
            .OrderBy(c => c.Nome)
            .Select(c => new
            {
                c.Id,
                c.Nome,
                c.Telefone,
                c.Email,
                SaldoDevedor = Context.Vendas
                    .Where(v => v.ClienteId == c.Id && v.SaldoDevedor != null)
                    .Sum(v => v.SaldoDevedor),
                TotalPendente = Context.ContasReceber
                    .Where(cr => cr.ClienteId == c.Id && cr.Status == StatusContaReceber.Pendente)
                    .Sum(cr => (decimal?)cr.ValorPendente) ?? 0,
                TotalVencido = Context.ContasReceber
                    .Where(cr => cr.ClienteId == c.Id && cr.Status == StatusContaReceber.Pendente && cr.DataVencimento < hoje)
                    .Sum(cr => (decimal?)cr.ValorPendente) ?? 0,
                ProximoVencimento = Context.ContasReceber
                    .Where(cr => cr.ClienteId == c.Id && cr.Status == StatusContaReceber.Pendente)
                    .OrderBy(cr => cr.DataVencimento)
                    .Select(cr => (DateTime?)cr.DataVencimento)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return Ok(clientes);
    }

    [HttpGet("{clienteId:int}/contas-receber")]
    public async Task<IActionResult> ContasReceberDoCliente(int empresaId, int clienteId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Clientes);
        if (empresaAutorizada is null)
            return Forbid();

        var hoje = DateTime.UtcNow.Date;

        var contas = await Context.ContasReceber
            .Where(c => c.ClienteId == clienteId)
            .OrderBy(c => c.DataVencimento)
            .Select(c => new
            {
                c.Id,
                c.VendaId,
                c.ValorOriginal,
                c.ValorPendente,
                c.DataVencimento,
                c.DataPagamento,
                c.Status,
            })
            .ToListAsync();

        var comStatus = contas.Select(c => new
        {
            c.Id,
            c.VendaId,
            c.ValorOriginal,
            c.ValorPendente,
            c.DataVencimento,
            c.DataPagamento,
            Status = c.Status == StatusContaReceber.Pago
                ? "PAGO"
                : c.DataVencimento.Date < hoje ? "VENCIDO" : "PENDENTE",
        });

        return Ok(comStatus);
    }

    [HttpPut("{clienteId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, int clienteId, AtualizarClienteRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Clientes);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do cliente é obrigatório." });

        var cliente = await Context.Clientes.FirstOrDefaultAsync(c => c.Id == clienteId);
        if (cliente is null)
            return NotFound(new { mensagem = "Cliente não encontrado." });

        cliente.Nome = request.Nome;
        cliente.Telefone = request.Telefone;
        cliente.Email = request.Email;

        await Context.SaveChangesAsync();

        return Ok(new { cliente.Id, cliente.Nome });
    }
}
