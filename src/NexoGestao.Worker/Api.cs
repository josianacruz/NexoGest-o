using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NexoGestao.Worker;

public sealed class CredencialInvalidaException : Exception
{
    public CredencialInvalidaException() : base("A API recusou o token (inválido ou revogado).") { }
}

public sealed record Produto(int Id, string Nome, string LinkOriginal, string? LinkAfiliado, long? ItemId, string? ImagemUrl, string? Categoria);
public sealed record Tarefa(int Id, int EmpresaId, int Tentativas, string? ObservacaoRevisao, Produto Produto);
public sealed record RespostaProxima(Tarefa? Tarefa, string? Motivo);

// Todas as chamadas são de SAÍDA (HTTPS) para a API; o worker nunca abre porta no PC.
public sealed class ApiCliente
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http;

    public ApiCliente(WorkerConfig cfg)
    {
        _http = new HttpClient { BaseAddress = new Uri(cfg.ApiUrl + "/"), Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Add("X-Worker-Token", cfg.Token);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("NexoWorker/1.0");
    }

    private static async Task<T> Ler<T>(HttpResponseMessage r)
    {
        if (r.StatusCode == HttpStatusCode.Unauthorized) throw new CredencialInvalidaException();
        if (!r.IsSuccessStatusCode)
        {
            var corpo = await r.Content.ReadAsStringAsync();
            throw new HttpRequestException($"API respondeu {(int)r.StatusCode}: {corpo[..Math.Min(300, corpo.Length)]}");
        }
        return (await r.Content.ReadFromJsonAsync<T>(Json))!;
    }

    public async Task PingAsync(CancellationToken ct)
    {
        using var r = await _http.GetAsync("api/worker/ping", ct);
        await Ler<JsonElement>(r);
    }

    public async Task<RespostaProxima> ProximaAsync(object contato, CancellationToken ct)
    {
        using var r = await _http.PostAsJsonAsync("api/worker/proxima", contato, Json, ct);
        return await Ler<RespostaProxima>(r);
    }

    // true = a tarefa não está mais em andamento: pare.
    public async Task<bool> BatimentoAsync(int id, CancellationToken ct)
    {
        using var r = await _http.PostAsync($"api/worker/{id}/batimento", null, ct);
        var o = await Ler<JsonElement>(r);
        return o.TryGetProperty("cancelar", out var c) && c.GetBoolean();
    }

    public async Task ConcluirAsync(int id, object corpo, CancellationToken ct)
    {
        using var r = await _http.PostAsJsonAsync($"api/worker/{id}/concluir", corpo, Json, ct);
        await Ler<JsonElement>(r);
    }

    public async Task FalharAsync(int id, string tipo, string mensagem, CancellationToken ct)
    {
        using var r = await _http.PostAsJsonAsync($"api/worker/{id}/falhar", new { tipo, mensagem }, Json, ct);
        await Ler<JsonElement>(r);
    }
}
