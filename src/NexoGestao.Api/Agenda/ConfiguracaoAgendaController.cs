using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record ConfiguracaoAgendaRequest(
    int HorasAntesLembrete,
    int HorasMinimasCancelamento,
    bool CobrarCancelamentoForaPrazo);

[ApiController]
[Route("api/empresas/{empresaId:int}/agenda/configuracao")]
[Authorize]
public class ConfiguracaoAgendaController : TenantControllerBase
{
    public ConfiguracaoAgendaController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Obter(int empresaId)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var config = await Context.ConfiguracoesAgenda.FirstOrDefaultAsync(c => c.EmpresaId == empresaId);

        // Sem configuração salva ainda: devolve os padrões (nada de cobrança
        // automática até a empresa decidir habilitar).
        return Ok(new
        {
            horasAntesLembrete = config?.HorasAntesLembrete ?? 24,
            horasMinimasCancelamento = config?.HorasMinimasCancelamento ?? 24,
            cobrarCancelamentoForaPrazo = config?.CobrarCancelamentoForaPrazo ?? false,
        });
    }

    [HttpPut]
    public async Task<IActionResult> Salvar(int empresaId, ConfiguracaoAgendaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        if (request.HorasAntesLembrete < 0 || request.HorasMinimasCancelamento < 0)
            return BadRequest(new { mensagem = "As horas informadas não podem ser negativas." });

        var config = await Context.ConfiguracoesAgenda.FirstOrDefaultAsync(c => c.EmpresaId == empresaId);
        if (config is null)
        {
            config = new ConfiguracaoAgenda { EmpresaId = empresaAutorizada.Value };
            Context.ConfiguracoesAgenda.Add(config);
        }

        config.HorasAntesLembrete = request.HorasAntesLembrete;
        config.HorasMinimasCancelamento = request.HorasMinimasCancelamento;
        config.CobrarCancelamentoForaPrazo = request.CobrarCancelamentoForaPrazo;

        await Context.SaveChangesAsync();

        return Ok(new
        {
            config.HorasAntesLembrete,
            config.HorasMinimasCancelamento,
            config.CobrarCancelamentoForaPrazo,
        });
    }
}
