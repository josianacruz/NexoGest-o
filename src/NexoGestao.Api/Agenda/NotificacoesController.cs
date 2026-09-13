using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

[ApiController]
[Route("api/empresas/{empresaId:int}/notificacoes")]
[Authorize]
public class NotificacoesController : TenantControllerBase
{
    public NotificacoesController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var notificacoes = await Context.Notificacoes
            .OrderByDescending(n => n.DataCriacao)
            .Take(50)
            .Select(n => new
            {
                n.Id,
                n.Titulo,
                n.ClienteNome,
                n.ServicoNome,
                n.DataHoraAgendamento,
                n.AgendamentoId,
                n.Lida,
                n.DataCriacao,
            })
            .ToListAsync();

        return Ok(notificacoes);
    }

    [HttpGet("nao-lidas")]
    public async Task<IActionResult> ContagemNaoLidas(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var quantidade = await Context.Notificacoes.CountAsync(n => !n.Lida);
        return Ok(new { quantidade });
    }

    [HttpPut("{notificacaoId:int}/marcar-lida")]
    public async Task<IActionResult> MarcarLida(int empresaId, int notificacaoId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId);
        if (empresaAutorizada is null)
            return Forbid();

        var notificacao = await Context.Notificacoes.FirstOrDefaultAsync(n => n.Id == notificacaoId);
        if (notificacao is null)
            return NotFound();

        notificacao.Lida = true;
        await Context.SaveChangesAsync();

        return Ok(new { notificacao.Id, notificacao.Lida });
    }
}
