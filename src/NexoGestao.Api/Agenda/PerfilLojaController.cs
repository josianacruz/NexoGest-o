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
        // Horário de trabalho é decisão da dona da loja: só o Dono altera.
        var empresaAutorizada = await ObterEmpresaDonoAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var erro = HorarioTrabalho.Validar(request.Dias);
        if (erro is not null)
            return BadRequest(new { mensagem = erro });

        var existentes = await Context.ConfiguracoesDiaSemana.ToListAsync();

        foreach (var dia in request.Dias)
        {
            var registro = existentes.FirstOrDefault(d => d.DiaSemana == dia.DiaSemana);
            if (registro is null)
            {
                registro = new ConfiguracaoDiaSemana { EmpresaId = empresaAutorizada.Value, DiaSemana = dia.DiaSemana };
                Context.ConfiguracoesDiaSemana.Add(registro);
            }

            registro.Ativo = dia.Ativo;
            registro.HoraInicio = dia.HoraInicio;
            registro.HoraFim = dia.HoraFim;
        }

        // A janela "padrão" (usada quando um dia não tem regra própria) acompanha o primeiro dia aberto,
        // para os dois jeitos de ler o horário nunca discordarem.
        var primeiroAberto = request.Dias.Where(d => d.Ativo).OrderBy(d => d.DiaSemana == 0 ? 7 : d.DiaSemana).FirstOrDefault();
        if (primeiroAberto is not null)
        {
            var config = await Context.ConfiguracoesAgenda.FirstOrDefaultAsync(c => c.EmpresaId == empresaId);
            if (config is not null)
            {
                config.HoraInicioAtendimento = primeiroAberto.HoraInicio;
                config.HoraFimAtendimento = primeiroAberto.HoraFim;
            }
        }

        await Context.SaveChangesAsync();

        var salvos = await Context.ConfiguracoesDiaSemana.OrderBy(d => d.DiaSemana).ToListAsync();
        return Ok(salvos.Select(d => new DiaSemanaDto(d.DiaSemana, d.Ativo, d.HoraInicio, d.HoraFim)));
    }
}

// Regras do horário de trabalho (usadas ao salvar e ao conferir um pedido de horário na página pública).
public static class HorarioTrabalho
{
    private static readonly System.Text.RegularExpressions.Regex Hora = new(@"^([01]\d|2[0-3]):[0-5]\d$", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly string[] Nomes = { "domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado" };

    public static bool HoraValida(string? h) => h is not null && Hora.IsMatch(h);

    public static string? Validar(List<DiaSemanaDto>? dias)
    {
        if (dias is null || dias.Count == 0)
            return "Informe o horário de pelo menos um dia.";
        if (dias.Count > 7 || dias.Select(d => d.DiaSemana).Distinct().Count() != dias.Count)
            return "Cada dia da semana só pode aparecer uma vez.";

        foreach (var d in dias)
        {
            if (d.DiaSemana < 0 || d.DiaSemana > 6)
                return "Dia da semana inválido.";
            if (!HoraValida(d.HoraInicio) || !HoraValida(d.HoraFim))
                return $"Horário inválido em {Nomes[d.DiaSemana]}. Use o formato 09:00.";
            if (d.Ativo && string.CompareOrdinal(d.HoraInicio, d.HoraFim) >= 0)
                return $"Em {Nomes[d.DiaSemana]}, o horário de saída precisa ser depois do de entrada.";
        }
        return null;
    }
}
