using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NexoGestao.Api.Shared;

namespace NexoGestao.Worker;

public sealed class SemMateriaisException(string mensagem) : Exception(mensagem);

// Gera UM vídeo: lê a página pública do anúncio, baixa as fotos (validadas), monta o roteiro por regras,
// roda o gerador (Python + FFmpeg) e deixa o MP4 e um .txt (legenda, hashtags, links) na pasta local.
public sealed class Processador
{
    private const string HostImagens = "down-br.img.susercontent.com";
    private const long MaxBytesImagem = 5_000_000;

    private readonly WorkerConfig _cfg;
    private readonly ApiCliente _api;
    private readonly ShopeeMetadataFetcher _fetcher;
    private readonly HttpClient _imagens;

    public Processador(WorkerConfig cfg, ApiCliente api)
    {
        _cfg = cfg;
        _api = api;
        _fetcher = new ShopeeMetadataFetcher(new HttpClient());
        _imagens = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
        _imagens.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        _imagens.DefaultRequestVersion = new Version(1, 1);
        _imagens.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact;
    }

    public async Task ExecutarAsync(Tarefa t, CancellationToken parar)
    {
        var relogio = Stopwatch.StartNew();
        var pasta = Path.Combine(_cfg.PastaSaida, "_trabalho", t.Id.ToString());
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(parar);
        var batimento = BatimentosAsync(t.Id, cts);
        try
        {
            var resultado = await GerarAsync(t, pasta, relogio, cts.Token);
            await _api.ConcluirAsync(t.Id, resultado.Corpo, CancellationToken.None);
            Log.Info($"Vídeo {t.Id} pronto: {resultado.Arquivo}");
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested && !parar.IsCancellationRequested)
        {
            Log.Info($"Tarefa {t.Id} cancelada pelo servidor; abandonando.");
        }
        catch (SemMateriaisException ex)
        {
            await _api.FalharAsync(t.Id, "SemMateriais", ex.Message, CancellationToken.None);
            Log.Info($"Tarefa {t.Id}: sem materiais suficientes ({ex.Message})");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log.Aviso($"Falha na tarefa {t.Id}: {ex.Message}");
            await _api.FalharAsync(t.Id, "Erro", ex.Message, CancellationToken.None);
        }
        finally
        {
            cts.Cancel();
            try { await batimento; } catch { /* encerrado */ }
            try { if (Directory.Exists(pasta)) Directory.Delete(pasta, true); } catch { /* limpeza do temporário */ }
        }
    }

    // Renova a "locação" da tarefa a cada minuto; se o servidor disser que ela não vale mais, interrompe o trabalho.
    private async Task BatimentosAsync(int id, CancellationTokenSource cts)
    {
        try
        {
            while (!cts.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(60), cts.Token);
                if (await _api.BatimentoAsync(id, cts.Token)) cts.Cancel();
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { Log.Aviso($"Batimento falhou: {ex.Message}"); }
    }

    private async Task<(object Corpo, string Arquivo)> GerarAsync(Tarefa t, string pasta, Stopwatch relogio, CancellationToken ct)
    {
        Directory.CreateDirectory(pasta);

        // 1) Dados adicionais e fotos pelo link do produto (página pública do anúncio).
        var materiais = await _fetcher.LerMateriaisAsync(t.Produto.LinkOriginal, 9, ct)
            ?? throw new Exception("Não foi possível ler a página pública do anúncio (fora do ar, bloqueio temporário ou link inválido).");
        if (materiais.Imagens.Count < _cfg.MinimoDeFotos)
            throw new SemMateriaisException($"O anúncio tem só {materiais.Imagens.Count} foto(s) na galeria; o mínimo pra montar um vídeo variado é {_cfg.MinimoDeFotos}. Nada foi inventado pra completar.");

        // 2) Baixa as fotos com validação (host fixo, https, tipo e tamanho); duplicadas (mesmo conteúdo) valem uma vez.
        var locais = new List<string>();
        var hashes = new HashSet<string>();
        foreach (var url in materiais.Imagens)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps || u.Host != HostImagens) continue;
            using var resp = await _imagens.GetAsync(u, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!resp.IsSuccessStatusCode || resp.Content.Headers.ContentType?.MediaType?.StartsWith("image/") != true) continue;
            if (resp.Content.Headers.ContentLength is > MaxBytesImagem) continue;
            var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length is 0 or > (int)MaxBytesImagem) continue;
            if (!hashes.Add(Convert.ToHexString(SHA256.HashData(bytes)))) continue;
            var nome = $"img_{locais.Count}.jpg";
            await File.WriteAllBytesAsync(Path.Combine(pasta, nome), bytes, ct);
            locais.Add(nome);
        }
        if (locais.Count < _cfg.MinimoDeFotos)
            throw new SemMateriaisException($"Só {locais.Count} das {materiais.Imagens.Count} fotos do anúncio puderam ser baixadas com segurança (mínimo {_cfg.MinimoDeFotos}).");

        // 3) Roteiro por regras (título + categoria da página + fotos + observação de revisão).
        var roteiro = RoteiroAutomatico.Gerar(materiais.Titulo, t.Produto.ItemId ?? t.Id, locais, materiais.Categorias, t.ObservacaoRevisao);
        await File.WriteAllTextAsync(Path.Combine(pasta, "roteiro.json"), roteiro.RoteiroJson, new UTF8Encoding(false), ct);
        File.Copy(_cfg.Fonte, Path.Combine(pasta, "fonte.ttf"), true);

        // 4) Gerador compartilhado (tools/video-afiliado/gerar_video.py), um processo por vez.
        var info = new ProcessStartInfo(_cfg.Python)
        {
            WorkingDirectory = pasta,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        info.ArgumentList.Add(_cfg.Gerador);
        info.ArgumentList.Add("roteiro.json");
        info.ArgumentList.Add("saida");
        info.Environment["PYTHONIOENCODING"] = "utf-8";
        info.Environment["FONTE_TTF"] = "fonte.ttf";
        info.Environment["MUSICA_FUNDO"] = _cfg.Musica;
        if (!string.IsNullOrWhiteSpace(_cfg.PastaFfmpeg))
        {
            info.Environment["PATH"] = _cfg.PastaFfmpeg + Path.PathSeparator + Environment.GetEnvironmentVariable("PATH");
            info.Environment["FFMPEG_BIN"] = Path.Combine(_cfg.PastaFfmpeg, "ffmpeg");
            info.Environment["FFPROBE_BIN"] = Path.Combine(_cfg.PastaFfmpeg, "ffprobe");
        }

        using var proc = Process.Start(info) ?? throw new Exception("Não foi possível iniciar o gerador de vídeo (Python instalado?).");
        var saidaTask = proc.StandardOutput.ReadToEndAsync(ct);
        var erroTask = proc.StandardError.ReadToEndAsync(ct);
        using var limite = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limite.CancelAfter(TimeSpan.FromMinutes(_cfg.TimeoutMinutos));
        try { await proc.WaitForExitAsync(limite.Token); }
        catch (OperationCanceledException)
        {
            try { proc.Kill(true); } catch { /* já terminou */ }
            if (ct.IsCancellationRequested) throw;
            throw new Exception($"O gerador passou de {_cfg.TimeoutMinutos} min e foi interrompido.");
        }

        var saida = await saidaTask;
        var erro = await erroTask;
        var arquivo = Path.Combine(pasta, "saida.mp4");
        if (proc.ExitCode != 0 || !File.Exists(arquivo))
        {
            var detalhe = (string.IsNullOrWhiteSpace(erro) ? saida : erro).Trim();
            throw new Exception("O gerador falhou: " + (detalhe.Length > 300 ? detalhe[^300..] : detalhe));
        }

        // 5) MP4 + .txt (legenda, hashtags e links) na pasta local; nada disso vai para o banco.
        var slug = Regex.Replace(Normaliza(t.Produto.Nome), "[^a-z0-9]+", "-").Trim('-');
        slug = slug.Length > 40 ? slug[..40].TrimEnd('-') : slug;
        var relativo = Path.Combine(t.EmpresaId.ToString(), $"{slug}_{t.Id}.mp4");
        var destino = Path.Combine(_cfg.PastaSaida, relativo);
        Directory.CreateDirectory(Path.GetDirectoryName(destino)!);
        File.Move(arquivo, destino, true);
        await File.WriteAllTextAsync(Path.ChangeExtension(destino, ".txt"),
            $"{t.Produto.Nome}\r\n\r\nLegenda:\r\n{roteiro.Legenda}\r\n\r\nHashtags:\r\n{roteiro.Hashtags}\r\n\r\nLink original:\r\n{t.Produto.LinkOriginal}\r\n\r\nLink de afiliada:\r\n{t.Produto.LinkAfiliado ?? "(não informado)"}\r\n",
            new UTF8Encoding(false), ct);

        var duracao = Regex.Match(saida, @"saida\.mp4\D+(\d+[.,]\d+)s");
        var corpo = new
        {
            RoteiroJson = roteiro.RoteiroJson,
            Legenda = roteiro.Legenda,
            Hashtags = roteiro.Hashtags,
            Categoria = roteiro.Categoria.ToString(),
            VersaoRoteiro = roteiro.Versao,
            MateriaisJson = JsonSerializer.Serialize(materiais.Imagens),
            MateriaisLidosEm = materiais.LidoEm,
            MusicaCredito = _cfg.MusicaCredito,
            DuracaoSegundos = duracao.Success ? double.Parse(duracao.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture) : (double?)null,
            TamanhoBytes = new FileInfo(destino).Length,
            TempoProcessamentoSegundos = Math.Round(relogio.Elapsed.TotalSeconds, 1),
            ArquivoRelativo = relativo,
            ArquivoLocal = destino,
            Mensagem = materiais.FotosIgnoradasDeOutrasVersoes > 0
                ? $"Aviso: {materiais.FotosIgnoradasDeOutrasVersoes} foto(s) da galeria foram ignoradas por parecerem de outra versão do anúncio (outro lote de upload). Só entraram fotos enviadas junto com a capa."
                : null,
            NomeProduto = materiais.Titulo,
            ImagemUrl = materiais.Imagens[0],
            CategoriaProduto = materiais.Categorias.Count > 0 ? materiais.Categorias[^1] : null,
        };
        return (corpo, destino);
    }

    private static string Normaliza(string s)
    {
        var d = s.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        return new string(d.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }
}

public static class Log
{
    private static readonly object Trava = new();
    private static readonly string Arquivo = Path.Combine(WorkerConfig.PastaConfig, "worker.log");

    private static void Escreve(string nivel, string msg)
    {
        var linha = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{nivel}] {msg}";
        lock (Trava)
        {
            Console.WriteLine(linha);
            try { Directory.CreateDirectory(WorkerConfig.PastaConfig); File.AppendAllText(Arquivo, linha + Environment.NewLine); } catch { /* log é opcional */ }
        }
    }

    public static void Info(string msg) => Escreve("info", msg);
    public static void Aviso(string msg) => Escreve("aviso", msg);
}
