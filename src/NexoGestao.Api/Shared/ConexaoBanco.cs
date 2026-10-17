using System.Net.Sockets;
using Npgsql;

namespace NexoGestao.Api.Shared;

// Estabilidade da conexão com o PostgreSQL (Neon).
//
// O problema real: o Neon suspende o banco depois de uns 5 min sem uso e derruba as conexões. O Npgsql guarda conexões
// abertas num "pool"; depois da suspensão, a primeira consulta pega uma conexão morta e falha. As medidas abaixo evitam
// isso sem exigir que ninguém mexa na string do Render:
//   - ConnectionIdleLifetime=30: conexão parada por 30 s é descartada, então nada "velho" sobra no pool;
//   - KeepAlive=20: envia sinal de vida enquanto a conexão está em uso (detecta queda de rede cedo);
//   - Timeout=30: o Neon pode levar alguns segundos para acordar; 15 s (padrão) às vezes é pouco;
//   - MaxPoolSize=20: respeita o limite de conexões do plano grátis;
//   - NoResetOnClose quando a string usa o pooler do Neon (PgBouncer), como o Npgsql recomenda.
// Qualquer valor que já esteja na string do Render é respeitado.
public static class ConexaoBanco
{
    public static string? Ajustar(string? conexao)
    {
        if (string.IsNullOrWhiteSpace(conexao))
            return conexao;

        NpgsqlConnectionStringBuilder b;
        try
        {
            b = new NpgsqlConnectionStringBuilder(conexao);
        }
        catch (ArgumentException)
        {
            return conexao; // formato que não é "chave=valor" (ex.: URL): não mexe
        }

        bool Informado(params string[] nomes) => nomes.Any(n => conexao.Contains(n, StringComparison.OrdinalIgnoreCase));

        if (!Informado("Connection Idle Lifetime", "ConnectionIdleLifetime")) b.ConnectionIdleLifetime = 30;
        if (!Informado("Keepalive", "Keep Alive")) b.KeepAlive = 20;
        // "Timeout" sozinho = tempo para conectar (não confundir com "Command Timeout")
        if (!System.Text.RegularExpressions.Regex.IsMatch(conexao, @"(^|;)\s*Timeout\s*=", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) b.Timeout = 30;
        if (!Informado("Maximum Pool Size", "MaxPoolSize")) b.MaxPoolSize = 20;
        if (b.Host?.Contains("-pooler", StringComparison.OrdinalIgnoreCase) == true && !Informado("No Reset On Close", "NoResetOnClose"))
            b.NoResetOnClose = true;

        return b.ConnectionString;
    }

    // Falhas que são "o banco não respondeu agora" (e não um erro de programação): vale pedir para tentar de novo.
    public static bool EhFalhaDeConexao(Exception? ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
        {
            if (e is NpgsqlException { IsTransient: true } or SocketException or TimeoutException or System.IO.IOException)
                return true;
        }
        return false;
    }
}
