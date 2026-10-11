using System.Diagnostics;
using NexoGestao.Worker;

// NexoWorker — gera os vídeos do módulo Afiliados NESTE computador.
//   NexoWorker              fica ligado, pegando tarefas da API (uma por vez)
//   NexoWorker --verificar  confere configuração, Python/FFmpeg e a conexão com a API
//   NexoWorker --uma-vez    processa no máximo uma tarefa e encerra
// Só faz conexões de saída (HTTPS) até a API. Nenhuma porta é aberta neste computador.
// A CDN da Shopee anuncia HTTP/3 (Alt-Svc) e o tratamento disso quebra com NullReferenceException
// nesta versão do .NET; desligar HTTP/3 no processo evita o problema (a API faz o mesmo).
AppContext.SetSwitch("System.Net.SocketsHttpHandler.Http3Support", false);

var args0 = args.Select(a => a.ToLowerInvariant()).ToList();
var cfg = WorkerConfig.Carregar();
var versao = "1.0";

if (args0.Contains("--verificar"))
    return await Verificar(cfg);

var problemas = cfg.Problemas();
if (problemas.Count > 0)
{
    Log.Aviso("Configuração incompleta:");
    problemas.ForEach(p => Log.Aviso("  - " + p));
    Log.Aviso($"Arquivo de configuração esperado: {WorkerConfig.CaminhoConfig}");
    return 2;
}

Directory.CreateDirectory(cfg.PastaSaida);
using var parar = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; parar.Cancel(); Log.Info("Encerrando…"); };

var api = new ApiCliente(cfg);
var processador = new Processador(cfg, api);
var concluidos = new Queue<DateTime>();
var umaVez = args0.Contains("--uma-vez");
Log.Info($"NexoWorker {versao} ligado. Pasta dos vídeos: {cfg.PastaSaida}. Uma tarefa por vez, no máximo {cfg.MaximoPorHora}/hora.");

while (!parar.IsCancellationRequested)
{
    try
    {
        while (concluidos.Count > 0 && concluidos.Peek() < DateTime.UtcNow.AddHours(-1)) concluidos.Dequeue();
        if (concluidos.Count >= cfg.MaximoPorHora)
        {
            Log.Info("Limite por hora atingido; aguardando.");
            await Task.Delay(TimeSpan.FromMinutes(1), parar.Token);
            continue;
        }

        var (usado, livre) = Espaco(cfg);
        var resposta = await api.ProximaAsync(new
        {
            versao,
            maquina = Environment.MachineName,
            pasta = cfg.PastaSaida,
            espacoUsadoBytes = usado,
            espacoLivreBytes = livre,
        }, parar.Token);

        if (resposta.Tarefa is null)
        {
            if (umaVez) { Log.Info("Fila vazia."); break; }
            await Task.Delay(TimeSpan.FromSeconds(cfg.IntervaloSegundos), parar.Token);
            continue;
        }

        Log.Info($"Tarefa {resposta.Tarefa.Id}: {resposta.Tarefa.Produto.Nome}");
        await processador.ExecutarAsync(resposta.Tarefa, parar.Token);
        concluidos.Enqueue(DateTime.UtcNow);
        if (umaVez) break;
    }
    catch (CredencialInvalidaException ex)
    {
        Log.Aviso(ex.Message + " Gere uma nova credencial no Nexo (Afiliados > Worker) e atualize o token.");
        return 3;
    }
    catch (OperationCanceledException) { break; }
    catch (Exception ex)
    {
        Log.Aviso($"Erro (vou tentar de novo em 30 s): {ex.Message}");
        try { await Task.Delay(TimeSpan.FromSeconds(30), parar.Token); } catch (OperationCanceledException) { break; }
    }
}

return 0;

static (long usado, long livre) Espaco(WorkerConfig cfg)
{
    long usado = 0;
    try
    {
        // Só os vídeos entregues contam; a pasta _trabalho é temporária.
        foreach (var f in new DirectoryInfo(cfg.PastaSaida).EnumerateFiles("*", SearchOption.AllDirectories))
            if (!f.FullName.Contains(Path.DirectorySeparatorChar + "_trabalho" + Path.DirectorySeparatorChar)) usado += f.Length;
    }
    catch { /* pasta ainda não existe */ }
    long livre = 0;
    try { livre = new DriveInfo(Path.GetPathRoot(cfg.PastaSaida)!).AvailableFreeSpace; } catch { }
    return (usado, livre);
}

static async Task<int> Verificar(WorkerConfig cfg)
{
    var ok = true;
    void Item(bool bom, string texto) { Console.WriteLine((bom ? "[ok]    " : "[FALHA] ") + texto); ok &= bom; }

    Console.WriteLine($"Configuração: {WorkerConfig.CaminhoConfig}");
    foreach (var p in cfg.Problemas()) Item(false, p);
    Item(true, $"Pasta dos vídeos: {cfg.PastaSaida}");

    Item(Roda(cfg.Python, "--version", out var py), $"Python: {py}");
    var ff = string.IsNullOrWhiteSpace(cfg.PastaFfmpeg) ? "ffmpeg" : Path.Combine(cfg.PastaFfmpeg, "ffmpeg");
    Item(Roda(ff, "-version", out var f1), $"FFmpeg: {f1.Split('\n')[0]}");
    Item(Roda(cfg.Python, "-c \"import edge_tts; print('edge-tts ok')\"", out var et), $"edge-tts: {et}");

    if (cfg.Problemas().Count == 0)
    {
        try { await new ApiCliente(cfg).PingAsync(CancellationToken.None); Item(true, $"API {cfg.ApiUrl}: conectou e o token é válido"); }
        catch (Exception ex) { Item(false, $"API {cfg.ApiUrl}: {ex.Message}"); }
    }

    Console.WriteLine(ok ? "\nTudo certo: pode iniciar o worker." : "\nCorrija os itens acima antes de iniciar.");
    return ok ? 0 : 1;
}

static bool Roda(string exe, string argumentos, out string saida)
{
    try
    {
        var i = new ProcessStartInfo(exe, argumentos) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        using var p = Process.Start(i)!;
        saida = (p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd()).Trim();
        p.WaitForExit(15000);
        saida = saida.Length == 0 ? "(sem resposta)" : saida[..Math.Min(120, saida.Length)];
        return p.ExitCode == 0;
    }
    catch (Exception ex) { saida = "não encontrado (" + ex.Message + ")"; return false; }
}
