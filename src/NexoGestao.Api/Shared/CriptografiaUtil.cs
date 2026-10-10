using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace NexoGestao.Api.Shared;

// Protege App Id/App Secret de afiliados em repouso usando a Data Protection
// API nativa do ASP.NET Core (gratuita, sem serviço externo). O "purpose"
// abaixo garante que esses segredos só podem ser descriptografados pelo
// mesmo propósito — nunca reaproveitado por engano para outro dado.
public static class CriptografiaUtil
{
    private const string Proposito = "NexoGestao.Afiliados.Credenciais.v1";

    public static string Criptografar(IDataProtectionProvider provider, string valor) =>
        provider.CreateProtector(Proposito).Protect(valor);

    public static string? Descriptografar(IDataProtectionProvider provider, string? valorCriptografado)
    {
        if (string.IsNullOrEmpty(valorCriptografado))
            return null;

        try
        {
            return provider.CreateProtector(Proposito).Unprotect(valorCriptografado);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
