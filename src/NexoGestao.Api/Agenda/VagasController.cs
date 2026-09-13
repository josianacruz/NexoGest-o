using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Agenda;

public record CriarVagaRequest(DateTime Data, string Hora);

// Lado autenticado: o profissional gera o link exclusivo de uma vaga (data+hora
// travadas). A validação/consumo do link é toda no AgendamentoPublicoController.
[ApiController]
[Route("api/empresas/{empresaId:int}/agenda/vagas")]
[Authorize]
public class VagasController : TenantControllerBase
{
    public VagasController(AppDbContext context) : base(context) { }

    private static string GerarToken()
    {
        // 24 bytes aleatórios (192 bits) — não é um Id sequencial, impossível de adivinhar.
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
    }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarVagaRequest request)
    {
        var empresaAutorizada = await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Agenda);
        if (empresaAutorizada is null)
            return Forbid();

        var partes = request.Hora.Split(':');
        var dataHora = DateTime.SpecifyKind(
            request.Data.Date.AddHours(int.Parse(partes[0])).AddMinutes(int.Parse(partes[1])),
            DateTimeKind.Utc);

        var vaga = new VagaDivulgada
        {
            EmpresaId = empresaAutorizada.Value,
            Token = GerarToken(),
            DataHora = dataHora,
        };
        Context.VagasDivulgadas.Add(vaga);
        await Context.SaveChangesAsync();

        return Ok(new { vaga.Token, vaga.DataHora });
    }
}
