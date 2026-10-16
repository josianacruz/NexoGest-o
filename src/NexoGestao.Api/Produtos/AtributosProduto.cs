using System.Text.Json;

namespace NexoGestao.Api.Produtos;

public record OpcaoComPreco(string Nome, decimal Preco);

// Detalhes do item que dependem do nicho da loja. Tudo opcional: o cadastro só mostra os campos do nicho,
// mas a API aceita qualquer combinação (o Dono pode mudar de nicho sem perder o que já cadastrou).
public record AtributosProduto(
    List<OpcaoComPreco>? Adicionais = null, // Alimentos: ex. "Bacon +R$ 3,00"
    string? Ingredientes = null,            // Alimentos
    List<OpcaoComPreco>? Tamanhos = null,   // Alimentos: ex. "Grande R$ 32,00"
    List<string>? Cores = null,             // Moda
    List<string>? Grade = null,             // Moda: PP, P, M, G, GG, XG
    int? DuracaoMinutos = null);            // Beleza/Serviços

public static class AtributosProdutoRegras
{
    public static readonly string[] GradePermitida = { "PP", "P", "M", "G", "GG", "XG" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerOptions.Default) { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    // Limpa e valida; devolve a mensagem de erro (para o BadRequest) ou o JSON pronto para gravar (nulo se estiver vazio).
    public static (string? erro, string? json) Sanitizar(AtributosProduto? a)
    {
        if (a is null)
            return (null, null);

        var adicionais = LimparOpcoes(a.Adicionais, 20, out var e1);
        if (e1 is not null) return ($"Adicionais: {e1}", null);
        var tamanhos = LimparOpcoes(a.Tamanhos, 8, out var e2);
        if (e2 is not null) return ($"Tamanhos: {e2}", null);

        var ingredientes = string.IsNullOrWhiteSpace(a.Ingredientes) ? null : a.Ingredientes.Trim();
        if (ingredientes is { Length: > 300 })
            return ("Ingredientes: no máximo 300 letras.", null);

        var cores = (a.Cores ?? new()).Select(c => (c ?? "").Trim()).Where(c => c.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (cores.Count > 20 || cores.Any(c => c.Length > 20))
            return ("Cores: no máximo 20 cores, cada uma com até 20 letras.", null);

        var grade = (a.Grade ?? new()).Select(g => (g ?? "").Trim().ToUpperInvariant()).Where(g => g.Length > 0).Distinct().ToList();
        if (grade.Any(g => !GradePermitida.Contains(g)))
            return ($"Grade: use apenas {string.Join(", ", GradePermitida)}.", null);
        grade = grade.OrderBy(g => Array.IndexOf(GradePermitida, g)).ToList();

        if (a.DuracaoMinutos is not null && (a.DuracaoMinutos < 5 || a.DuracaoMinutos > 600))
            return ("Duração: entre 5 e 600 minutos.", null);

        var limpo = new AtributosProduto(
            adicionais.Count > 0 ? adicionais : null,
            ingredientes,
            tamanhos.Count > 0 ? tamanhos : null,
            cores.Count > 0 ? cores : null,
            grade.Count > 0 ? grade : null,
            a.DuracaoMinutos);

        var vazio = limpo.Adicionais is null && limpo.Ingredientes is null && limpo.Tamanhos is null && limpo.Cores is null && limpo.Grade is null && limpo.DuracaoMinutos is null;
        return (null, vazio ? null : JsonSerializer.Serialize(limpo, Json));
    }

    public static AtributosProduto? Ler(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try { return JsonSerializer.Deserialize<AtributosProduto>(json, Json); }
        catch (JsonException) { return null; }
    }

    private static List<OpcaoComPreco> LimparOpcoes(List<OpcaoComPreco>? lista, int max, out string? erro)
    {
        erro = null;
        var r = new List<OpcaoComPreco>();
        foreach (var o in lista ?? new())
        {
            var nome = (o?.Nome ?? "").Trim();
            if (nome.Length == 0) continue;
            if (nome.Length > 40) { erro = "nome com até 40 letras."; return r; }
            if (o!.Preco < 0 || o.Preco > 100000) { erro = "preço inválido."; return r; }
            if (r.Any(x => x.Nome.Equals(nome, StringComparison.OrdinalIgnoreCase))) continue;
            r.Add(new OpcaoComPreco(nome, decimal.Round(o.Preco, 2)));
        }
        if (r.Count > max) erro = $"no máximo {max}.";
        return r;
    }
}
