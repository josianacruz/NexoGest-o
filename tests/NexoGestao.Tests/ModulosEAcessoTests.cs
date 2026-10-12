using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// Garante que o módulo Afiliados NUNCA aparece por padrão para empresas de clientes e que só o Dono entra,
// sem mudar o comportamento dos módulos existentes.
public class ModulosEAcessoTests
{
    private sealed class ControladorDeTeste : TenantControllerBase
    {
        public ControladorDeTeste(AppDbContext db, string usuarioId) : base(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuarioId) }, "teste")) },
            };
        }

        public Task<int?> Autorizada(int empresa, Modulo? modulo) => ObterEmpresaAutorizadaAsync(empresa, modulo);
        public Task<int?> ComoDono(int empresa, Modulo? modulo) => ObterEmpresaDonoAsync(empresa, modulo);
    }

    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task<AppDbContext> Cenario(Action<AppDbContext> monta)
    {
        var db = Banco();
        monta(db);
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Empresa_sem_configuracao_de_modulos_continua_com_os_modulos_antigos_mas_nao_com_afiliados()
    {
        var db = await Cenario(d => d.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono", EmpresaId = 1, Papel = PapelUsuario.Dono }));
        var c = new ControladorDeTeste(db, "dono");

        foreach (var m in Enum.GetValues<Modulo>().Where(x => x != Modulo.Afiliados))
            Assert.Equal(1, await c.Autorizada(1, m)); // nada do que já existia muda
        Assert.Null(await c.Autorizada(1, Modulo.Afiliados));
        Assert.Null(await c.ComoDono(1, Modulo.Afiliados));
    }

    [Fact]
    public void Lista_de_modulos_padrao_sem_configuracao_nao_inclui_afiliados()
    {
        Assert.DoesNotContain(Modulo.Afiliados, ModulosPadrao.LiberadosSemConfiguracao);
        Assert.Contains(Modulo.Agenda, ModulosPadrao.LiberadosSemConfiguracao);
        Assert.Contains(Modulo.Interesses, ModulosPadrao.LiberadosSemConfiguracao);
    }

    [Fact]
    public async Task Empresa_com_modulos_configurados_sem_afiliados_nao_acessa()
    {
        var db = await Cenario(d =>
        {
            d.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono", EmpresaId = 1, Papel = PapelUsuario.Dono });
            d.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Clientes, Habilitado = true });
        });
        var c = new ControladorDeTeste(db, "dono");
        Assert.Equal(1, await c.Autorizada(1, Modulo.Clientes));
        Assert.Null(await c.Autorizada(1, Modulo.Afiliados));
        Assert.Null(await c.Autorizada(1, Modulo.Agenda)); // configurada sem Agenda: continua sem
    }

    [Fact]
    public async Task Dono_com_afiliados_ligado_acessa_e_atendente_e_gerente_nao()
    {
        var db = await Cenario(d =>
        {
            d.MembrosEmpresa.AddRange(
                new MembroEmpresa { UsuarioId = "dono", EmpresaId = 1, Papel = PapelUsuario.Dono },
                new MembroEmpresa { UsuarioId = "gerente", EmpresaId = 1, Papel = PapelUsuario.Gerente },
                new MembroEmpresa { UsuarioId = "atendente", EmpresaId = 1, Papel = PapelUsuario.Atendente });
            d.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Afiliados, Habilitado = true });
        });

        Assert.Equal(1, await new ControladorDeTeste(db, "dono").ComoDono(1, Modulo.Afiliados));
        Assert.Null(await new ControladorDeTeste(db, "gerente").ComoDono(1, Modulo.Afiliados));
        Assert.Null(await new ControladorDeTeste(db, "atendente").ComoDono(1, Modulo.Afiliados));
    }

    [Fact]
    public async Task Dono_de_outra_empresa_nao_acessa_esta()
    {
        var db = await Cenario(d =>
        {
            d.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "donoA", EmpresaId = 1, Papel = PapelUsuario.Dono });
            d.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "donoB", EmpresaId = 2, Papel = PapelUsuario.Dono });
            d.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 1, Modulo = Modulo.Afiliados, Habilitado = true });
            d.ModulosEmpresa.Add(new ModuloEmpresa { EmpresaId = 2, Modulo = Modulo.Afiliados, Habilitado = true });
        });
        Assert.Null(await new ControladorDeTeste(db, "donoB").ComoDono(1, Modulo.Afiliados));
        Assert.Equal(2, await new ControladorDeTeste(db, "donoB").ComoDono(2, Modulo.Afiliados));
    }
}
