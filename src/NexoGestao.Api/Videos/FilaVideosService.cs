using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Videos;

// Configuração do worker local de vídeo. DESLIGADO por padrão: em produção (Render)
// não há FFmpeg nem deve haver processamento pesado no mesmo processo que atende
// os clientes. Ligue só na máquina de desenvolvimento/worker própria, via user-secrets
// ou variáveis de ambiente (Videos__Worker__Habilitado=true etc.) — nada disso vai pro Git.
public class VideosWorkerOptions
{
    public bool Habilitado { get; set; }
    public string? Python { get; set; }
    public string? Gerador { get; set; }
    public string? PastaFfmpeg { get; set; }
    public string? Fonte { get; set; }
    public string? Musica { get; set; }
    public string MusicaCredito { get; set; } = "";
    public string? PastaSaida { get; set; }
    public int MaximoPorHora { get; set; } = 30;
    public int TentativasMaximas { get; set; } = 2;
    public int MinimoDeFotos { get; set; } = 3;
    public int TimeoutMinutos { get; set; } = 6;
}

public class FilaVideosService : BackgroundService
{
    private const string HostImagens = "down-br.img.susercontent.com";
    private const long MaxBytesImagem = 5_000_000;

    private readonly IServiceScopeFactory _escopos;
    private readonly IHttpClientFactory _httpFactory;
    private readonly VideosWorkerOptions _opcoes;
    private readonly ILogger<FilaVideosService> _log;
    private readonly IHostEnvironment _ambiente;

    public FilaVideosService(IServiceScopeFactory escopos, IHttpClientFactory httpFactory,
        IOptions<VideosWorkerOptions> opcoes, ILogger<FilaVideosService> log, IHostEnvironment ambiente)
    {
        _escopos = escopos;
        _httpFactory = httpFactory;
        _opcoes = opcoes.Value;
        _log = log;
        _ambiente = ambiente;
    }

    public static string PastaSaida(VideosWorkerOptions o, IHostEnvironment amb) =>
        o.PastaSaida ?? Path.Combine(amb.ContentRootPath, "storage", "videos");

    protected override async Task ExecuteAsync(CancellationToken parar)
    {
        if (!_opcoes.Habilitado)
        {
            _log.LogInformation("Worker de vídeo desligado (Videos:Worker:Habilitado=false). Tarefas ficam Pendentes.");
            return;
        }

        var faltando = new[] { ("Python", _opcoes.Python), ("Gerador", _opcoes.Gerador), ("Fonte", _opcoes.Fonte), ("Musica", _opcoes.Musica) }
            .Where(x => string.IsNullOrWhiteSpace(x.Item2) || !File.Exists(x.Item2)).Select(x => x.Item1).ToList();
        if (faltando.Count > 0)
        {
            _log.LogError("Worker de vídeo habilitado mas faltam/estão inválidos: {Itens}", string.Join(", ", faltando));
            return;
        }

        _log.LogInformation("Worker de vídeo ligado (1 por vez, máx. {Max}/hora).", _opcoes.MaximoPorHora);
        while (!parar.IsCancellationRequested)
        {
            try
            {
                var trabalhou = await ProcessarProximoAsync(parar);
                if (!trabalhou)
                    await Task.Delay(TimeSpan.FromSeconds(4), parar);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Erro inesperado no worker de vídeo");
                await Task.Delay(TimeSpan.FromSeconds(10), parar);
            }
        }
    }

    private async Task<bool> ProcessarProximoAsync(CancellationToken ct)
    {
        using var escopo = _escopos.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();

        // Limite de processamento por hora (configurável) — protege a máquina.
        var umaHoraAtras = DateTime.UtcNow.AddHours(-1);
        var recentes = await db.VideosAfiliados.IgnoreQueryFilters()
            .CountAsync(v => v.AtualizadoEm >= umaHoraAtras && (v.Status == StatusVideoAfiliado.Pronto || v.Status == StatusVideoAfiliado.Processando), ct);
        if (recentes >= _opcoes.MaximoPorHora)
            return false;

        var video = await db.VideosAfiliados.IgnoreQueryFilters()
            .Where(v => v.Status == StatusVideoAfiliado.Pendente)
            .OrderBy(v => v.Id).FirstOrDefaultAsync(ct);
        if (video is null)
            return false;

        video.Status = StatusVideoAfiliado.Processando;
        video.Tentativas++;
        video.Mensagem = null;
        video.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var relogio = Stopwatch.StartNew();
        var pastaTrabalho = Path.Combine(PastaSaida(_opcoes, _ambiente), "_trabalho", video.Id.ToString());
        try
        {
            await ExecutarAsync(db, escopo.ServiceProvider.GetRequiredService<ShopeeMetadataFetcher>(), video, pastaTrabalho, ct);
            video.TempoProcessamentoSegundos = Math.Round(relogio.Elapsed.TotalSeconds, 1);
        }
        catch (SemMateriaisException ex)
        {
            video.Status = StatusVideoAfiliado.SemMateriais;
            video.Mensagem = ex.Message;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning(ex, "Falha ao gerar vídeo {Id} (tentativa {T})", video.Id, video.Tentativas);
            var final = video.Tentativas >= _opcoes.TentativasMaximas;
            video.Status = final ? StatusVideoAfiliado.Erro : StatusVideoAfiliado.Pendente;
            video.Mensagem = (final ? "Falhou após as tentativas: " : $"Tentativa {video.Tentativas} falhou, vai tentar de novo: ") + ex.Message;
        }
        finally
        {
            try { if (Directory.Exists(pastaTrabalho)) Directory.Delete(pastaTrabalho, true); } catch { /* limpeza best-effort */ }
        }

        video.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    private sealed class SemMateriaisException(string mensagem) : Exception(mensagem);

    private async Task ExecutarAsync(AppDbContext db, ShopeeMetadataFetcher fetcher, VideoAfiliado video, string pasta, CancellationToken ct)
    {
        var produto = await db.ProdutosAfiliados.IgnoreQueryFilters().FirstAsync(p => p.Id == video.ProdutoAfiliadoId, ct);
        Directory.CreateDirectory(pasta);

        // 1) Dados adicionais e fotos pelo link do produto (página pública do anúncio).
        var materiais = await fetcher.LerMateriaisAsync(produto.LinkOriginal, 9, ct)
            ?? throw new Exception("Não foi possível ler a página pública do anúncio (fora do ar, bloqueio temporário ou link inválido).");

        if (materiais.Imagens.Count < _opcoes.MinimoDeFotos)
            throw new SemMateriaisException($"O anúncio tem só {materiais.Imagens.Count} foto(s) na galeria; o mínimo pra montar um vídeo variado é {_opcoes.MinimoDeFotos}. Nada foi inventado pra completar.");

        // 2) Baixa as fotos com validação (host fixo, tamanho, tipo).
        var locais = new List<string>();
        var hashes = new HashSet<string>();
        var http = _httpFactory.CreateClient("imagens-anuncio");
        for (var i = 0; i < materiais.Imagens.Count; i++)
        {
            var url = materiais.Imagens[i];
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps || u.Host != HostImagens)
                continue;

            using var resp = await http.GetAsync(u, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!resp.IsSuccessStatusCode || resp.Content.Headers.ContentType?.MediaType?.StartsWith("image/") != true)
                continue;
            if (resp.Content.Headers.ContentLength is > MaxBytesImagem)
                continue;

            var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length is 0 or > (int)MaxBytesImagem)
                continue;

            // Mesma foto repetida na galeria com IDs diferentes: usa uma vez só (não conta como foto nova).
            if (!hashes.Add(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))))
                continue;

            var nome = $"img_{locais.Count}.jpg";
            await File.WriteAllBytesAsync(Path.Combine(pasta, nome), bytes, ct);
            locais.Add(nome);
        }

        if (locais.Count < _opcoes.MinimoDeFotos)
            throw new SemMateriaisException($"Só {locais.Count} das {materiais.Imagens.Count} fotos do anúncio puderam ser baixadas com segurança (mínimo {_opcoes.MinimoDeFotos}).");

        // Nome do CSV vem truncado pelo export: completa com o título da página, se for a mesma frase.
        var nomeCsv = produto.Nome.Trim();
        if (materiais.Titulo.Length > nomeCsv.Length && materiais.Titulo.StartsWith(nomeCsv, StringComparison.OrdinalIgnoreCase))
            produto.Nome = materiais.Titulo;
        produto.ImagemUrl ??= materiais.Imagens[0];
        if (produto.Categoria is null && materiais.Categorias.Count > 0)
            produto.Categoria = materiais.Categorias[^1];

        // 3) Roteiro automático por categoria (título + categoria da página + fotos + observação de revisão).
        var roteiro = RoteiroAutomatico.Gerar(materiais.Titulo, produto.ItemId ?? video.Id, locais, materiais.Categorias, video.ObservacaoRevisao);
        video.CategoriaDetectada = roteiro.Categoria.ToString();
        await File.WriteAllTextAsync(Path.Combine(pasta, "roteiro.json"), roteiro.RoteiroJson, new UTF8Encoding(false), ct);
        File.Copy(_opcoes.Fonte!, Path.Combine(pasta, "fonte.ttf"), true);

        // 4) Gerador existente (tools/video-afiliado/gerar_video.py).
        var info = new ProcessStartInfo(_opcoes.Python!)
        {
            WorkingDirectory = pasta,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            UseShellExecute = false,
        };
        info.ArgumentList.Add(_opcoes.Gerador!);
        info.ArgumentList.Add("roteiro.json");
        info.ArgumentList.Add("saida");
        info.Environment["PYTHONIOENCODING"] = "utf-8";
        info.Environment["FONTE_TTF"] = "fonte.ttf";
        info.Environment["MUSICA_FUNDO"] = _opcoes.Musica!;
        if (!string.IsNullOrWhiteSpace(_opcoes.PastaFfmpeg))
        {
            info.Environment["PATH"] = _opcoes.PastaFfmpeg + Path.PathSeparator + Environment.GetEnvironmentVariable("PATH");
            info.Environment["FFMPEG_BIN"] = Path.Combine(_opcoes.PastaFfmpeg, "ffmpeg");
            info.Environment["FFPROBE_BIN"] = Path.Combine(_opcoes.PastaFfmpeg, "ffprobe");
        }

        using var proc = Process.Start(info) ?? throw new Exception("Não foi possível iniciar o gerador de vídeo.");
        var saidaTask = proc.StandardOutput.ReadToEndAsync(ct);
        var erroTask = proc.StandardError.ReadToEndAsync(ct);

        using var limite = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limite.CancelAfter(TimeSpan.FromMinutes(_opcoes.TimeoutMinutos));
        try { await proc.WaitForExitAsync(limite.Token); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            try { proc.Kill(true); } catch { /* já terminou */ }
            throw new Exception($"O gerador passou de {_opcoes.TimeoutMinutos} min e foi interrompido.");
        }

        var saida = await saidaTask;
        var erro = await erroTask;
        var arquivo = Path.Combine(pasta, "saida.mp4");
        if (proc.ExitCode != 0 || !File.Exists(arquivo))
        {
            var detalhe = (string.IsNullOrWhiteSpace(erro) ? saida : erro).Trim();
            throw new Exception("O gerador falhou: " + (detalhe.Length > 300 ? detalhe[^300..] : detalhe));
        }

        // 5) Guarda o MP4 em disco (nunca no banco) e registra a tarefa.
        var destinoDir = Path.Combine(PastaSaida(_opcoes, _ambiente), video.EmpresaId.ToString());
        Directory.CreateDirectory(destinoDir);
        var destino = Path.Combine(destinoDir, $"{video.Id}.mp4");
        File.Move(arquivo, destino, true);

        var duracao = Regex.Match(saida, @"saida\.mp4\D+(\d+[.,]\d+)s");
        video.DuracaoSegundos = duracao.Success ? double.Parse(duracao.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture) : null;
        video.TamanhoBytes = new FileInfo(destino).Length;
        video.ArquivoRelativo = Path.Combine(video.EmpresaId.ToString(), $"{video.Id}.mp4");
        video.VersaoRoteiro = roteiro.Versao;
        video.RoteiroJson = roteiro.RoteiroJson;
        video.Legenda = roteiro.Legenda;
        video.Hashtags = roteiro.Hashtags;
        video.MateriaisJson = JsonSerializer.Serialize(materiais.Imagens);
        video.MateriaisLidosEm = materiais.LidoEm;
        video.MusicaCredito = _opcoes.MusicaCredito;
        video.Status = StatusVideoAfiliado.Pronto;
        video.Mensagem = materiais.FotosIgnoradasDeOutrasVersoes > 0
            ? $"Aviso: {materiais.FotosIgnoradasDeOutrasVersoes} foto(s) da galeria foram ignoradas por parecerem de outra versão do anúncio (outro lote de upload). Só entraram fotos enviadas junto com a capa."
            : null;
    }
}
