using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
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

    protected async Task<int?> ObterEmpresaAutorizadaAsync(int empresaIdSolicitada)
    {
        var pertence = await Context.MembrosEmpresa
            .AnyAsync(m => m.UsuarioId == UsuarioId && m.EmpresaId == empresaIdSolicitada);

        if (!pertence)
            return null;

        Context.EmpresaAtualId = empresaIdSolicitada;
        return empresaIdSolicitada;
    }
}
