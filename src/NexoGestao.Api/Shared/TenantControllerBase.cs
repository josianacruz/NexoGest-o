using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace NexoGestao.Api.Shared;

public abstract class TenantControllerBase : ControllerBase
{
    protected readonly AppDbContext Context;

    protected TenantControllerBase(AppDbContext context)
    {
        Context = context;
    }

    protected string UsuarioId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new InvalidOperationException("Usuário não autenticado.");

    /// <summary>
    /// Igual a <see cref="ObterEmpresaAutorizadaAsync"/>, mas só para quem é Dono da empresa.
    /// Usado em áreas sensíveis (ex.: Afiliados: links, comissões e credencial do worker),
    /// já que os papéis Gerente/Atendente ainda não têm permissões próprias.
    /// </summary>
    protected Task<int?> ObterEmpresaDonoAsync(int empresaIdSolicitada, Modulo? moduloRequerido = null) =>
        AutorizarAsync(empresaIdSolicitada, moduloRequerido, soDono: true);

    /// <summary>
    /// Confirma que o usuário pertence à empresa e, quando <paramref name="moduloRequerido"/>
    /// é informado, que o módulo está habilitado para ela — bloqueando tanto o acesso pela
    /// API quanto (indiretamente) qualquer tela que dependa desses endpoints. Empresas sem
    /// nenhuma configuração de módulos (criadas antes desse recurso) continuam com tudo
    /// liberado, pra não quebrar o que já existia.
    /// </summary>
    protected Task<int?> ObterEmpresaAutorizadaAsync(int empresaIdSolicitada, Modulo? moduloRequerido = null) =>
        AutorizarAsync(empresaIdSolicitada, moduloRequerido, soDono: false);

    // Toda a decisão sai de UMA consulta (antes eram até três idas ao banco em cada chamada da API, e esta checagem
    // roda em praticamente todas): pertence à empresa? é Dono? a empresa tem módulos configurados? o módulo está ligado?
    // Administrador máster (Admin:Emails): acesso a qualquer empresa, a todos os módulos, como Dono — para testes e suporte.
    protected bool EhAdminMaster => AdminMaster.Eh(User, HttpContext?.RequestServices?.GetService<IConfiguration>());

    private async Task<int?> AutorizarAsync(int empresaIdSolicitada, Modulo? moduloRequerido, bool soDono)
    {
        if (EhAdminMaster)
        {
            if (!await Context.Empresas.AnyAsync(e => e.Id == empresaIdSolicitada))
                return null;
            Context.EmpresaAtualId = empresaIdSolicitada;
            return empresaIdSolicitada;
        }

        var usuario = UsuarioId;
        var exigeModulo = moduloRequerido is not null;
        var modulo = moduloRequerido ?? default;

        var linha = await Context.MembrosEmpresa
            .AsNoTracking()
            .Where(m => m.UsuarioId == usuario && m.EmpresaId == empresaIdSolicitada)
            .Select(m => new
            {
                EhDono = m.Papel == PapelUsuario.Dono,
                TemConfiguracao = Context.ModulosEmpresa.Any(mo => mo.EmpresaId == empresaIdSolicitada),
                Habilitado = exigeModulo && Context.ModulosEmpresa.Any(mo => mo.EmpresaId == empresaIdSolicitada && mo.Modulo == modulo && mo.Habilitado),
            })
            .FirstOrDefaultAsync();

        if (linha is null)
            return null;

        if (soDono && !linha.EhDono)
            return null;

        if (exigeModulo)
        {
            // Módulos de ligação explícita (Afiliados) não valem por padrão em empresa sem configuração de módulos.
            if (!linha.TemConfiguracao && ModulosPadrao.SoComLigacaoExplicita.Contains(modulo))
                return null;

            if (linha.TemConfiguracao && !linha.Habilitado)
                return null;
        }

        Context.EmpresaAtualId = empresaIdSolicitada;
        return empresaIdSolicitada;
    }
}
