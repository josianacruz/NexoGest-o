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
    /// Confirma que o usuário pertence à empresa e, quando <paramref name="moduloRequerido"/>
    /// é informado, que o módulo está habilitado para ela — bloqueando tanto o acesso pela
    /// API quanto (indiretamente) qualquer tela que dependa desses endpoints. Empresas sem
    /// nenhuma configuração de módulos (criadas antes desse recurso) continuam com tudo
    /// liberado, pra não quebrar o que já existia.
    /// </summary>
    protected async Task<int?> ObterEmpresaAutorizadaAsync(int empresaIdSolicitada, Modulo? moduloRequerido = null)
    {
        var pertence = await Context.MembrosEmpresa
            .AnyAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaIdSolicitada);

        if (!pertence)
            return null;

        Context.EmpresaAtualId = empresaIdSolicitada;

        if (moduloRequerido is not null)
        {
            var temConfiguracao = await Context.ModulosEmpresa
                .AnyAsync(m => m.EmpresaId == empresaIdSolicitada);

            if (temConfiguracao)
            {
                var moduloHabilitado = await Context.ModulosEmpresa.AnyAsync(m =>
                    m.EmpresaId == empresaIdSolicitada && m.Modulo == moduloRequerido && m.Habilitado);

                if (!moduloHabilitado)
                    return null;
            }
        }

        return empresaIdSolicitada;
    }
}
