using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record DiaSemanaDto(int DiaSemana, bool Ativo, string HoraInicio, string HoraFim);
public record SalvarPerfilLojaRequest(List<DiaSemanaDto> Dias);

// Padrão quando a empresa ainda não configurou nada: seg-sáb 08:00-18:00, domingo fechado.
file static class PerfilPadrao
{
    public static List<DiaSemanaDto> Gerar() =>
        Enumerable.Range(0, 7)
            .Select(dia => new DiaSemanaDto(dia, dia != 0, "08:00", "18:00"))
            .ToList();
}

[ApiController]
[Route("api/empresas/{empresaId:int}/agenda/perfil")]
[Authorize]
public class PerfilLojaController : TenantControllerBase
{
    public PerfilLojaController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Obter(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var configurados = await Context.ConfiguracoesDiaSemana
            .OrderBy(d => d.DiaSemana)
            .ToListAsync();

        if (configurados.Count == 0)
            return Ok(PerfilPadrao.Gerar());

        return Ok(configurados.Select(d => new DiaSemanaDto(d.DiaSemana, d.Ativo, d.HoraInicio, d.HoraFim)));
    }

    [HttpPut]
    public async Task<IActionResult> Salvar(int empresaId, SalvarPerfilLojaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var existentes = await Context.ConfiguracoesDiaSemana.ToListAsync();

        foreach (var dia in request.Dias)
        {
            if (dia.DiaSemana < 0 || dia.DiaSemana > 6)
                continue;

            var registro = existentes.FirstOrDefault(d => d.DiaSemana == dia.DiaSemana);
            if (registro is null)
            {
                registro = new ConfiguracaoDiaSemana { EmpresaId = empresaAutorizada.Value, DiaSemana = dia.DiaSemana };
                Context.ConfiguracoesDiaSemana.Add(registro);
            }

            registro.Ativo = dia.Ativo;
            registro.HoraInicio = string.IsNullOrWhiteSpace(dia.HoraInicio) ? "08:00" : dia.HoraInicio;
            registro.HoraFim = string.IsNullOrWhiteSpace(dia.HoraFim) ? "18:00" : dia.HoraFim;
        }

        await Context.SaveChangesAsync();

        return Ok(await Obter(empresaId));
    }
}
