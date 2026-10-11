using System.Text.Json;

namespace NexoGestao.Worker;

// Configuração do worker. Fica FORA do repositório: %LOCALAPPDATA%\NexoWorker\config.json
// (ou o arquivo apontado por NEXO_WORKER_CONFIG). O token pode vir de NEXO_WORKER_TOKEN.
public sealed class WorkerConfig
{
    public string ApiUrl { get; set; } = "";
    public string Token { get; set; } = "";
    public string Python { get; set; } = "python";
    public string Gerador { get; set; } = "";
    public string PastaFfmpeg { get; set; } = "";
    public string Fonte { get; set; } = "";
    public string Musica { get; set; } = "";
    public string MusicaCredito { get; set; } = "";
    public string PastaSaida { get; set; } = "";
    public int TimeoutMinutos { get; set; } = 6;
    public int MinimoDeFotos { get; set; } = 3;
    public int MaximoPorHora { get; set; } = 30;
    public int IntervaloSegundos { get; set; } = 15;

    public static string PastaConfig =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NexoWorker");

    public static string CaminhoConfig =>
        Environment.GetEnvironmentVariable("NEXO_WORKER_CONFIG") is { Length: > 0 } c ? c : Path.Combine(PastaConfig, "config.json");

    public static WorkerConfig Carregar()
    {
        var cfg = new WorkerConfig();
        if (File.Exists(CaminhoConfig))
            cfg = JsonSerializer.Deserialize<WorkerConfig>(File.ReadAllText(CaminhoConfig),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true, ReadCommentHandling = JsonCommentHandling.Skip }) ?? cfg;

        if (Environment.GetEnvironmentVariable("NEXO_WORKER_TOKEN") is { Length: > 0 } t) cfg.Token = t;
        if (Environment.GetEnvironmentVariable("NEXO_API_URL") is { Length: > 0 } u) cfg.ApiUrl = u;

        var baseDir = AppContext.BaseDirectory;
        if (cfg.Gerador.Length == 0) cfg.Gerador = Path.Combine(baseDir, "gerador", "gerar_video.py");
        if (cfg.Musica.Length == 0) cfg.Musica = Path.Combine(baseDir, "recursos", "musica_fundo.wav");
        if (cfg.Fonte.Length == 0) cfg.Fonte = OperatingSystem.IsWindows() ? @"C:\Windows\Fonts\arialbd.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
        if (cfg.PastaSaida.Length == 0)
            cfg.PastaSaida = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "NexoVideos");
        cfg.PastaSaida = Path.GetFullPath(cfg.PastaSaida);
        cfg.ApiUrl = cfg.ApiUrl.TrimEnd('/');
        return cfg;
    }

    // Itens que impedem o worker de funcionar (lista vazia = tudo certo).
    public List<string> Problemas()
    {
        var p = new List<string>();
        if (!Uri.TryCreate(ApiUrl, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttps && !u.IsLoopback))
            p.Add("ApiUrl inválida (use https://…; http só é aceito em localhost).");
        if (string.IsNullOrWhiteSpace(Token)) p.Add("Token do worker não configurado (NEXO_WORKER_TOKEN ou config.json).");
        if (!File.Exists(Gerador)) p.Add($"Gerador de vídeo não encontrado: {Gerador}");
        if (!File.Exists(Fonte)) p.Add($"Fonte não encontrada: {Fonte}");
        if (!File.Exists(Musica)) p.Add($"Música não encontrada: {Musica}");
        return p;
    }
}
