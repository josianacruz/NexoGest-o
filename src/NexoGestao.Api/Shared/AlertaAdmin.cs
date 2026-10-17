using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;

namespace NexoGestao.Api.Shared;

// Aviso para a administradora no celular, de graça, pelo ntfy.sh (sem conta e sem chave): a pessoa instala o aplicativo
// "ntfy" e assina o tópico configurado em Alertas:NtfyTopico (variável Alertas__NtfyTopico no Render). O tópico funciona como
// senha: use um nome longo e aleatório. Só vão nome do negócio, tipo e números; nunca e-mail, telefone ou dados de clientes.
// Sem tópico configurado, nada é enviado. Falha de rede nunca derruba nem atrasa quem está usando o sistema.
public class AlertaAdmin
{
    private readonly HttpClient _http;
    private readonly IConfiguration _configuracao;
    private readonly ILogger<AlertaAdmin> _log;

    public AlertaAdmin(HttpClient http, IConfiguration configuracao, ILogger<AlertaAdmin> log)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(5);
        _configuracao = configuracao;
        _log = log;
    }

    public bool Configurado => !string.IsNullOrWhiteSpace(_configuracao["Alertas:NtfyTopico"]);

    public async Task EnviarAsync(string titulo, string texto, bool urgente = false)
    {
        var topico = _configuracao["Alertas:NtfyTopico"];
        if (string.IsNullOrWhiteSpace(topico))
            return;
        try
        {
            // JSON (UTF-8): cabeçalhos HTTP não aceitam acentos, o corpo aceita.
            using var resposta = await _http.PostAsJsonAsync("https://ntfy.sh/", new
            {
                topic = topico.Trim(),
                title = titulo,
                message = texto,
                priority = urgente ? 5 : 3,
                tags = new[] { urgente ? "warning" : "bell" },
            });
            if (!resposta.IsSuccessStatusCode)
                _log.LogWarning("ntfy respondeu {Status}", (int)resposta.StatusCode);
        }
        catch (Exception e)
        {
            _log.LogWarning(e, "Não consegui enviar o alerta para a administradora.");
        }
    }
}

// Limites que protegem o servidor gratuito (todos ajustáveis por variável de ambiente, sem mexer no código).
public static class LimitesDoServidor
{
    // Neon grátis: 0,5 GB de armazenamento.
    public const long BancoMaxBytesPadrao = 512L * 1024 * 1024;
    public const int MaxUsuariosPadrao = 100;

    public static long BancoMaxBytes(IConfiguration? c) => long.TryParse(c?["Limites:BancoMaxBytes"], out var v) && v > 0 ? v : BancoMaxBytesPadrao;

    public static int MaxUsuarios(IConfiguration? c) => int.TryParse(c?["Limites:MaxUsuarios"], out var v) && v > 0 ? v : MaxUsuariosPadrao;

    // Cadastro novo só entra enquanto o total de contas estiver abaixo do limite.
    public static bool CadastrosFechados(int totalUsuarios, IConfiguration? c) => totalUsuarios >= MaxUsuarios(c);

    // Tamanho real do banco (PostgreSQL). Nulo se o banco não souber responder (ex.: testes em memória).
    public static async Task<long?> TamanhoDoBancoAsync(AppDbContext contexto)
    {
        try
        {
            return await contexto.Database.SqlQueryRaw<long>("select pg_database_size(current_database()) as \"Value\"").SingleAsync();
        }
        catch
        {
            return null;
        }
    }
}

// Confere o tamanho do banco a cada 6 horas e avisa no celular ao passar de 70% e de 90% do limite.
public class MonitorDeUsoService : BackgroundService
{
    private readonly IServiceScopeFactory _escopos;
    private readonly IConfiguration _configuracao;
    private int _nivelAvisado; // 0 = nenhum, 1 = 70%, 2 = 90%

    public MonitorDeUsoService(IServiceScopeFactory escopos, IConfiguration configuracao)
    {
        _escopos = escopos;
        _configuracao = configuracao;
    }

    protected override async Task ExecuteAsync(CancellationToken parar)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(3), parar);
            using var relogio = new PeriodicTimer(TimeSpan.FromHours(6));
            do
            {
                await ConferirAsync();
            } while (await relogio.WaitForNextTickAsync(parar));
        }
        catch (OperationCanceledException)
        {
            /* servidor desligando */
        }
    }

    private async Task ConferirAsync()
    {
        try
        {
            using var escopo = _escopos.CreateScope();
            var alerta = escopo.ServiceProvider.GetRequiredService<AlertaAdmin>();
            if (!alerta.Configurado)
                return;
            var tamanho = await LimitesDoServidor.TamanhoDoBancoAsync(escopo.ServiceProvider.GetRequiredService<AppDbContext>());
            if (tamanho is null)
                return;

            var limite = LimitesDoServidor.BancoMaxBytes(_configuracao);
            var pct = (double)tamanho.Value / limite * 100;
            var nivel = pct >= 90 ? 2 : pct >= 70 ? 1 : 0;
            if (nivel > _nivelAvisado)
                await alerta.EnviarAsync(nivel == 2 ? "Banco quase cheio!" : "Banco passou de 70%", $"O banco está usando {tamanho.Value / 1024 / 1024} MB de {limite / 1024 / 1024} MB ({pct:0}%). Veja a tela Administração.", urgente: nivel == 2);
            _nivelAvisado = nivel;
        }
        catch
        {
            /* a próxima conferência tenta de novo */
        }
    }
}
