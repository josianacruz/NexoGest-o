using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public static class TelefoneUtil
{
    // Mesma lógica do normalizarTelefone do frontend (lib/whatsapp.ts), pra
    // conseguir casar um celular digitado no autoagendamento com um Cliente
    // já cadastrado, independente de formatação.
    public static string? Normalizar(string? telefone)
    {
        if (string.IsNullOrWhiteSpace(telefone))
            return null;

        var digitos = Regex.Replace(telefone, @"\D", "");

        if (digitos.Length is 10 or 11)
            return $"55{digitos}";

        if (digitos.Length is 12 or 13 && digitos.StartsWith("55"))
            return digitos;

        return null;
    }
}
