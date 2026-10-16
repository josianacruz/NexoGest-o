namespace NexoGestao.Api.Shared;

public static class WhatsAppUtil
{
    // Aceita número brasileiro com DDD (10 ou 11 dígitos) ou já com 55 (12 ou 13); devolve só dígitos com 55 na frente.
    public static string? Normalizar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return null;

        var d = new string(texto.Where(char.IsDigit).ToArray());
        if (d.Length is 10 or 11)
            d = "55" + d;
        else if (!(d.Length is 12 or 13 && d.StartsWith("55")))
            return null;

        // DDD de 11 a 99 (nunca começa com 0)
        return d[2] is >= '1' and <= '9' ? d : null;
    }
}
