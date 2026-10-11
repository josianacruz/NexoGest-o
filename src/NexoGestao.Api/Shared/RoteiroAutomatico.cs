using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public record RoteiroGerado(string Versao, string RoteiroJson, string Legenda, string Hashtags);

// Roteiro automático por modelo (sem IA paga, sem inventar nada): usa SÓ o
// título completo do anúncio e as fotos da galeria. Não afirma estado, preço,
// desempenho, popularidade, desconto nem experiência pessoal. Três famílias de
// abertura (escolhidas pelo Item Id) pra lotes não ficarem todos iguais.
//
// Limitação honesta: por partir só do título, o texto é mais genérico do que um
// roteiro escrito à mão com os detalhes reais do produto — por isso o resultado
// deve ser revisado antes de publicar.
public static class RoteiroAutomatico
{
    private static readonly HashSet<string> Palavrinhas = new(StringComparer.OrdinalIgnoreCase)
    { "de", "da", "do", "das", "dos", "e", "com", "sem", "para", "pra", "em", "na", "no", "a", "o", "c/", "p/", "tp", "kit" };

    public static RoteiroGerado Gerar(string tituloCompleto, long itemId, IReadOnlyList<string> imagens, string? categoria)
    {
        var titulo = Regex.Replace(tituloCompleto, @"\s+", " ").Trim().TrimEnd('-', '–', '.', ',', ' ');
        var palavras = titulo.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();

        var qtdCurto = Math.Min(3, palavras.Count);
        while (qtdCurto > 1 && Palavrinhas.Contains(palavras[qtdCurto - 1]))
            qtdCurto--;

        var curto = string.Join(' ', palavras.Take(qtdCurto));
        var detalhes = string.Join(' ', palavras.Skip(qtdCurto).Take(9));
        var temDetalhes = detalhes.Length > 0;

        var variante = (int)(itemId % 3);
        var n = imagens.Count;
        string Img(int i) => imagens[i % n];

        string fala1, legenda1, fala2, legenda2, fala3, legenda3, fala4, legenda4, fala5;
        switch (variante)
        {
            case 0:
                fala1 = $"Procurando {Fala(curto)}?";
                legenda1 = $"Procurando {Reduz(curto, 40)}?";
                fala2 = temDetalhes ? $"O anúncio descreve assim: {Fala(detalhes)}." : "Olha esse item de perto.";
                legenda2 = temDetalhes ? $"Anúncio: {Reduz(detalhes, 55)}" : "Olha esse item de perto.";
                fala3 = "Nas fotos dá pra ver o produto de vários ângulos.";
                legenda3 = "Várias fotos do produto, de vários ângulos.";
                fala4 = "Antes de comprar, confira no anúncio os detalhes, as medidas e o que vem junto.";
                legenda4 = "Confira no anúncio detalhes, medidas e o que vem junto.";
                fala5 = "Veja as fotos e as opções no produto marcado.";
                break;
            case 1:
                fala1 = $"Se você precisa de {Fala(curto)}, olha só.";
                legenda1 = $"Precisa de {Reduz(curto, 38)}? Olha só.";
                fala2 = temDetalhes ? $"O anúncio traz: {Fala(detalhes)}." : "Dá uma olhada de perto.";
                legenda2 = temDetalhes ? $"Anúncio traz: {Reduz(detalhes, 52)}" : "Dá uma olhada de perto.";
                fala3 = "Dá pra ver o produto por vários ângulos nas fotos.";
                legenda3 = "Produto visto por vários ângulos nas fotos.";
                fala4 = "Confira no anúncio as medidas e o que acompanha, antes de decidir.";
                legenda4 = "Confira medidas e o que acompanha antes de decidir.";
                fala5 = "As opções estão no produto marcado.";
                break;
            default:
                fala1 = $"Uma dica pra quem busca {Fala(curto)}.";
                legenda1 = $"Dica pra quem busca {Reduz(curto, 38)}.";
                fala2 = temDetalhes ? $"Segundo o anúncio: {Fala(detalhes)}." : "Veja de perto.";
                legenda2 = temDetalhes ? $"Segundo o anúncio: {Reduz(detalhes, 48)}" : "Veja de perto.";
                fala3 = "As fotos mostram o produto de vários lados.";
                legenda3 = "As fotos mostram o produto de vários lados.";
                fala4 = "Antes de escolher, confira os detalhes e as medidas no anúncio.";
                legenda4 = "Antes de escolher, confira detalhes e medidas no anúncio.";
                fala5 = "Veja o produto e as opções no produto marcado.";
                break;
        }

        var cenas = new object[]
        {
            Cena(fala1, legenda1, "pergunta", (Img(0), 1.0)),
            Cena(fala2, legenda2, "explicacao", (Img(1), 0.5), (Img(2), 0.5)),
            Cena(fala3, legenda3, "explicacao", (Img(3), 0.5), (Img(4), 0.5)),
            Cena(fala4, legenda4, "explicacao", (Img(5), 0.5), (Img(6), 0.5)),
            Cena(fala5, fala5, "fechamento", (Img(1), 1.0)),
        };

        var versao = $"auto-v1-{(char)('A' + variante)}";
        var json = JsonSerializer.Serialize(new { versao, cenas }, new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

        var legendaPost = $"{Reduz(curto, 60)} — veja as fotos e as opções no produto marcado.";
        return new RoteiroGerado(versao, json, legendaPost, Hashtags(palavras, categoria));
    }

    private static object Cena(string fala, string legenda, string tom, params (string img, double fracao)[] shots) => new
    {
        fala,
        legenda,
        tom,
        shots = shots.Select(s => new { imagem = s.img, crop = (string?)null, fracao = s.fracao }).ToArray(),
    };

    // Texto pra voz: anos "2016-2023" -> "2016 a 2023", "1.0" -> "1 ponto 0", MAIÚSCULAS -> minúsculas, símbolos soltos fora.
    private static string Fala(string s)
    {
        s = Regex.Replace(s, @"(\d{4})\s*-\s*(\d{4})", "$1 a $2");
        s = Regex.Replace(s, @"\b(\d)\.(\d)\b", "$1 ponto $2");
        s = Regex.Replace(s, @"\b[A-ZÀ-Ý]{4,}\b", m => m.Value.ToLowerInvariant());
        s = Regex.Replace(s, @"[()\[\]{}|•–—+/]", " ");
        return Regex.Replace(s, @"\s+", " ").Trim().TrimEnd('.', ',');
    }

    // Legenda curta: corta em limite de palavra, nunca no meio.
    private static string Reduz(string s, int max)
    {
        s = Regex.Replace(s, @"\s+", " ").Trim();
        if (s.Length <= max) return s;
        var corte = s.LastIndexOf(' ', max);
        return (corte > 10 ? s[..corte] : s[..max]).TrimEnd(',', '-', '(', ' ');
    }

    private static string Hashtags(List<string> palavras, string? categoria)
    {
        string Limpa(string p)
        {
            var d = p.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in d)
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))
                    sb.Append(char.ToLowerInvariant(c));
            return sb.ToString();
        }

        var tags = new List<string> { "#shopee" };
        var fontes = palavras.Concat((categoria ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        foreach (var p in fontes)
        {
            var t = Limpa(p);
            if (t.Length < 4 || Palavrinhas.Contains(t) || t.All(char.IsDigit)) continue;
            var tag = "#" + t;
            if (!tags.Contains(tag)) tags.Add(tag);
            if (tags.Count >= 5) break;
        }
        return string.Join(' ', tags);
    }
}
