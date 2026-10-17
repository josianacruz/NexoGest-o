using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Agenda;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Promocoes;
using Xunit;

namespace NexoGestao.Tests;

// Promoções: só a dona cria; a cliente só vê as que estão no ar; o preço promocional vale no agendamento.
public class PromocoesTests
{
    private static string Json(object? v) => System.Text.Json.JsonSerializer.Serialize(v, new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static PromocoesController Como(AppDbContext db, string usuario) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
        },
    };

    private static async Task<(AppDbContext db, int escova, int sobConsulta)> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Studio Rosa" });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Outra" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dona", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "atendente", EmpresaId = 1, Papel = PapelUsuario.Atendente });
        var escova = new Servico { EmpresaId = 1, Nome = "Escova", DuracaoMinutos = 60, Preco = 100, Ativo = true, PermiteAutoagendamento = true };
        var consulta = new Servico { EmpresaId = 1, Nome = "Noiva", DuracaoMinutos = 180, Preco = 500, Ativo = true, PermiteAutoagendamento = false };
        db.Servicos.AddRange(escova, consulta);
        await db.SaveChangesAsync();
        return (db, escova.Id, consulta.Id);
    }

    [Fact]
    public async Task Dono_cria_promocao_e_ela_fica_no_ar_pela_validade()
    {
        var (db, escova, _) = await Cenario();
        var r = await Como(db, "dona").Criar(1, new CriarPromocaoRequest(escova, 79.9m, 7, "Promoção da semana", "até sexta"));
        Assert.IsType<OkObjectResult>(r);

        var p = await db.PromocoesServico.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(79.9m, p.PrecoPromocional);
        Assert.True(p.Ativa);
        Assert.InRange((p.FimEm - p.InicioEm).TotalDays, 6.99, 7.01);
    }

    [Fact]
    public async Task So_o_dono_cria_e_encerra_e_cliente_de_outra_empresa_nao_mexe()
    {
        var (db, escova, _) = await Cenario();
        Assert.IsType<ForbidResult>(await Como(db, "atendente").Criar(1, new CriarPromocaoRequest(escova, 80, 3)));
        Assert.IsType<ForbidResult>(await Como(db, "estranho").Criar(1, new CriarPromocaoRequest(escova, 80, 3)));
        Assert.Empty(await db.PromocoesServico.IgnoreQueryFilters().ToListAsync());

        await Como(db, "dona").Criar(1, new CriarPromocaoRequest(escova, 80, 3));
        var id = (await db.PromocoesServico.IgnoreQueryFilters().SingleAsync()).Id;
        Assert.IsType<ForbidResult>(await Como(db, "atendente").Encerrar(1, id));
        Assert.True((await db.PromocoesServico.IgnoreQueryFilters().SingleAsync()).Ativa);
        Assert.IsType<OkObjectResult>(await Como(db, "dona").Encerrar(1, id));
        Assert.False((await db.PromocoesServico.IgnoreQueryFilters().SingleAsync()).Ativa);
    }

    [Theory]
    [InlineData(100, 7)]   // preço igual ao normal
    [InlineData(120, 7)]   // preço acima do normal
    [InlineData(0, 7)]     // zero
    [InlineData(-5, 7)]    // negativo
    [InlineData(80, 0)]    // duração zero
    [InlineData(80, 31)]   // duração acima do limite
    public async Task Recusa_preco_ou_duracao_invalidos(double preco, int dias)
    {
        var (db, escova, _) = await Cenario();
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dona").Criar(1, new CriarPromocaoRequest(escova, (decimal)preco, dias)));
        Assert.Empty(await db.PromocoesServico.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Recusa_servico_que_nao_aceita_agendamento_pelo_link_e_titulo_ou_frase_longos()
    {
        var (db, escova, consulta) = await Cenario();
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dona").Criar(1, new CriarPromocaoRequest(consulta, 400, 7)));
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dona").Criar(1, new CriarPromocaoRequest(escova, 80, 7, new string('t', PromocaoServico.MaxTitulo + 1))));
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dona").Criar(1, new CriarPromocaoRequest(escova, 80, 7, null, new string('d', PromocaoServico.MaxDescricao + 1))));
        Assert.IsType<NotFoundObjectResult>(await Como(db, "dona").Criar(1, new CriarPromocaoRequest(9999, 80, 7)));
    }

    [Fact]
    public async Task Nova_promocao_do_mesmo_servico_substitui_a_anterior_e_o_limite_de_cinco_e_respeitado()
    {
        var (db, escova, _) = await Cenario();
        var dona = Como(db, "dona");
        await dona.Criar(1, new CriarPromocaoRequest(escova, 90, 7));
        await dona.Criar(1, new CriarPromocaoRequest(escova, 70, 7));
        var todas = await db.PromocoesServico.IgnoreQueryFilters().OrderBy(p => p.Id).ToListAsync();
        Assert.False(todas[0].Ativa);
        Assert.True(todas[1].Ativa);

        for (var i = 0; i < 4; i++)
        {
            var s = new Servico { EmpresaId = 1, Nome = $"S{i}", DuracaoMinutos = 30, Preco = 50, Ativo = true, PermiteAutoagendamento = true };
            db.Servicos.Add(s);
            await db.SaveChangesAsync();
            Assert.IsType<OkObjectResult>(await dona.Criar(1, new CriarPromocaoRequest(s.Id, 40, 7)));
        }
        var extra = new Servico { EmpresaId = 1, Nome = "Extra", DuracaoMinutos = 30, Preco = 50, Ativo = true, PermiteAutoagendamento = true };
        db.Servicos.Add(extra);
        await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await dona.Criar(1, new CriarPromocaoRequest(extra.Id, 40, 7))); // já são 5 no ar
    }

    private static AgendamentoPublicoController Publico(AppDbContext db) => new(db) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

    [Fact]
    public async Task Pagina_publica_mostra_so_promocao_no_ar_valida_e_nunca_de_outra_empresa()
    {
        var (db, escova, consulta) = await Cenario();
        var agora = DateTime.UtcNow;
        db.PromocoesServico.AddRange(
            new PromocaoServico { EmpresaId = 1, ServicoId = escova, Titulo = "No ar", PrecoPromocional = 80, InicioEm = agora.AddHours(-1), FimEm = agora.AddDays(2), Ativa = true },
            new PromocaoServico { EmpresaId = 1, ServicoId = escova, Titulo = "Expirada", PrecoPromocional = 70, InicioEm = agora.AddDays(-5), FimEm = agora.AddDays(-1), Ativa = true },
            new PromocaoServico { EmpresaId = 1, ServicoId = escova, Titulo = "Encerrada", PrecoPromocional = 60, InicioEm = agora.AddHours(-1), FimEm = agora.AddDays(2), Ativa = false },
            new PromocaoServico { EmpresaId = 1, ServicoId = escova, Titulo = "Futura", PrecoPromocional = 50, InicioEm = agora.AddDays(1), FimEm = agora.AddDays(3), Ativa = true },
            new PromocaoServico { EmpresaId = 1, ServicoId = escova, Titulo = "Sem desconto", PrecoPromocional = 100, InicioEm = agora.AddHours(-1), FimEm = agora.AddDays(2), Ativa = true },
            new PromocaoServico { EmpresaId = 1, ServicoId = consulta, Titulo = "Servico sem link", PrecoPromocional = 400, InicioEm = agora.AddHours(-1), FimEm = agora.AddDays(2), Ativa = true });
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await Publico(db).Pagina(1));
        var j = Json(ok.Value);
        Assert.Contains("No ar", j);
        foreach (var fora in new[] { "Expirada", "Encerrada", "Futura", "Sem desconto", "Servico sem link" })
            Assert.DoesNotContain(fora, j);
        Assert.DoesNotContain("PermiteAutoagendamento", j);   // configuração interna não vaza para a cliente
        Assert.DoesNotContain("EmpresaId", j);

        // outra empresa não enxerga as promoções desta
        var outra = Assert.IsType<OkObjectResult>(await Publico(db).Pagina(2));
        Assert.DoesNotContain("No ar", Json(outra.Value));
    }

    [Fact]
    public async Task Cliente_paga_o_preco_promocional_so_enquanto_a_promocao_esta_no_ar()
    {
        var (db, escova, _) = await Cenario();
        var servico = await db.Servicos.IgnoreQueryFilters().SingleAsync(s => s.Id == escova);
        var agora = DateTime.UtcNow;
        var p = new PromocaoServico { EmpresaId = 1, ServicoId = escova, PrecoPromocional = 75, InicioEm = agora.AddHours(-1), FimEm = agora.AddDays(1), Ativa = true };
        db.PromocoesServico.Add(p);
        await db.SaveChangesAsync();

        var pub = Publico(db);
        db.EmpresaAtualId = 1;
        Assert.Equal(75m, await pub.PrecoEfetivoAsync(servico, agora));

        p.Ativa = false;
        await db.SaveChangesAsync();
        Assert.Equal(100m, await pub.PrecoEfetivoAsync(servico, agora));

        p.Ativa = true;
        p.FimEm = agora.AddMinutes(-1);
        await db.SaveChangesAsync();
        Assert.Equal(100m, await pub.PrecoEfetivoAsync(servico, agora));

        // se a dona subir o preço normal abaixo do promocional, a promoção deixa de valer (nunca cobra mais que o normal)
        p.FimEm = agora.AddDays(1);
        servico.Preco = 60;
        await db.SaveChangesAsync();
        Assert.Equal(60m, await pub.PrecoEfetivoAsync(servico, agora));
    }
}
