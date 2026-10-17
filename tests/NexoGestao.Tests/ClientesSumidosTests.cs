using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Clientes;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using Xunit;

namespace NexoGestao.Tests;

// "Clientes que sumiram": quem já veio e não volta há muito tempo, com telefone e sem horário marcado.
public class ClientesSumidosTests
{
    private static string Json(object? v) => System.Text.Json.JsonSerializer.Serialize(v, new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    private static ClientesController Como(AppDbContext db, string usuario) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
        },
    };

    private static async Task<AppDbContext> Cenario()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Studio" });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Outra" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dona", EmpresaId = 1, Papel = PapelUsuario.Dono });
        await db.SaveChangesAsync();
        return db;
    }

    private static Agendamento Ag(int clienteId, int diasAtras, StatusAgendamento status = StatusAgendamento.Concluido, int empresa = 1) =>
        new() { EmpresaId = empresa, ClienteId = clienteId, ServicoNome = "Corte", DataHora = DateTime.UtcNow.AddDays(-diasAtras), DuracaoMinutos = 60, Valor = 50, Status = status };

    [Fact]
    public async Task Lista_so_quem_ja_veio_ha_mais_de_N_dias_tem_telefone_e_nao_tem_horario_marcado()
    {
        var db = await Cenario();
        var sumida = new Cliente { EmpresaId = 1, Nome = "Sumida", Telefone = "11999990001" };
        var recente = new Cliente { EmpresaId = 1, Nome = "Recente", Telefone = "11999990002" };
        var semTelefone = new Cliente { EmpresaId = 1, Nome = "Sem Telefone" };
        var comHorario = new Cliente { EmpresaId = 1, Nome = "Com Horario", Telefone = "11999990003" };
        var nuncaVeio = new Cliente { EmpresaId = 1, Nome = "Nunca Veio", Telefone = "11999990004" };
        var faltou = new Cliente { EmpresaId = 1, Nome = "So Faltou", Telefone = "11999990005" };
        var outraEmpresa = new Cliente { EmpresaId = 2, Nome = "De Outra", Telefone = "11999990006" };
        db.Clientes.AddRange(sumida, recente, semTelefone, comHorario, nuncaVeio, faltou, outraEmpresa);
        await db.SaveChangesAsync();
        db.Agendamentos.AddRange(
            Ag(sumida.Id, 90), Ag(recente.Id, 10), Ag(semTelefone.Id, 90), Ag(comHorario.Id, 90),
            Ag(faltou.Id, 90, StatusAgendamento.Faltou), Ag(outraEmpresa.Id, 90, empresa: 2));
        db.Agendamentos.Add(new Agendamento { EmpresaId = 1, ClienteId = comHorario.Id, ServicoNome = "Corte", DataHora = DateTime.UtcNow.AddDays(3), DuracaoMinutos = 60, Valor = 50, Status = StatusAgendamento.Agendado });
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await Como(db, "dona").Sumidos(1, 45));
        var j = Json(ok.Value);
        Assert.Contains("Sumida", j);
        foreach (var fora in new[] { "Recente", "Sem Telefone", "Com Horario", "Nunca Veio", "So Faltou", "De Outra" })
            Assert.DoesNotContain(fora, j);
    }

    [Fact]
    public async Task Compra_antiga_tambem_conta_como_visita_e_o_limite_de_dias_e_respeitado()
    {
        var db = await Cenario();
        var c = new Cliente { EmpresaId = 1, Nome = "Compradora", Telefone = "11999990007" };
        db.Clientes.Add(c);
        await db.SaveChangesAsync();
        db.Vendas.Add(new Venda { EmpresaId = 1, ClienteId = c.Id, Data = DateTime.UtcNow.AddDays(-60), Total = 100 });
        await db.SaveChangesAsync();

        Assert.Contains("Compradora", Json(Assert.IsType<OkObjectResult>(await Como(db, "dona").Sumidos(1, 45)).Value));
        Assert.DoesNotContain("Compradora", Json(Assert.IsType<OkObjectResult>(await Como(db, "dona").Sumidos(1, 90)).Value));
    }

    [Fact]
    public async Task So_membro_da_empresa_ve_a_lista()
    {
        var db = await Cenario();
        Assert.IsType<ForbidResult>(await Como(db, "estranho").Sumidos(1, 45));
    }
}
