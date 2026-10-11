using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public enum CategoriaProduto { Roupa, Acessorio, Casa, Autopeca, Outros }

public record RoteiroGerado(string Versao, CategoriaProduto Categoria, string RoteiroJson, string Legenda, string Hashtags);

// Modelos de roteiro compartilhados por TODOS os vídeos. A categoria é detectada
// pela categoria da página + título; cada família pergunta o que o comprador
// daquele tipo de produto precisa conferir. Só entram fatos que estão no título,
// na categoria da página ou fornecidos por quem revisou (observação de revisão):
// nada de conforto, qualidade, estado deduzido, desempenho, experiência pessoal,
// popularidade, desconto ou urgência.
//
// Limitação honesta: como parte só de título/categoria/fotos, o texto é mais
// genérico que um roteiro escrito à mão com todos os detalhes do produto —
// por isso deve ser revisado antes de publicar. Quando não há fato suficiente
// pra uma cena (ex.: nenhum atributo reconhecido no título), a cena é omitida
// em vez de ler o título do anúncio.
public static class RoteiroAutomatico
{
    private static readonly HashSet<string> Palavrinhas = new(StringComparer.OrdinalIgnoreCase)
    { "de", "da", "do", "das", "dos", "e", "com", "sem", "para", "pra", "em", "na", "no", "a", "o", "c/", "p/", "tp" };

    private static readonly string[] PalavrasAutopeca =
    { "automove", "autopeca", "veiculo", "motor", "arranque", "radiador", "paralama", "parachoque", "retrovisor", "ventoinha",
      "condensador", "amortecedor", "farol", "lanterna", "embreagem", "alternador", "pastilha", "correia", "bomba", "valvula",
      "defletor", "mangueira", "reservatorio", "servo", "coxim", "terminal", "bieleta", "homocinetica", "cabo de vela", "bobina" };
    private static readonly string[] PalavrasRoupa =
    { "moda feminina", "moda masculina", "roupa", "calca", "camiseta", "camisa", "vestido", "blusa", "saia", "bermuda", "short",
      "jaqueta", "legging", "moletom", "cropped", "conjunto", "pijama", "macacao", "casaco", "regata", "cardigan", "tenis", "sandalia", "calcado", "jeans" };
    private static readonly string[] PalavrasAcessorio =
    { "acessorios de moda", "bolsa", "relogio", "joia", "colar", "brinco", "pulseira", "anel", "oculos de sol", "carteira", "cinto", "bone", "chapeu", "tiara", "lenco", "mochila" };
    private static readonly string[] PalavrasCasa =
    { "casa e decoracao", "casa", "cozinha", "organizador", "utensilio", "decoracao", "toalha", "lencol", "panela", "copo", "garrafa", "tapete", "cortina", "ferramenta", "pote", "prateleira", "banheiro", "almofada" };

    private static readonly Dictionary<CategoriaProduto, string[]> Atributos = new()
    {
        [CategoriaProduto.Roupa] = new[] { "cintura alta", "cintura baixa", "cintura média", "wide leg", "pantalona", "flare", "skinny", "reta", "slim", "mom", "oversized", "cropped",
            "manga longa", "manga curta", "sem manga", "gola alta", "decote v", "estampado", "liso", "jeans", "algodão", "viscose", "linho", "moletom", "plus size", "com elastano", "marmorizada" },
        [CategoriaProduto.Acessorio] = new[] { "dourado", "dourada", "prateado", "prateada", "prata", "aço inox", "inox", "couro", "sintético", "ajustável", "regulável", "folheado", "folheada",
            "banhado", "zircônia", "pérola", "resina", "unissex", "feminino", "masculino" },
        [CategoriaProduto.Casa] = new[] { "inox", "plástico", "vidro", "madeira", "bambu", "silicone", "algodão", "porcelana", "cerâmica", "alumínio", "antiaderente", "com tampa", "empilhável",
            "dobrável", "lavável", "organizador" },
        [CategoriaProduto.Outros] = new[] { "sem álcool", "sem fio", "recarregável", "portátil", "à prova d'água" },
    };

    private static readonly Regex Medidas = new(
        @"\b\d+(?:[.,]\d+)?\s?(?:ml|l|litros?|cm|mm|kg|g|peças?|unidades?|pçs?|flanelas?|pares?|metros?|gb|mb|w|v)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly HashSet<string> Veiculos = new(StringComparer.OrdinalIgnoreCase)
    { "gol", "voyage", "fiesta", "corsa", "celta", "prisma", "onix", "palio", "uno", "siena", "strada", "idea", "fox", "polo", "up", "saveiro", "golf", "jetta", "civic", "fit",
      "city", "hilux", "corolla", "ranger", "ka", "focus", "ecosport", "montana", "agile", "meriva", "vectra", "astra", "zafira", "hb20", "creta", "tucson", "i30", "discovery",
      "kombi", "tiguan", "amarok", "argo", "mobi", "cronos", "toro", "renegade", "compass", "sandero", "logan", "duster", "clio", "kwid", "captur", "fusion", "s10", "l200", "parati", "santana" };

    private const double TempoAlvoSegundos = 20.5;

    public static RoteiroGerado Gerar(string tituloCompleto, long itemId, IReadOnlyList<string> imagens,
        IReadOnlyList<string>? categoriasPagina, string? observacaoRevisao)
    {
        var titulo = Regex.Replace(tituloCompleto, @"\s+", " ").Trim().TrimEnd('-', '–', '.', ',', ' ');
        var categoria = Detectar(titulo, categoriasPagina);
        var variante = (int)(itemId % 3);
        var n = imagens.Count;
        // Fotos em sequência, sem repetir enquanto houver foto nova; com poucas fotos (< 5),
        // cada cena usa uma só (nunca inventa ângulo nem estica pouca foto em muitos cortes).
        var cursor = 0;
        string Prox() => imagens[cursor++ % n];
        var porCena = n >= 5 ? 2 : 1;
        (string, double, string?)[] Fotos(string? modo = null) =>
            porCena == 2 ? new[] { (Prox(), 0.5, modo), (Prox(), 0.5, modo) } : new[] { (Prox(), 1.0, modo) };

        var cenas = new List<(string fala, string legenda, string tom, List<(string img, double fracao, string? modo)> shots)>();
        void Add(string frase, string tom, params (string img, double fracao, string? modo)[] shots) =>
            cenas.Add((Fala(frase), Legenda(frase), tom, shots.ToList()));

        var (curto, aplicacao) = categoria == CategoriaProduto.Autopeca ? SepararPecaEAplicacao(titulo) : (NomeCurto(titulo), "");
        curto = NomeNatural(curto);
        var attrs = categoria == CategoriaProduto.Autopeca ? new List<string>() : Extrair(titulo, categoria);

        // 1) Abre mostrando o produto inteiro (a capa), com interesse específico.
        Add(variante switch
        {
            0 => categoria == CategoriaProduto.Autopeca ? $"Procurando {curto} pro seu carro?" : $"Procurando {curto}?",
            1 => categoria == CategoriaProduto.Autopeca ? $"Precisa de {curto}? Olha só." : $"Se você precisa de {curto}, olha só.",
            _ => $"Uma dica pra quem busca {curto}.",
        }, "pergunta", (Prox(), 1.0, "inteiro"));

        // 2) Fatos confirmados no título/aplicação — se não houver, a cena não existe.
        if (categoria == CategoriaProduto.Autopeca)
        {
            if (aplicacao.Length > 0)
                Add($"Aplicação informada: {aplicacao}.", "explicacao", Fotos());
        }
        else if (attrs.Count > 0)
        {
            var lista = Unir(attrs.Take(4).ToList());
            Add(variante switch { 0 => $"O anúncio cita {lista}.", 1 => $"No anúncio aparece: {lista}.", _ => $"Segundo o anúncio: {lista}." },
                "explicacao", Fotos());
        }

        // 3) Evidência visual / o que observar. É a única cena "de enchimento": se o vídeo passar
        // do tempo alvo, ela é a primeira a sair (as demais carregam fato, estado ou chamada).
        var indiceEvidencia = cenas.Count;
        Add(categoria switch
        {
            CategoriaProduto.Autopeca => variante == 1 ? "Compare o código da peça com o do seu veículo." : "Confere o código da peça com o do seu carro.",
            CategoriaProduto.Roupa => "Veja o corte e os detalhes nas fotos.",
            CategoriaProduto.Acessorio => "Olha o acabamento e os detalhes nas fotos.",
            CategoriaProduto.Casa => "Veja o produto de perto nas fotos.",
            _ => "Dá pra ver o produto por mais de um ângulo nas fotos.",
        }, "explicacao", Fotos());

        // 4) Dúvida de compra da categoria (+ observação de quem revisou, se houver).
        var obs = string.IsNullOrWhiteSpace(observacaoRevisao) ? "" : observacaoRevisao.Trim().TrimEnd('.') + ". ";
        Add(categoria switch
        {
            CategoriaProduto.Autopeca => obs + "Confirme o estado e a compatibilidade com o vendedor.",
            CategoriaProduto.Roupa => obs + "Antes de escolher, confira a tabela de medidas e os tamanhos disponíveis.",
            CategoriaProduto.Acessorio => obs + "Confira no anúncio as dimensões, o acabamento e como usar.",
            CategoriaProduto.Casa => obs + "Confira medidas, material e cuidados de uso no anúncio.",
            _ => obs + "Confira no anúncio as medidas, o que vem junto e as opções.",
        }, "explicacao", Fotos());

        // 5) Uma única chamada final, com o produto inteiro na tela.
        Add(variante switch { 0 => "Veja as opções no produto marcado.", 1 => "As informações estão no produto marcado.", _ => "Confira tudo no produto marcado." },
            "fechamento", (imagens[Math.Min(1, n - 1)], 1.0, "inteiro"));

        // Tempo alvo de ~20 s: estimativa pela fala (≈ 12 caracteres/s medidos nos vídeos de teste, já com a pausa entre cenas).
        static double Estimativa(IEnumerable<(string fala, string legenda, string tom, List<(string img, double fracao, string? modo)> shots)> cs) =>
            cs.Sum(c => c.fala.Length / 12.0 + 0.5);
        if (Estimativa(cenas) > TempoAlvoSegundos)
            cenas.RemoveAt(indiceEvidencia);

        var versao = $"auto-v3-{categoria.ToString().ToLowerInvariant()}-{(char)('A' + variante)}";
        var json = JsonSerializer.Serialize(new
        {
            versao,
            cenas = cenas.Select(c => new
            {
                fala = c.fala,
                legenda = c.legenda,
                tom = c.tom,
                shots = c.shots.Select(s => new { imagem = s.img, fracao = s.fracao, modo = s.modo }).ToArray(),
            }).ToArray(),
        }, new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

        var legendaPost = $"{Reduz(curto, 60)} — veja as fotos e as opções no produto marcado.";
        return new RoteiroGerado(versao, categoria, json, legendaPost, Hashtags(titulo, categoriasPagina, categoria));
    }

    // ---------- classificação ----------
    public static CategoriaProduto Detectar(string titulo, IReadOnlyList<string>? categoriasPagina)
    {
        var texto = Normaliza(titulo + " " + string.Join(' ', categoriasPagina ?? Array.Empty<string>()));
        int Pontos(string[] palavras) => palavras.Count(p => Regex.IsMatch(texto, $@"\b{Regex.Escape(p)}"));

        var notas = new Dictionary<CategoriaProduto, int>
        {
            [CategoriaProduto.Autopeca] = Pontos(PalavrasAutopeca) + (Regex.IsMatch(titulo, @"\b(19|20)\d{2}\s*[-/a]\s*(19|20)?\d{2}\b") ? 2 : 0),
            [CategoriaProduto.Roupa] = Pontos(PalavrasRoupa),
            [CategoriaProduto.Acessorio] = Pontos(PalavrasAcessorio),
            [CategoriaProduto.Casa] = Pontos(PalavrasCasa),
        };
        var melhor = notas.OrderByDescending(x => x.Value).First();
        return melhor.Value >= 1 && notas.Count(x => x.Value == melhor.Value) == 1 ? melhor.Key : CategoriaProduto.Outros;
    }

    private static string Normaliza(string s)
    {
        var d = s.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in d)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString();
    }

    // ---------- extração de fatos do título ----------
    private static List<string> Extrair(string titulo, CategoriaProduto categoria)
    {
        var achados = new List<(int pos, string texto)>();
        var norm = Normaliza(titulo);
        foreach (var a in Atributos.GetValueOrDefault(categoria, Array.Empty<string>()))
        {
            var i = norm.IndexOf(Normaliza(a), StringComparison.Ordinal);
            if (i >= 0 && !achados.Any(x => x.texto.Contains(a, StringComparison.OrdinalIgnoreCase) || a.Contains(x.texto, StringComparison.OrdinalIgnoreCase)))
                achados.Add((i, a));
        }
        foreach (Match m in Medidas.Matches(titulo))
            achados.Add((m.Index, Regex.Replace(m.Value, @"(\d)([A-Za-z])", "$1 $2").ToLowerInvariant()));
        return achados.OrderBy(x => x.pos).Select(x => x.texto).Distinct().ToList();
    }

    private static (string peca, string aplicacao) SepararPecaEAplicacao(string titulo)
    {
        var palavras = titulo.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var idx = palavras.FindIndex(p => Veiculos.Contains(p.Trim('(', ')', ',')) || Regex.IsMatch(p, @"^(19|20)\d{2}"));
        if (idx <= 0) return (NomeCurto(titulo, 4), "");
        var peca = string.Join(' ', palavras.Take(Math.Min(idx, 4)));
        var aplic = string.Join(' ', palavras.Skip(idx).Take(8).Where(p => !Regex.IsMatch(p, @"^\d+cc$", RegexOptions.IgnoreCase)));
        return (peca, aplic);
    }

    // Nome pra usar no meio da frase: minúsculas e a forma como se fala ("motor arranque partida" -> "motor de arranque").
    private static readonly (string de, string para)[] NomesComuns =
    {
        ("motor arranque partida", "motor de arranque"), ("motor arranque", "motor de arranque"),
        ("motor partida", "motor de partida"), ("bomba agua", "bomba d'água"), ("kit limpa telas", "kit de limpa telas"),
    };

    private static string NomeNatural(string nome)
    {
        var s = nome.Trim().ToLowerInvariant();
        foreach (var (de, para) in NomesComuns)
            if (s.StartsWith(de, StringComparison.Ordinal)) return para + s[de.Length..];
        return s;
    }

    private static string NomeCurto(string titulo, int max = 3)
    {
        var palavras = titulo.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        var q = Math.Min(max, palavras.Count);
        while (q > 1 && Palavrinhas.Contains(palavras[q - 1])) q--;
        return string.Join(' ', palavras.Take(q));
    }

    // ---------- texto pra voz e pra legenda ----------
    private static string Unir(List<string> itens) =>
        itens.Count == 1 ? itens[0] : string.Join(", ", itens.Take(itens.Count - 1)) + " e " + itens[^1];

    // Voz: anos "2016-2023" -> "2016 a 2023", "1.0" -> "1 ponto 0", "500ml" -> "500 ml", MAIÚSCULAS -> minúsculas.
    private static string Fala(string s)
    {
        s = Regex.Replace(s, @"(\d{4})\s*-\s*(\d{4})", "$1 a $2");
        s = Regex.Replace(s, @"\b(\d)\.(\d)\b", "$1 ponto $2");
        s = Regex.Replace(s, @"(\d)(ml|cm|mm|kg|g|l)\b", "$1 $2", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"\bTV\b", "tevê");
        s = Regex.Replace(s, @"\b[A-ZÀ-Ý]{4,}\b", m => m.Value.ToLowerInvariant());
        s = Regex.Replace(s, @"[()\[\]{}|•–—+/]", " ");
        return Regex.Replace(s, @"\s+", " ").Trim();
    }

    // Legenda: mesma frase, números e unidades legíveis ("2016 a 2023", "500 ml").
    private static string Legenda(string s)
    {
        s = Regex.Replace(s, @"(\d{4})\s*-\s*(\d{4})", "$1 a $2");
        s = Regex.Replace(s, @"(\d)(ml|cm|mm|kg|g|l)\b", "$1 $2", RegexOptions.IgnoreCase);
        return Regex.Replace(s, @"\s+", " ").Trim();
    }

    private static string Reduz(string s, int max)
    {
        s = Regex.Replace(s, @"\s+", " ").Trim();
        if (s.Length <= max) return s;
        var corte = s.LastIndexOf(' ', max);
        return (corte > 10 ? s[..corte] : s[..max]).TrimEnd(',', '-', '(', ' ');
    }

    private static string Hashtags(string titulo, IReadOnlyList<string>? categoriasPagina, CategoriaProduto categoria)
    {
        string Limpa(string p)
        {
            var sb = new StringBuilder();
            foreach (var c in Normaliza(p)) if (char.IsLetterOrDigit(c)) sb.Append(c);
            return sb.ToString();
        }

        var tags = new List<string> { "#shopee" };
        var fontes = titulo.Split(' ').Concat((categoriasPagina ?? Array.Empty<string>()).SelectMany(c => c.Split(' ')));
        foreach (var p in fontes)
        {
            var t = Limpa(p);
            if (t.Length < 4 || Palavrinhas.Contains(t) || t.All(char.IsDigit) || Regex.IsMatch(t, @"^\d")) continue;
            var tag = "#" + t;
            if (!tags.Contains(tag)) tags.Add(tag);
            if (tags.Count >= 5) break;
        }
        return string.Join(' ', tags);
    }
}
