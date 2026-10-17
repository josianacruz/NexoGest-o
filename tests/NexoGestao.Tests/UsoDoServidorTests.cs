using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Empresas;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// Painel de uso do servidor (administradora) e limites que protegem o plano gratuito.
public class UsoDoServidorTests
{
    private static string Json(object? v) => System.Text.Json.JsonSerializer.Serialize(v, new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    private static IConfiguration Config(params (string, string)[] itens) =>
        new ConfigurationBuilder().AddInMemoryCollection(itens.ToDictionary(i => i.Item1, i => (string?)i.Item2)).Build();

    private static AdminController Painel(AppDbContext db, string email, string admins)
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "u1"), new Claim(ClaimTypes.Email, email) }, "teste"));
        return new AdminController(db, Config(("Admin:Emails", admins))) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } } };
    }

    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task So_a_administradora_ve_o_uso()
    {
        var db = Banco();
        Assert.IsType<ForbidResult>(await Painel(db, "cliente@x.com", "josiana@x.com").Uso());
        Assert.IsType<OkObjectResult>(await Painel(db, "josiana@x.com", "josiana@x.com").Uso());
    }

    [Fact]
    public async Task Uso_conta_por_empresa_sem_misturar_e_sem_expor_dados_de_clientes()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Studio Um", DataCriacao = DateTime.UtcNow.AddDays(-3) });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Loja Dois", DataCriacao = DateTime.UtcNow.AddDays(-40) });
        db.Clientes.AddRange(
            new Cliente { EmpresaId = 1, Nome = "Maria Segredo", Telefone = "11999990001" },
            new Cliente { EmpresaId = 1, Nome = "Ana Segredo", Telefone = "11999990002" },
            new Cliente { EmpresaId = 2, Nome = "Bia Segredo", Telefone = "11999990003" });
        db.Servicos.Add(new Servico { EmpresaId = 1, Nome = "Corte", DuracaoMinutos = 60, Preco = 50, Ativo = true });
        db.MidiasLoja.Add(new MidiaLoja { EmpresaId = 2, Nome = "f", Dados = new byte[1000], Miniatura = "x", Hash = "h1" });
        db.MidiasLoja.Add(new MidiaLoja { EmpresaId = 2, Nome = "g", Dados = new byte[500], Miniatura = "x", Hash = "h2" });
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await Painel(db, "josiana@x.com", "josiana@x.com").Uso());
        var j = Json(ok.Value);

        Assert.Contains("\"TotalEmpresas\":2", j);
        Assert.Contains("\"NovasEm7Dias\":1", j);
        Assert.Contains("\"MaxUsuarios\":100", j);
        Assert.Contains("\"BancoLimiteBytes\":536870912", j);
        Assert.Contains("\"FotosBytes\":1500", j);
        Assert.Contains("\"DiasDeTesteRestantes\":11", j);   // criada há 3 dias
        Assert.Contains("\"DiasDeTesteRestantes\":0", j);    // criada há 40 dias
        Assert.DoesNotContain("Segredo", j);                  // nome de clientes finais nunca aparece
        Assert.DoesNotContain("11999990001", j);
    }

    [Theory]
    [InlineData(99, null, false)]
    [InlineData(100, null, true)]     // padrão: 100 contas
    [InlineData(101, null, true)]
    [InlineData(9, "10", false)]
    [InlineData(10, "10", true)]
    [InlineData(500, "lixo", true)]   // valor inválido volta ao padrão (100)
    public void Cadastros_fecham_ao_atingir_o_limite_configurado(int total, string? limite, bool fechado) =>
        Assert.Equal(fechado, LimitesDoServidor.CadastrosFechados(total, limite is null ? Config() : Config(("Limites:MaxUsuarios", limite))));

    [Fact]
    public void Limite_do_banco_vem_da_configuracao_ou_do_plano_gratis()
    {
        Assert.Equal(512L * 1024 * 1024, LimitesDoServidor.BancoMaxBytes(Config()));
        Assert.Equal(1_000_000, LimitesDoServidor.BancoMaxBytes(Config(("Limites:BancoMaxBytes", "1000000"))));
        Assert.Equal(512L * 1024 * 1024, LimitesDoServidor.BancoMaxBytes(Config(("Limites:BancoMaxBytes", "-5"))));
    }

    [Fact]
    public async Task Tamanho_do_banco_em_banco_de_teste_devolve_nulo_sem_quebrar()
    {
        Assert.Null(await LimitesDoServidor.TamanhoDoBancoAsync(Banco()));
    }
}
