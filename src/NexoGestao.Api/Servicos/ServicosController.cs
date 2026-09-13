using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Servicos;

public record CriarServicoRequest(string Nome, int DuracaoMinutos, decimal Preco, bool PermiteAutoagendamento = false);
public record AtualizarServicoRequest(string Nome, int DuracaoMinutos, decimal Preco, bool PermiteAutoagendamento = false);

[ApiController]
[Route("api/empresas/{empresaId:int}/servicos")]
[Authorize]
public class ServicosController : TenantControllerBase
{
    public ServicosController(AppDbContext context) : base(context) { }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarServicoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Servicos);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do serviço é obrigatório." });

        if (request.DuracaoMinutos <= 0)
            return BadRequest(new { mensagem = "A duração deve ser maior que zero." });

        var servico = new Servico
        {
            EmpresaId = empresaAutorizada.Value,
            Nome = request.Nome,
            DuracaoMinutos = request.DuracaoMinutos,
            Preco = request.Preco,
            PermiteAutoagendamento = request.PermiteAutoagendamento,
        };
        Context.Servicos.Add(servico);
        await Context.SaveChangesAsync();

        return Ok(new { servico.Id, servico.Nome, servico.DuracaoMinutos, servico.Preco, servico.PermiteAutoagendamento });
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Servicos);
        if (empresaAutorizada is null)
            return Forbid();

        var servicos = await Context.Servicos
            .Where(s => s.Ativo)
            .OrderBy(s => s.Nome)
            .Select(s => new { s.Id, s.Nome, s.DuracaoMinutos, s.Preco, s.PermiteAutoagendamento })
            .ToListAsync();

        return Ok(servicos);
    }

    [HttpPut("{servicoId:int}")]
    public async Task<IActionResult> Atualizar(int empresaId, int servicoId, AtualizarServicoRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Servicos);
        if (empresaAutorizada is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { mensagem = "O nome do serviço é obrigatório." });

        if (request.DuracaoMinutos <= 0)
            return BadRequest(new { mensagem = "A duração deve ser maior que zero." });

        var servico = await Context.Servicos.FirstOrDefaultAsync(s => s.Id == servicoId);
        if (servico is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });

        servico.Nome = request.Nome;
        servico.DuracaoMinutos = request.DuracaoMinutos;
        servico.Preco = request.Preco;
        servico.PermiteAutoagendamento = request.PermiteAutoagendamento;
        await Context.SaveChangesAsync();

        return Ok(new { servico.Id, servico.Nome, servico.DuracaoMinutos, servico.Preco, servico.PermiteAutoagendamento });
    }

    [HttpDelete("{servicoId:int}")]
    public async Task<IActionResult> Remover(int empresaId, int servicoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Servicos);
        if (empresaAutorizada is null)
            return Forbid();

        var servico = await Context.Servicos.FirstOrDefaultAsync(s => s.Id == servicoId);
        if (servico is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });

        // Soft delete — agendamentos antigos continuam com o nome/preço gravados,
        // então não precisa (nem deve) apagar o histórico.
        servico.Ativo = false;
        await Context.SaveChangesAsync();

        return Ok(new { removido = true });
    }
}
