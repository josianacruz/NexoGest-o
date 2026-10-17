using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Empresas;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// Separação de papéis: cliente (público) × painel da dona × administradora máster.
public class PermissoesTests
{
    // ---------- nenhuma rota do painel fica aberta ----------

    // Controllers que PODEM ficar sem login, e por quê. Qualquer controller novo sem [Authorize] derruba este teste.
    private static readonly Dictionary<string, string> SemLoginPermitido = new()
    {
        ["AuthController"] = "login e cadastro",
        ["WorkerController"] = "worker local: autentica por token próprio (X-Worker-Token)",
        ["RadarGatilhoController"] = "gatilho diário: autentica por chave (X-Cron-Key)",
    };

    private static IEnumerable<Type> Controllers() =>
        typeof(AppDbContext).Assembly.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static string? Rota(Type t) => t.GetCustomAttribute<RouteAttribute>()?.Template;

    [Fact]
    public void Todo_controller_exige_login_exceto_os_publicos_e_os_autenticados_por_chave()
    {
        var abertos = new List<string>();
        foreach (var t in Controllers())
        {
            var rota = Rota(t) ?? "";
            var publico = rota.StartsWith("api/publico/", StringComparison.OrdinalIgnoreCase);
            var exigeLogin = t.GetCustomAttribute<AuthorizeAttribute>() is not null && t.GetCustomAttribute<AllowAnonymousAttribute>() is null;
            if (publico || exigeLogin || SemLoginPermitido.ContainsKey(t.Name))
                continue;
            abertos.Add($"{t.Name} ({rota})");
        }
        Assert.True(abertos.Count == 0, "Controllers sem login e fora da lista de permitidos: " + string.Join(", ", abertos));
    }

    [Fact]
    public void Rotas_de_empresa_nunca_sao_publicas_e_as_publicas_nunca_levam_o_id_da_empresa_para_o_painel()
    {
        foreach (var t in Controllers())
        {
            var rota = Rota(t) ?? "";
            if (rota.StartsWith("api/empresas/", StringComparison.OrdinalIgnoreCase))
                Assert.True(t.GetCustomAttribute<AuthorizeAttribute>() is not null, $"{t.Name} está em api/empresas mas não exige login");
            if (rota.StartsWith("api/publico/", StringComparison.OrdinalIgnoreCase))
                Assert.Null(t.GetCustomAttribute<AuthorizeAttribute>()); // público é público: sem misturar com o painel
        }
    }

    [Fact]
    public void Acoes_que_gravam_na_area_publica_sao_so_as_conhecidas()
    {
        // Cliente só pode: agendar, confirmar uma vaga divulgada e demonstrar interesse. Nada de criar/editar Stories,
        // promoções, serviços ou dados da loja por aqui.
        var gravam = new List<string>();
        foreach (var t in Controllers().Where(c => (Rota(c) ?? "").StartsWith("api/publico/", StringComparison.OrdinalIgnoreCase)))
        {
            foreach (var m in t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                if (m.GetCustomAttributes<HttpMethodAttribute>().Any(a => a.HttpMethods.Any(h => h != "GET")))
                    gravam.Add($"{t.Name}.{m.Name}");
            }
        }
        Assert.Equal(new[] { "AgendamentoPublicoController.Criar", "InteressePublicoController.Criar", "VagaPublicaController.Confirmar" }.OrderBy(x => x),
            gravam.OrderBy(x => x));
    }

    // ---------- administradora máster ----------

    private static string Json(object? v) => System.Text.Json.JsonSerializer.Serialize(v, new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ClaimsPrincipal Usuario(string id, string email) =>
        new(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Email, email) }, "teste"));

    private static IServiceProvider Servicos(string? admins)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(admins is null ? new Dictionary<string, string?>() : new() { ["Admin:Emails"] = admins }).Build();
        return new ServiceCollection().AddSingleton<IConfiguration>(cfg).BuildServiceProvider();
    }

    private static ControllerContext Contexto(ClaimsPrincipal u, string? admins) =>
        new() { HttpContext = new DefaultHttpContext { User = u, RequestServices = Servicos(admins) } };

    [Theory]
    [InlineData("josiana@x.com", "josiana@x.com", true)]
    [InlineData("josiana@x.com", "JOSIANA@X.COM", true)]
    [InlineData("a@x.com, josiana@x.com ;b@x.com", "josiana@x.com", true)]
    [InlineData("josiana@x.com", "outra@x.com", false)]
    [InlineData("", "josiana@x.com", false)]
    [InlineData(null, "josiana@x.com", false)]
    public void Administradora_e_quem_esta_na_lista_do_servidor(string? lista, string email, bool esperado)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(lista is null ? new Dictionary<string, string?>() : new() { ["Admin:Emails"] = lista }).Build();
        Assert.Equal(esperado, AdminMaster.Eh(Usuario("u1", email), cfg));
        Assert.False(AdminMaster.Eh(null, cfg));
    }

    private sealed class Probe : TenantControllerBase
    {
        public Probe(AppDbContext db, ControllerContext cc) : base(db) { ControllerContext = cc; }
        public Task<int?> Autorizada(int e, Modulo? m) => ObterEmpresaAutorizadaAsync(e, m);
        public Task<int?> ComoDono(int e, Modulo? m) => ObterEmpresaDonoAsync(e, m);
    }

    private static async Task<AppDbContext> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Salão de Teste", TipoNegocio = TipoNegocio.Beleza });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Lojinha da Débora", TipoNegocio = TipoNegocio.Comercio });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dona-salao", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "debora", EmpresaId = 2, Papel = PapelUsuario.Dono });
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Agenda, Habilitado = true });
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 2, Modulo = Modulo.Produtos, Habilitado = true });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Administradora_acessa_qualquer_empresa_e_modulo_sem_ser_membro_mas_empresa_inexistente_nao()
    {
        var db = await Cenario();
        var admin = new Probe(db, Contexto(Usuario("josiana-id", "josiana@x.com"), "josiana@x.com"));

        Assert.Equal(1, await admin.Autorizada(1, Modulo.Vendas));      // salão não tem Vendas ligado: admin passa
        Assert.Equal(2, await admin.Autorizada(2, Modulo.Agenda));      // loja não tem Agenda: admin passa
        Assert.Equal(2, await admin.ComoDono(2, Modulo.Afiliados));     // até o de ligação explícita
        Assert.Null(await admin.Autorizada(99, null));
    }

    [Fact]
    public async Task Cliente_do_salao_so_enxerga_a_propria_empresa_e_so_os_modulos_ligados()
    {
        var db = await Cenario();
        var dona = new Probe(db, Contexto(Usuario("dona-salao", "salao@x.com"), "josiana@x.com"));

        Assert.Equal(1, await dona.Autorizada(1, Modulo.Agenda));
        Assert.Null(await dona.Autorizada(1, Modulo.Vendas));   // módulo de loja: bloqueado no perfil salão
        Assert.Null(await dona.Autorizada(2, null));            // empresa de outra pessoa
        Assert.Null(await dona.Autorizada(2, Modulo.Produtos));
    }

    [Fact]
    public async Task Tirar_o_email_da_lista_revoga_a_administradora_na_hora()
    {
        var db = await Cenario();
        var comAcesso = new Probe(db, Contexto(Usuario("josiana-id", "josiana@x.com"), "josiana@x.com"));
        var semAcesso = new Probe(db, Contexto(Usuario("josiana-id", "josiana@x.com"), null)); // mesmo login, lista vazia
        Assert.Equal(2, await comAcesso.Autorizada(2, Modulo.Vendas));
        Assert.Null(await semAcesso.Autorizada(2, Modulo.Vendas));
    }

    private static EmpresasController Empresas(AppDbContext db, ClaimsPrincipal u, string? admins) => new(db) { ControllerContext = Contexto(u, admins) };

    [Fact]
    public async Task Minhas_empresas_a_administradora_ve_todas_com_todos_os_modulos_e_a_cliente_so_as_dela()
    {
        var db = await Cenario();

        var admin = Assert.IsType<OkObjectResult>(await Empresas(db, Usuario("josiana-id", "josiana@x.com"), "josiana@x.com").Minhas());
        var jAdmin = Json(admin.Value);
        Assert.Contains("Salão de Teste", jAdmin);
        Assert.Contains("Lojinha da Débora", jAdmin);
        Assert.Contains("\"Papel\":\"Admin\"", jAdmin);          // modo suporte (não é membro)
        Assert.Contains("\"EhAdmin\":true", jAdmin);
        Assert.Contains("\"Vendas\"", jAdmin);                    // todos os módulos liberados para ela…
        Assert.Contains("\"ModulosDaEmpresa\":[\"Agenda\"]", jAdmin); // …mas a empresa real continua só com Agenda

        var cliente = Assert.IsType<OkObjectResult>(await Empresas(db, Usuario("dona-salao", "salao@x.com"), "josiana@x.com").Minhas());
        var jCliente = Json(cliente.Value);
        Assert.Contains("Salão de Teste", jCliente);
        Assert.DoesNotContain("Lojinha da Débora", jCliente);
        Assert.Contains("\"EhAdmin\":false", jCliente);
        Assert.DoesNotContain("\"Vendas\"", jCliente);
    }

    // ---------- perfis de acesso ----------

    private static AdminController Console(AppDbContext db, ClaimsPrincipal u, string? admins)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(admins is null ? new Dictionary<string, string?>() : new() { ["Admin:Emails"] = admins }).Build();
        return new AdminController(db, cfg) { ControllerContext = Contexto(u, admins) };
    }

    [Fact]
    public async Task So_a_administradora_usa_o_console_e_so_ela_aplica_perfil()
    {
        var db = await Cenario();
        var cliente = Console(db, Usuario("dona-salao", "salao@x.com"), "josiana@x.com");
        Assert.IsType<ForbidResult>(await cliente.Listar());
        Assert.IsType<ForbidResult>(await cliente.AplicarPerfil(1, new AplicarPerfilRequest("Completo")));
    }

    [Fact]
    public async Task Perfil_salao_liga_so_os_modulos_de_salao_e_loja_so_os_de_loja_sem_tocar_em_afiliados()
    {
        var db = await Cenario();
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Afiliados, Habilitado = true });
        db.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Vendas, Habilitado = true });
        await db.SaveChangesAsync();
        var admin = Console(db, Usuario("josiana-id", "josiana@x.com"), "josiana@x.com");

        var r = Assert.IsType<OkObjectResult>(await admin.AplicarPerfil(1, new AplicarPerfilRequest("Salao")));
        var ligados = await db.ModulosEmpresa.IgnoreQueryFilters().Where(m => m.EmpresaId == 1 && m.Habilitado).Select(m => m.Modulo).ToListAsync();
        Assert.Equal(new[] { Modulo.Clientes, Modulo.Agenda, Modulo.Servicos, Modulo.Marketing, Modulo.Afiliados }.OrderBy(x => x), ligados.OrderBy(x => x));
        Assert.Contains("\"Perfil\":\"Salao\"", Json(r.Value));
        Assert.Equal(NichoLoja.BelezaServicos, (await db.Empresas.IgnoreQueryFilters().SingleAsync(e => e.Id == 1)).Nicho);

        Assert.IsType<OkObjectResult>(await admin.AplicarPerfil(2, new AplicarPerfilRequest("loja")));
        var loja = await db.ModulosEmpresa.IgnoreQueryFilters().Where(m => m.EmpresaId == 2 && m.Habilitado).Select(m => m.Modulo).ToListAsync();
        Assert.Equal(new[] { Modulo.Clientes, Modulo.Produtos, Modulo.Vendas }.OrderBy(x => x), loja.OrderBy(x => x));
    }

    [Fact]
    public async Task Perfil_invalido_e_empresa_inexistente_sao_recusados_e_o_perfil_e_inferido_na_lista()
    {
        var db = await Cenario();
        var admin = Console(db, Usuario("josiana-id", "josiana@x.com"), "josiana@x.com");
        Assert.IsType<BadRequestObjectResult>(await admin.AplicarPerfil(1, new AplicarPerfilRequest("Xyz")));
        Assert.IsType<NotFoundObjectResult>(await admin.AplicarPerfil(99, new AplicarPerfilRequest("Salao")));

        await admin.AplicarPerfil(1, new AplicarPerfilRequest("Salao"));
        var lista = Json(Assert.IsType<OkObjectResult>(await admin.Listar()).Value);
        Assert.Contains("\"Perfil\":\"Salao\"", lista);
        Assert.Contains("\"Perfil\":\"Personalizado\"", lista); // a loja ainda só tem Produtos
    }

    [Theory]
    [InlineData("Clientes,Agenda,Servicos,Marketing", "Salao")]
    [InlineData("Clientes,Produtos,Vendas", "Loja")]
    [InlineData("Clientes,Agenda", "Personalizado")]
    public void Perfil_e_reconhecido_pelo_conjunto_de_modulos(string modulos, string esperado) =>
        Assert.Equal(esperado, PerfisDeAcesso.Inferir(modulos.Split(',').Select(Enum.Parse<Modulo>)));
}
