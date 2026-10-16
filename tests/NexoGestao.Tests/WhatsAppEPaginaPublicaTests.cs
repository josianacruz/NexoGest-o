using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Agenda;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Empresas;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// WhatsApp da loja (botão de confirmação da página pública) e dados públicos da loja / tabela de preços.
public class WhatsAppEPaginaPublicaTests
{
    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData("(11) 91234-5678", "5511912345678")]
    [InlineData("11912345678", "5511912345678")]
    [InlineData("1133334444", "551133334444")]
    [InlineData("+55 11 91234-5678", "5511912345678")]
    [InlineData("5511912345678", "5511912345678")]
    public void Normaliza_numeros_validos_para_55_mais_ddd_mais_numero(string entrada, string esperado) =>
        Assert.Equal(esperado, WhatsAppUtil.Normalizar(entrada));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("abc")]
    [InlineData("0112345678")]            // DDD não começa com 0
    [InlineData("441234567890")]          // 12 dígitos mas não é 55
    [InlineData("551234567890123")]       // longo demais
    public void Recusa_numeros_invalidos(string? entrada) => Assert.Null(WhatsAppUtil.Normalizar(entrada));

    private static async Task<(AppDbContext db, EmpresasController c)> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Studio Rosa | Beleza com carinho" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "atendente", EmpresaId = 1, Papel = PapelUsuario.Atendente });
        await db.SaveChangesAsync();
        return (db, null!);
    }

    private static EmpresasController Como(AppDbContext db, string usuario) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
        },
    };

    [Fact]
    public async Task Dono_salva_whatsapp_normalizado_e_pode_apagar_sem_mexer_no_resto()
    {
        var (db, _) = await Cenario();

        Assert.IsType<OkObjectResult>(await Como(db, "dono").Atualizar(1, new AtualizarEmpresaRequest(true, WhatsApp: "(11) 91234-5678")));
        Assert.Equal("5511912345678", (await db.Empresas.SingleAsync()).WhatsApp);

        // não mandar WhatsApp (null) não apaga
        await Como(db, "dono").Atualizar(1, new AtualizarEmpresaRequest(true, Nome: "Studio Rosa"));
        Assert.Equal("5511912345678", (await db.Empresas.SingleAsync()).WhatsApp);

        // texto vazio apaga
        await Como(db, "dono").Atualizar(1, new AtualizarEmpresaRequest(true, WhatsApp: "  "));
        Assert.Null((await db.Empresas.SingleAsync()).WhatsApp);
    }

    [Fact]
    public async Task Whatsapp_invalido_e_recusado_e_so_o_dono_muda()
    {
        var (db, _) = await Cenario();
        Assert.IsType<BadRequestObjectResult>(await Como(db, "dono").Atualizar(1, new AtualizarEmpresaRequest(true, WhatsApp: "123")));
        Assert.IsType<ForbidResult>(await Como(db, "atendente").Atualizar(1, new AtualizarEmpresaRequest(true, WhatsApp: "11912345678")));
        Assert.Null((await db.Empresas.SingleAsync()).WhatsApp);
    }

    [Fact]
    public async Task Pagina_publica_traz_nome_whatsapp_e_servicos_numa_resposta_so()
    {
        var (db, _) = await Cenario();
        (await db.Empresas.SingleAsync()).WhatsApp = "5511912345678";
        db.Servicos.Add(new Servico { EmpresaId = 1, Nome = "Escova", DuracaoMinutos = 45, Preco = 80, Ativo = true, PermiteAutoagendamento = true });
        db.Servicos.Add(new Servico { EmpresaId = 1, Nome = "Noiva (sob consulta)", DuracaoMinutos = 180, Preco = 500, Ativo = true, PermiteAutoagendamento = false });
        db.Servicos.Add(new Servico { EmpresaId = 1, Nome = "Antigo", DuracaoMinutos = 30, Preco = 10, Ativo = false });
        db.Servicos.Add(new Servico { EmpresaId = 2, Nome = "De outra loja", DuracaoMinutos = 30, Preco = 10, Ativo = true, PermiteAutoagendamento = true });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Outra" });
        await db.SaveChangesAsync();

        // padrão: só o que pode ser agendado online
        var online = Assert.IsType<OkObjectResult>(await new AgendamentoPublicoController(db) { ControllerContext = ComHttp() }.Pagina(1));
        var j = System.Text.Json.JsonSerializer.Serialize(online.Value);
        Assert.Contains("Studio Rosa | Beleza com carinho", j);
        Assert.Contains("5511912345678", j);
        Assert.Contains("Escova", j);
        Assert.DoesNotContain("Noiva", j);
        Assert.DoesNotContain("Antigo", j);
        Assert.DoesNotContain("De outra loja", j);

        // completa (tabela de preços): todos os ativos da loja
        var completa = Assert.IsType<OkObjectResult>(await new AgendamentoPublicoController(db) { ControllerContext = ComHttp() }.Pagina(1, completa: true));
        var t = System.Text.Json.JsonSerializer.Serialize(completa.Value);
        Assert.Contains("Escova", t);
        Assert.Contains("Noiva", t);
        Assert.DoesNotContain("Antigo", t);
        Assert.DoesNotContain("De outra loja", t);

        Assert.IsType<NotFoundObjectResult>(await new AgendamentoPublicoController(db) { ControllerContext = ComHttp() }.Pagina(99));
    }

    [Fact]
    public async Task Pagina_publica_some_quando_a_agenda_foi_desligada_para_a_loja()
    {
        var (db, _) = await Cenario();
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Clientes, Habilitado = true });
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Agenda, Habilitado = false });
        await db.SaveChangesAsync();
        Assert.IsType<NotFoundObjectResult>(await new AgendamentoPublicoController(db) { ControllerContext = ComHttp() }.Pagina(1));
    }

    private static ControllerContext ComHttp() => new() { HttpContext = new DefaultHttpContext() };

    // ---------- horários livres ----------

    private static readonly DateTime Dia = new(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc);
    private static DateTime Hora(int h, int m = 0) => Dia.AddHours(h).AddMinutes(m);

    [Fact]
    public void Horarios_livres_seguem_o_passo_do_servico_e_pulam_os_ocupados()
    {
        // janela 09:00–12:00, serviço de 60 min, ocupado 10:00–11:00
        var livres = AgendamentoPublicoController.HorariosLivres(Hora(9), Hora(12), 60, Hora(0), new[] { (Hora(10), 60) });
        Assert.Equal(new[] { "09:00", "11:00" }, livres);
    }

    [Fact]
    public void Horario_que_comeca_quando_outro_termina_continua_livre_e_o_que_invade_nao()
    {
        var livres = AgendamentoPublicoController.HorariosLivres(Hora(9), Hora(11), 30, Hora(0), new[] { (Hora(9, 15), 30) }); // 09:15–09:45
        Assert.Equal(new[] { "10:00", "10:30" }, livres); // 09:00 invade (termina 09:30), 09:30 invade (começa antes de 09:45)
    }

    [Fact]
    public void Horarios_que_ja_passaram_e_servico_sem_duracao_nao_aparecem()
    {
        Assert.Equal(new[] { "10:00", "11:00" }, AgendamentoPublicoController.HorariosLivres(Hora(9), Hora(12), 60, Hora(9, 30), Array.Empty<(DateTime, int)>()));
        Assert.Empty(AgendamentoPublicoController.HorariosLivres(Hora(9), Hora(12), 0, Hora(0), Array.Empty<(DateTime, int)>()));
        Assert.Empty(AgendamentoPublicoController.HorariosLivres(Hora(9), Hora(9, 30), 60, Hora(0), Array.Empty<(DateTime, int)>())); // não cabe
    }

    [Fact]
    public async Task Endpoint_de_horarios_usa_a_regra_do_dia_ignora_cancelados_e_outras_lojas()
    {
        var (db, _) = await Cenario();
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Outra" });
        var servico = new Servico { EmpresaId = 1, Nome = "Escova", DuracaoMinutos = 60, Preco = 80, Ativo = true, PermiteAutoagendamento = true };
        db.Servicos.Add(servico);
        db.ConfiguracoesDiaSemana.Add(new ConfiguracaoDiaSemana { EmpresaId = 1, DiaSemana = (int)Dia.DayOfWeek, Ativo = true, HoraInicio = "09:00", HoraFim = "12:00" });
        db.Clientes.Add(new Cliente { Id = 1, EmpresaId = 1, Nome = "A" });
        db.Clientes.Add(new Cliente { Id = 2, EmpresaId = 2, Nome = "B" });
        await db.SaveChangesAsync();
        db.Agendamentos.Add(new Agendamento { EmpresaId = 1, ClienteId = 1, ServicoNome = "x", DataHora = Hora(10), DuracaoMinutos = 60, Status = StatusAgendamento.Agendado });
        db.Agendamentos.Add(new Agendamento { EmpresaId = 1, ClienteId = 1, ServicoNome = "x", DataHora = Hora(11), DuracaoMinutos = 60, Status = StatusAgendamento.Cancelado });
        db.Agendamentos.Add(new Agendamento { EmpresaId = 2, ClienteId = 2, ServicoNome = "x", DataHora = Hora(9), DuracaoMinutos = 60, Status = StatusAgendamento.Agendado });
        await db.SaveChangesAsync();

        var r = Assert.IsType<OkObjectResult>(await new AgendamentoPublicoController(db).ListarHorarios(1, servico.Id, Dia));
        Assert.Equal(new[] { "09:00", "11:00" }, (List<string>)r.Value!); // 10:00 ocupado; 11:00 cancelado libera; outra loja não conta

        // dia desativado → lista vazia
        db.ConfiguracoesDiaSemana.Single().Ativo = false;
        await db.SaveChangesAsync();
        var vazio = Assert.IsType<OkObjectResult>(await new AgendamentoPublicoController(db).ListarHorarios(1, servico.Id, Dia));
        Assert.Empty((string[])vazio.Value!);

        Assert.IsType<NotFoundObjectResult>(await new AgendamentoPublicoController(db).ListarHorarios(1, 9999, Dia));
    }
}
