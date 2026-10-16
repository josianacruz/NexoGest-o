using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Agenda;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using Xunit;

namespace NexoGestao.Tests;

// Horário de trabalho (Configurações): só o Dono altera, é validado e a agenda pública fica "cravada" nele.
public class HorarioDeTrabalhoTests
{
    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static PerfilLojaController Perfil(AppDbContext db, string usuario) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
        },
    };

    private static async Task<AppDbContext> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Studio" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "atendente", EmpresaId = 1, Papel = PapelUsuario.Atendente });
        await db.SaveChangesAsync();
        return db;
    }

    private static List<DiaSemanaDto> Semana(Func<int, DiaSemanaDto> f) => Enumerable.Range(0, 7).Select(f).ToList();

    // ---------- validação ----------

    [Fact]
    public void Aceita_semana_valida_e_dia_fechado_com_horas_validas()
    {
        Assert.Null(HorarioTrabalho.Validar(Semana(d => new DiaSemanaDto(d, d != 0, "09:00", "18:30"))));
    }

    [Theory]
    [InlineData("9:00", "18:00")]
    [InlineData("09:00", "24:00")]
    [InlineData("09:60", "18:00")]
    [InlineData("abc", "18:00")]
    [InlineData("", "18:00")]
    public void Recusa_horas_fora_do_formato(string inicio, string fim) =>
        Assert.NotNull(HorarioTrabalho.Validar(new List<DiaSemanaDto> { new(1, true, inicio, fim) }));

    [Fact]
    public void Recusa_saida_antes_da_entrada_so_em_dia_aberto_e_dia_repetido_ou_invalido()
    {
        Assert.NotNull(HorarioTrabalho.Validar(new() { new(1, true, "18:00", "09:00") }));
        Assert.NotNull(HorarioTrabalho.Validar(new() { new(1, true, "09:00", "09:00") }));
        Assert.Null(HorarioTrabalho.Validar(new() { new(0, false, "18:00", "09:00") })); // dia fechado: a hora não importa
        Assert.NotNull(HorarioTrabalho.Validar(new() { new(1, true, "09:00", "18:00"), new(1, true, "09:00", "18:00") }));
        Assert.NotNull(HorarioTrabalho.Validar(new() { new(7, true, "09:00", "18:00") }));
        Assert.NotNull(HorarioTrabalho.Validar(new List<DiaSemanaDto>()));
        Assert.NotNull(HorarioTrabalho.Validar(null));
    }

    // ---------- salvar ----------

    [Fact]
    public async Task Dono_salva_o_horario_e_a_leitura_devolve_o_que_foi_salvo()
    {
        var db = await Cenario();
        var dias = Semana(d => new DiaSemanaDto(d, d is >= 1 and <= 5, "09:00", d == 6 ? "13:00" : "18:00"));

        Assert.IsType<OkObjectResult>(await Perfil(db, "dono").Salvar(1, new SalvarPerfilLojaRequest(dias)));
        var lido = Assert.IsAssignableFrom<IEnumerable<DiaSemanaDto>>(Assert.IsType<OkObjectResult>(await Perfil(db, "dono").Obter(1)).Value).ToList();

        Assert.Equal(7, lido.Count);
        Assert.Contains(lido, d => d.DiaSemana == 3 && d.Ativo && d.HoraInicio == "09:00" && d.HoraFim == "18:00");
        Assert.Contains(lido, d => d.DiaSemana == 0 && !d.Ativo);
    }

    [Fact]
    public async Task Quem_nao_e_dono_nao_muda_o_horario_e_horario_invalido_nao_grava_nada()
    {
        var db = await Cenario();
        var bom = new SalvarPerfilLojaRequest(Semana(d => new DiaSemanaDto(d, true, "09:00", "18:00")));
        Assert.IsType<ForbidResult>(await Perfil(db, "atendente").Salvar(1, bom));
        Assert.Empty(await db.ConfiguracoesDiaSemana.IgnoreQueryFilters().ToListAsync());

        var ruim = new SalvarPerfilLojaRequest(new() { new(1, true, "20:00", "08:00") });
        Assert.IsType<BadRequestObjectResult>(await Perfil(db, "dono").Salvar(1, ruim));
        Assert.Empty(await db.ConfiguracoesDiaSemana.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Salvar_de_novo_atualiza_sem_duplicar_dias_e_acompanha_a_janela_padrao()
    {
        var db = await Cenario();
        db.ConfiguracoesAgenda.Add(new ConfiguracaoAgenda { EmpresaId = 1, HoraInicioAtendimento = "08:00", HoraFimAtendimento = "18:00" });
        await db.SaveChangesAsync();

        await Perfil(db, "dono").Salvar(1, new(Semana(d => new DiaSemanaDto(d, true, "09:00", "17:00"))));
        await Perfil(db, "dono").Salvar(1, new(Semana(d => new DiaSemanaDto(d, d != 0, "10:00", "19:00"))));

        Assert.Equal(7, await db.ConfiguracoesDiaSemana.IgnoreQueryFilters().CountAsync());
        var config = await db.ConfiguracoesAgenda.IgnoreQueryFilters().SingleAsync();
        Assert.Equal("10:00", config.HoraInicioAtendimento);
        Assert.Equal("19:00", config.HoraFimAtendimento);
    }

    // ---------- página pública cravada no horário ----------

    private static DateTime DiaFuturoComSemana(DayOfWeek dia)
    {
        var d = DateTime.UtcNow.Date.AddDays(10);
        while (d.DayOfWeek != dia) d = d.AddDays(1);
        return d;
    }

    private static async Task<(AppDbContext db, int servicoId, DateTime segunda, DateTime domingo)> CenarioPublico()
    {
        var db = await Cenario();
        var servico = new Servico { EmpresaId = 1, Nome = "Escova", DuracaoMinutos = 60, Preco = 80, Ativo = true, PermiteAutoagendamento = true };
        db.Servicos.Add(servico);
        db.ConfiguracoesDiaSemana.Add(new ConfiguracaoDiaSemana { EmpresaId = 1, DiaSemana = (int)DayOfWeek.Monday, Ativo = true, HoraInicio = "09:00", HoraFim = "12:00" });
        db.ConfiguracoesDiaSemana.Add(new ConfiguracaoDiaSemana { EmpresaId = 1, DiaSemana = (int)DayOfWeek.Sunday, Ativo = false, HoraInicio = "09:00", HoraFim = "12:00" });
        await db.SaveChangesAsync();
        return (db, servico.Id, DiaFuturoComSemana(DayOfWeek.Monday), DiaFuturoComSemana(DayOfWeek.Sunday));
    }

    private static Task<IActionResult> Pedir(AppDbContext db, int servicoId, DateTime dia, string hora) =>
        new AgendamentoPublicoController(db).Criar(1, new CriarAgendamentoPublicoRequest(servicoId, dia, hora, "Maria", "11912345678"));

    [Fact]
    public async Task Pedido_em_dia_fechado_e_recusado()
    {
        var (db, servicoId, _, domingo) = await CenarioPublico();
        var r = await Pedir(db, servicoId, domingo, "10:00");
        Assert.Contains("Não atendemos", Assert.IsType<BadRequestObjectResult>(r).Value!.ToString());
        Assert.Empty(await db.Agendamentos.IgnoreQueryFilters().ToListAsync());
    }

    [Theory]
    [InlineData("03:00")]  // madrugada
    [InlineData("08:00")]  // antes de abrir
    [InlineData("12:00")]  // a janela fecha 12:00: não cabe 1 h
    [InlineData("11:30")]  // fora da grade do serviço (09, 10, 11)
    [InlineData("25:99")]  // formato inválido
    [InlineData("")]
    public async Task Pedido_fora_do_horario_de_trabalho_ou_da_grade_e_recusado(string hora)
    {
        var (db, servicoId, segunda, _) = await CenarioPublico();
        var r = await Pedir(db, servicoId, segunda, hora);
        Assert.IsType<BadRequestObjectResult>(r);
        Assert.Empty(await db.Agendamentos.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public void Grade_do_dia_respeita_a_janela_e_a_duracao()
    {
        var dia = new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc);
        var grade = AgendamentoPublicoController.GradeDoDia(dia.AddHours(9), dia.AddHours(12), 60);
        Assert.Equal(new[] { 9, 10, 11 }, grade.Select(g => g.Hour));
        Assert.Empty(AgendamentoPublicoController.GradeDoDia(dia.AddHours(9), dia.AddHours(9).AddMinutes(30), 60));
        Assert.Empty(AgendamentoPublicoController.GradeDoDia(dia.AddHours(9), dia.AddHours(12), 0));
    }
}
