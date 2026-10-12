using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Stories;
using Xunit;

namespace NexoGestao.Tests;

// Stories da loja: só o Dono publica/apaga, cada empresa vê só os seus, a vitrine pública mostra só o que está no ar.
public class StoriesTests
{
    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static StoriesController Como(AppDbContext db, string usuario) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
        },
    };

    private static async Task<AppDbContext> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Loja Um | frase" });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Loja Dois" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono1", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "atendente1", EmpresaId = 1, Papel = PapelUsuario.Atendente });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono2", EmpresaId = 2, Papel = PapelUsuario.Dono });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Dono_publica_e_a_novidade_expira_em_24_horas()
    {
        var db = await Cenario();
        var r = await Como(db, "dono1").Criar(1, new CriarStoryRequest("Promocao", "  Corte com 20% hoje  "));

        Assert.IsType<OkObjectResult>(r);
        var s = await db.StoriesLoja.IgnoreQueryFilters().SingleAsync();
        Assert.Equal("Corte com 20% hoje", s.Texto);
        Assert.Equal(TipoStory.Promocao, s.Tipo);
        Assert.InRange((s.ExpiraEm - s.DataCriacao).TotalHours, 23.99, 24.01);
    }

    [Fact]
    public async Task Quem_nao_e_dono_nao_publica_nem_apaga_mas_pode_ver()
    {
        var db = await Cenario();
        Assert.IsType<ForbidResult>(await Como(db, "atendente1").Criar(1, new CriarStoryRequest("Novidade", "Oi")));

        await Como(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", "Chegou coisa nova"));
        var id = (await db.StoriesLoja.IgnoreQueryFilters().SingleAsync()).Id;

        Assert.IsType<ForbidResult>(await Como(db, "atendente1").Apagar(1, id));
        Assert.Equal(1, await db.StoriesLoja.IgnoreQueryFilters().CountAsync());

        var lista = Assert.IsType<OkObjectResult>(await Como(db, "atendente1").Listar(1));
        Assert.Single((System.Collections.IEnumerable)lista.Value!);
    }

    [Fact]
    public async Task Dono_de_outra_empresa_nao_mexe_nos_stories_alheios()
    {
        var db = await Cenario();
        await Como(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", "Só da loja um"));
        var id = (await db.StoriesLoja.IgnoreQueryFilters().SingleAsync()).Id;

        Assert.IsType<ForbidResult>(await Como(db, "dono2").Apagar(1, id));
        Assert.IsType<ForbidResult>(await Como(db, "dono2").Listar(1));
        // Pela própria empresa, o filtro por empresa também esconde o story da outra.
        Assert.IsType<NotFoundResult>(await Como(db, "dono2").Apagar(2, id));
        Assert.Equal(1, await db.StoriesLoja.IgnoreQueryFilters().CountAsync());
    }

    [Theory]
    [InlineData("Novidade", "")]
    [InlineData("Novidade", "   ")]
    [InlineData("Invalido", "texto")]
    public async Task Rejeita_tipo_invalido_ou_texto_vazio(string tipo, string texto)
    {
        var db = await Cenario();
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dono1").Criar(1, new CriarStoryRequest(tipo, texto)));
        Assert.Empty(await db.StoriesLoja.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Rejeita_texto_acima_do_limite_e_aceita_exatamente_o_limite()
    {
        var db = await Cenario();
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", new string('a', StoryLoja.MaxTexto + 1))));
        Assert.IsType<OkObjectResult>(await Como(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", new string('a', StoryLoja.MaxTexto))));
    }

    [Fact]
    public async Task No_maximo_dez_no_ar_e_expirados_antigos_sao_limpos()
    {
        var db = await Cenario();
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "velho", DataCriacao = DateTime.UtcNow.AddDays(-9), ExpiraEm = DateTime.UtcNow.AddDays(-8) });
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "expirou ontem", DataCriacao = DateTime.UtcNow.AddDays(-2), ExpiraEm = DateTime.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();

        var dono = Como(db, "dono1");
        for (var i = 0; i < 10; i++)
            Assert.IsType<OkObjectResult>(await dono.Criar(1, new CriarStoryRequest("Novidade", $"n{i}")));

        Assert.IsType<BadRequestObjectResult>(await dono.Criar(1, new CriarStoryRequest("Novidade", "a 11ª")));
        var textos = await db.StoriesLoja.IgnoreQueryFilters().Select(s => s.Texto).ToListAsync();
        Assert.DoesNotContain("velho", textos);          // passou de uma semana: removido
        Assert.Contains("expirou ontem", textos);        // recente: mantido (só não aparece nas listas)
    }

    [Fact]
    public async Task Vitrine_publica_mostra_so_o_que_esta_no_ar_da_empresa_pedida()
    {
        var db = await Cenario();
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "no ar", Tipo = TipoStory.Lembrete, ExpiraEm = DateTime.UtcNow.AddHours(5) });
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "expirado", ExpiraEm = DateTime.UtcNow.AddHours(-1) });
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 2, Texto = "de outra loja", ExpiraEm = DateTime.UtcNow.AddHours(5) });
        await db.SaveChangesAsync();

        var publico = new StoriesPublicosController(db);
        var ok = Assert.IsType<OkObjectResult>(await publico.Listar(1));
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("no ar", json);
        Assert.Contains("Loja Um | frase", json);
        Assert.DoesNotContain("expirado", json);
        Assert.DoesNotContain("de outra loja", json);
        Assert.DoesNotContain("EmpresaId", json);        // sem dados internos

        Assert.IsType<NotFoundObjectResult>(await new StoriesPublicosController(db).Listar(99));
    }
}
