using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NexoGestao.Api.Shared;

public enum CategoriaProduto { Roupa, Acessorio, Casa, Autopeca, Outros }

public record RoteiroGerado(string Versao, CategoriaProduto Categoria, string RoteiroJson, string Legenda, string Hashtags);

// Roteiros falados, compartilhados por TODOS os vídeos. A ideia é soar como uma pessoa apresentando o produto:
//   "Tá procurando [produto]? Olha esse [produto]. Ele tem [característica confirmada]."
// Fala sobre o que o produto é, pra que serve (só quando o título diz) e um ou dois detalhes. Não explica a
// pesquisa nem o que aparece na edição, e não lê título ou ficha técnica como lista.
//
// Só entram fatos que estão no título, na categoria da página ou na observação de quem revisou. Nada de
// qualidade, conforto, experiência pessoal, desconto, urgência, estado deduzido ou benefício inventado.
// Quando faltam informações, o roteiro fica MAIS CURTO em vez de ser preenchido com frases genéricas.
//
// Voz e legenda são escritas separadas: na voz os números saem por extenso ("quinhentos mililitros",
// "cinco flanelas", "dois mil e dezesseis"); na legenda ficam como "500 ml", "5 flanelas".
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

    private static readonly HashSet<string> Veiculos = new(StringComparer.OrdinalIgnoreCase)
    { "gol", "voyage", "fiesta", "corsa", "celta", "prisma", "onix", "palio", "uno", "siena", "strada", "idea", "fox", "polo", "up", "saveiro", "golf", "jetta", "civic", "fit",
      "city", "hilux", "corolla", "ranger", "ka", "focus", "ecosport", "montana", "agile", "meriva", "vectra", "astra", "zafira", "hb20", "creta", "tucson", "i30", "discovery",
      "kombi", "tiguan", "amarok", "argo", "mobi", "cronos", "toro", "renegade", "compass", "sandero", "logan", "duster", "clio", "kwid", "captur", "fusion", "s10", "l200", "parati", "santana" };

    private static readonly HashSet<string> Marcas = new(StringComparer.OrdinalIgnoreCase)
    { "honda", "hyundai", "gm", "chevrolet", "fiat", "ford", "vw", "volkswagen", "toyota", "renault", "peugeot", "citroen", "nissan", "jeep", "mitsubishi", "kia", "land", "rover" };

    // Gênero das palavras mais comuns; o resto usa a terminação e, se ainda houver dúvida, a frase evita artigo/pronome.
    private static readonly Dictionary<string, bool> Genero = new(StringComparer.OrdinalIgnoreCase)
    {
        // masculino (false)
        ["kit"] = false, ["motor"] = false, ["radiador"] = false, ["retrovisor"] = false, ["condensador"] = false, ["defletor"] = false, ["reservatório"] = false,
        ["servo"] = false, ["amortecedor"] = false, ["farol"] = false, ["alternador"] = false, ["par"] = false, ["conjunto"] = false, ["vestido"] = false,
        ["short"] = false, ["tênis"] = false, ["casaco"] = false, ["moletom"] = false, ["cropped"] = false, ["colar"] = false, ["brinco"] = false, ["anel"] = false,
        ["relógio"] = false, ["cinto"] = false, ["boné"] = false, ["chapéu"] = false, ["lenço"] = false, ["organizador"] = false, ["pote"] = false, ["copo"] = false,
        ["tapete"] = false, ["jogo"] = false, ["suporte"] = false, ["carregador"] = false, ["fone"] = false, ["cabo"] = false, ["óculos"] = false, ["processador"] = false,
        ["liquidificador"] = false, ["ventilador"] = false, ["aspirador"] = false, ["secador"] = false, ["fogão"] = false, ["espelho"] = false, ["pacote"] = false,
        // feminino (true)
        ["calça"] = true, ["camiseta"] = true, ["blusa"] = true, ["saia"] = true, ["bermuda"] = true, ["jaqueta"] = true, ["legging"] = true, ["bolsa"] = true,
        ["pulseira"] = true, ["tiara"] = true, ["mochila"] = true, ["garrafa"] = true, ["panela"] = true, ["toalha"] = true, ["cortina"] = true, ["almofada"] = true,
        ["prateleira"] = true, ["mangueira"] = true, ["moldura"] = true, ["ventoinha"] = true, ["bomba"] = true, ["correia"] = true, ["lanterna"] = true,
        ["embreagem"] = true, ["pastilha"] = true, ["tampa"] = true, ["válvula"] = true, ["capa"] = true, ["luminária"] = true, ["caixa"] = true, ["sandália"] = true,
        ["camisa"] = true, ["regata"] = true, ["jarra"] = true, ["escova"] = true, ["luva"] = true, ["necessaire"] = true, ["carteira"] = true, ["tábua"] = true,
    };

    private static readonly HashSet<string> Adjetivos = new(StringComparer.OrdinalIgnoreCase) { "mini", "super", "micro", "maxi", "novo", "nova" };

    private static readonly Dictionary<string, string> Usos = new(StringComparer.OrdinalIgnoreCase)
    {
        ["celular"] = "celular", ["celulares"] = "celular", ["smartphone"] = "celular", ["monitor"] = "monitor", ["monitores"] = "monitor",
        ["tv"] = "tevê", ["tvs"] = "tevê", ["televisão"] = "tevê", ["notebook"] = "notebook", ["notebooks"] = "notebook", ["laptop"] = "notebook",
        ["tablet"] = "tablet", ["tablets"] = "tablet", ["óculos"] = "óculos", ["câmera"] = "câmera", ["câmeras"] = "câmera",
        ["geladeira"] = "geladeira", ["fogão"] = "fogão", ["banheiro"] = "banheiro", ["cozinha"] = "cozinha",
    };

    private static readonly Regex MedidaComUnidade = new(
        @"^(\d+(?:[.,]\d+)?)\s?(ml|l|litros?|cm|mm|m|kg|g|w|v|gb|mb)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // ====================================================================================================
    public static RoteiroGerado Gerar(string tituloCompleto, long itemId, IReadOnlyList<string> imagens,
        IReadOnlyList<string>? categoriasPagina, string? observacaoRevisao)
    {
        var titulo = LimpaTitulo(tituloCompleto);
        var categoria = Detectar(titulo, categoriasPagina);
        var variante = (int)(itemId % 3);
        var p = Entender(titulo, categoria);
        var obs = string.IsNullOrWhiteSpace(observacaoRevisao) ? null : Frase(observacaoRevisao.Trim().TrimEnd('.'));

        var art = p.Feminino is null ? "" : p.Feminino.Value ? "uma " : "um ";
        var esse = p.Feminino is null ? null : p.Feminino.Value ? "essa" : "esse";

        var cenas = new List<(string frase, string tom)>();
        var autopeca = categoria == CategoriaProduto.Autopeca;

        // 1) Pergunta de abertura sobre o que a pessoa procura.
        var sufixo = autopeca ? " pro seu carro" : "";
        cenas.Add((variante switch
        {
            0 => $"Tá procurando {art}{p.Nome}{sufixo}?",
            1 => $"Precisa de {art}{p.Nome}{sufixo}?",
            _ => $"Tá atrás de {art}{p.Nome}{sufixo}?",
        }, "pergunta"));

        // 2) Apresenta o produto com um ou dois detalhes confirmados (ou fica só "Olha esse").
        string apresenta;
        if (autopeca)
        {
            var peca = esse is null ? "Dá uma olhada." : $"Olha {esse} {p.Nome}.";
            apresenta = p.Aplicacao is null ? peca : $"{peca} O vendedor indica pra {p.Aplicacao}.";
        }
        else
        {
            // Detalhe sem sujeito ("vem com…", "é wide leg e tem cintura alta"); "ele/ela" só quando o gênero é certo.
            string? baseDetalhe = p.Itens is not null ? $"vem com {p.Itens}"
                : p.Clausulas.Count > 0 ? JuntarClausulas(p.Clausulas.Take(2).ToList()) : null;
            if (baseDetalhe is not null && p.Feminino is not null &&
                (baseDetalhe.StartsWith("é ") || baseDetalhe.StartsWith("tem ") || baseDetalhe.StartsWith("mede ")))
                baseDetalhe = (p.Feminino.Value ? "ela " : "ele ") + baseDetalhe;

            apresenta = (esse, baseDetalhe, variante) switch
            {
                (null, null, _) => "Dá uma olhada.",
                (not null, null, _) => $"Olha {esse} aqui.",
                (null, not null, 2) => $"Olha só: {p.Nome}. {Frase(baseDetalhe!)}",
                (null, not null, _) => $"Olha só: {baseDetalhe}.",
                (not null, not null, 0) => $"Olha {esse}: {baseDetalhe}.",
                (not null, not null, 1) => $"Olha {esse} {p.Nome}. {Frase(baseDetalhe!)}",
                (not null, not null, _) => $"Dá uma olhada {(p.Feminino!.Value ? "nessa" : "nesse")} {p.Nome}. {Frase(baseDetalhe!)}",
            };
        }
        cenas.Add((apresenta, "explicacao"));

        // 3) Pra que serve (só quando o título cita usos reconhecidos) e observação de quem revisou.
        var extra = new List<string>();
        if (!autopeca && p.Usos is not null) extra.Add($"Serve pra {p.Usos}.");
        if (obs is not null) extra.Add(obs);

        if (autopeca)
        {
            // Compatibilidade nunca é garantida só pelo título: um aviso curto, dito como uma pessoa diria.
            extra.Add(variante == 1 ? "Confere se é o do seu carro antes de comprar." : "Vale conferir se serve no seu carro.");
            cenas.Add((string.Join(" ", extra), "fechamento"));
        }
        else
        {
            if (extra.Count > 0) cenas.Add((string.Join(" ", extra), "explicacao"));

            // 4) Encerramento curto e variado, só em alguns vídeos (nunca forçado).
            var fecho = (int)(itemId % 4) switch
            {
                0 => "Dá uma olhada nos detalhes.",
                2 => "Vale ver os detalhes.",
                3 => "Os detalhes estão no produto.",
                _ => null,
            };
            if (fecho is not null) cenas.Add((fecho, "fechamento"));
        }

        // Fotos: sequência sem repetir enquanto houver foto nova; nunca inventa ângulo nem estica poucas fotos.
        var n = imagens.Count;
        var cursor = 0;
        string Prox() => imagens[cursor++ % n];
        var meio = Math.Max(1, cenas.Count - 2);
        var porCena = n >= 7 && meio <= 2 ? 3 : n >= 5 ? 2 : 1;

        var montadas = new List<object>();
        for (var i = 0; i < cenas.Count; i++)
        {
            var (frase, tom) = cenas[i];
            var primeira = i == 0;
            var ultima = i == cenas.Count - 1 && cenas.Count > 2 && tom == "fechamento";
            object[] shots = primeira || ultima
                ? new object[] { new { imagem = primeira ? Prox() : imagens[Math.Min(1, n - 1)], fracao = 1.0, modo = (string?)"inteiro" } }
                : Enumerable.Range(0, porCena).Select(_ => (object)new { imagem = Prox(), fracao = Math.Round(1.0 / porCena, 4), modo = (string?)null }).ToArray();
            montadas.Add(new { fala = Fala(frase), legenda = Legenda(frase), tom, shots });
        }

        var versao = $"auto-v4-{categoria.ToString().ToLowerInvariant()}-{(char)('A' + variante)}";
        var json = JsonSerializer.Serialize(new { versao, cenas = montadas },
            new JsonSerializerOptions
            {
                WriteIndented = true,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            });

        return new RoteiroGerado(versao, categoria, json, LegendaDoPost(p), Hashtags(titulo, categoriasPagina, categoria));
    }

    // Texto da legenda da publicação (não é a fala): o que é o produto e um detalhe, sem apelo de compra forçado.
    private static string LegendaDoPost(Produto p)
    {
        var baseTxt = Maiuscula(Legenda(p.Nome));
        if (p.Itens is not null) return Reduz($"{baseTxt}: vem com {Legenda(p.Itens)}.", 200);
        if (p.Aplicacao is not null) return Reduz($"{baseTxt}. Indicado pelo vendedor pra {Legenda(p.Aplicacao)}.", 200);
        if (p.Clausulas.Count > 0) return Reduz($"{baseTxt}: {Legenda(JuntarClausulas(p.Clausulas.Take(2).ToList()))}.", 200);
        return Reduz(baseTxt + ".", 200);
    }

    // ====================================================================================================
    // Entendimento do título: só extrai o que está escrito nele.
    private sealed record Produto(string Nome, bool? Feminino, List<string> Clausulas, string? Itens, string? Usos, string? Aplicacao);

    private static string LimpaTitulo(string t)
    {
        t = Regex.Replace(t, @"[^\p{L}\p{N}\s\-–—+,.()/%'’&|]", " ");
        return Regex.Replace(t, @"\s+", " ").Trim().TrimEnd('-', '–', '—', '.', ',', ' ');
    }

    private static Produto Entender(string titulo, CategoriaProduto categoria)
    {
        // Parte principal e "cauda" (palavras-chave depois de um traço ou barra), que o vendedor usa pra listar usos.
        var partes = Regex.Split(titulo, @"\s[-–—|]\s", RegexOptions.None);
        var nucleo = partes[0].Trim();
        var cauda = partes.Length > 1 ? string.Join(" ", partes.Skip(1)) : "";
        var tokens = nucleo.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();

        if (categoria == CategoriaProduto.Autopeca)
        {
            var (peca, aplic) = SepararPecaEAplicacao(tokens);
            var nomeAuto = NomeNatural(peca);
            return new Produto(nomeAuto, GeneroDe(nomeAuto), new List<string>(), null, null, aplic);
        }

        var nome = NomeProduto(tokens, categoria);
        string? itens = null;
        var itensSemContagem = new List<string>();
        if (nome.StartsWith("kit", StringComparison.OrdinalIgnoreCase) || nucleo.Contains('+'))
            itens = MontaItens(nucleo, nome, itensSemContagem);

        // "kit" sozinho não diz nada: usa o primeiro item pra dizer o que é o kit.
        if (nome.Equals("kit", StringComparison.OrdinalIgnoreCase) && itensSemContagem.Count > 0)
            nome = "kit de " + itensSemContagem[0];

        var nomeNat = NomeNatural(nome);
        var palavrasDoNome = Normaliza(nomeNat).Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var clausulas = itens is null ? Clausulas(nucleo + " " + cauda, categoria) : new List<string>();
        // Não repete o que o nome já disse ("garrafa térmica inox" + "é de inox").
        clausulas = clausulas.Where(c =>
            !Normaliza(c).Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(w => w.Length >= 4 && palavrasDoNome.Contains(w))).ToList();

        // Usos: só palavras de uma lista reconhecida (celular, monitor, tevê...), em ordem, no máximo quatro.
        string? usos = null;
        if (categoria is CategoriaProduto.Outros or CategoriaProduto.Casa)
        {
            var achados = Regex.Matches(titulo, @"[\p{L}]+").Select(m => m.Value)
                .Where(w => Usos.ContainsKey(w)).Select(w => Usos[w]).Distinct().Take(4).ToList();
            if (achados.Count >= 2) usos = Juntar(achados);
        }

        return new Produto(nomeNat, GeneroDe(nomeNat), clausulas, itens, usos, null);
    }

    // Nome do produto: as primeiras palavras do título, até aparecer número, "com", medida, atributo ou veículo.
    private static string NomeProduto(List<string> tokens, CategoriaProduto categoria)
    {
        var paradas = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "com", "c/", "para", "p/", "+", "cor", "tamanho", "modelo" };
        var marcadoresDeGenero = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "feminina", "feminino", "masculina", "masculino", "infantil", "unissex" };
        var inicioDeAtributo = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "wide", "pantalona", "flare", "skinny", "slim", "mom", "oversized", "cintura", "manga", "gola", "decote", "elétrico", "elétrica", "portátil", "recarregável" };

        var nome = new List<string>();
        foreach (var t in tokens)
        {
            var limpo = t.Trim('(', ')', ',');
            if (nome.Count >= 1)
            {
                if (limpo.Any(char.IsDigit) || limpo.StartsWith('(') || t.StartsWith('(') || paradas.Contains(limpo) || inicioDeAtributo.Contains(limpo)) break;
                if (marcadoresDeGenero.Contains(limpo) && categoria is not (CategoriaProduto.Roupa or CategoriaProduto.Acessorio)) break;
            }
            nome.Add(limpo);
            if (nome.Count >= 4) break;
        }
        while (nome.Count > 1 && Palavrinhas.Contains(nome[^1])) nome.RemoveAt(nome.Count - 1);
        return string.Join(' ', nome);
    }

    // "Limpa Telas 500ml + 5 Flanelas" -> "limpa telas de 500 ml e 5 flanelas". Só junta o que está escrito.
    private static string? MontaItens(string nucleo, string nome, List<string> substantivos)
    {
        var resto = Regex.Replace(nucleo, @"^kit\s+", "", RegexOptions.IgnoreCase).Trim();
        if (resto.Length == 0) return null;
        var segmentos = resto.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(3).ToList();
        var itens = new List<string>();
        foreach (var seg in segmentos)
        {
            var toks = seg.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            string? contagem = null, medida = null;
            if (toks.Count > 0 && Regex.IsMatch(toks[0], @"^\d+$")) { contagem = toks[0]; toks.RemoveAt(0); }
            var m = toks.FindIndex(x => MedidaComUnidade.IsMatch(Regex.Replace(x, @"(\d)([A-Za-z])", "$1 $2").Replace(" ", "")));
            if (m >= 0) { medida = Regex.Replace(toks[m], @"(\d)([A-Za-z])", "$1 $2").ToLowerInvariant(); toks.RemoveAt(m); }
            // Para no primeiro token que parece ruído de título (número solto, "com", etc.).
            var corte = toks.FindIndex(x => x.Any(char.IsDigit) || x.Equals("com", StringComparison.OrdinalIgnoreCase));
            if (corte >= 0) toks = toks.Take(corte).ToList();
            var substantivo = string.Join(' ', toks.Take(3)).ToLowerInvariant().Trim();
            if (substantivo.Length == 0 && medida is null && contagem is null) continue;
            if (substantivo.Length > 0) substantivos.Add(substantivo);

            itens.Add((contagem, medida, substantivo.Length) switch
            {
                (not null, _, > 0) => $"{contagem} {substantivo}",
                (null, not null, > 0) => $"{substantivo} de {medida}",
                (null, null, > 0) => substantivo,
                (_, not null, 0) => medida!,
                _ => contagem!,
            });
        }
        return itens.Count == 0 ? null : Juntar(itens);
    }

    // Detalhes confirmados no título, na forma como se fala ("é wide leg", "tem cintura alta"). No máximo 2 são usados.
    private static List<string> Clausulas(string texto, CategoriaProduto categoria)
    {
        var norm = Normaliza(texto);
        var achados = new List<(int pos, string frase)>();

        // primeiraApenas: sinônimos (ex.: modelagens) contam uma vez só; senão todos os que aparecem entram.
        void Procura(string[] padroes, Func<Match, string?> frase, bool primeiraApenas = false)
        {
            foreach (var padrao in padroes)
            {
                var m = Regex.Match(norm, $@"\b{padrao}\b");
                if (!m.Success) continue;
                var f = frase(m);
                if (f is not null && !achados.Any(a => a.frase == f)) { achados.Add((m.Index, f)); if (primeiraApenas) break; }
            }
        }

        if (categoria == CategoriaProduto.Roupa)
        {
            Procura(new[] { @"wide leg", "pantalona", "flare", "skinny", "slim", "mom", "oversized", "cropped", "reta" }, m => $"é {m.Value}", primeiraApenas: true);
            Procura(new[] { @"cintura (alta|baixa|media)" }, m => "tem " + m.Value.Replace("media", "média"), primeiraApenas: true);
            Procura(new[] { @"manga (longa|curta)", @"gola alta", @"decote v" }, m => "tem " + (m.Value == "decote v" ? "decote em V" : m.Value));
            Procura(new[] { @"sem manga" }, _ => "é sem manga");
            Procura(new[] { "algodao", "viscose", "linho", "moletom" }, m => $"é de {Acentua(m.Value)}", primeiraApenas: true);
            Procura(new[] { @"com elastano" }, _ => "tem elastano");
            Procura(new[] { "marmorizada", @"plus size" }, m => $"é {m.Value}");
        }
        else if (categoria == CategoriaProduto.Acessorio)
        {
            Procura(new[] { @"aco inox", "inox", "couro", "resina" }, m => $"é de {(m.Value == "aco inox" ? "aço inox" : m.Value)}", primeiraApenas: true);
            Procura(new[] { "dourado", "dourada", "prateado", "prateada", "folheado", "folheada", "banhado", "banhada", "sintetico", "ajustavel", "regulavel", "unissex" },
                m => $"é {Acentua(m.Value)}", primeiraApenas: true);
            Procura(new[] { "zirconia", "perola" }, m => $"tem {Acentua(m.Value)}");
        }
        else if (categoria == CategoriaProduto.Casa)
        {
            Procura(new[] { "inox", "plastico", "vidro", "madeira", "bambu", "silicone", "algodao", "porcelana", "ceramica", "aluminio" }, m => $"é de {Acentua(m.Value)}", primeiraApenas: true);
            Procura(new[] { @"com tampa" }, _ => "vem com tampa");
            Procura(new[] { "antiaderente", "empilhavel", "dobravel", "lavavel" }, m => $"é {Acentua(m.Value)}");
        }
        else
        {
            Procura(new[] { @"sem alcool", @"sem fio", "recarregavel", "portatil", "bivolt", "eletrico", "eletrica", "automatico", "automatica" }, m => $"é {Acentua(m.Value)}");
            Procura(new[] { @"a prova d.agua" }, _ => "é à prova d'água");
        }

        // Medidas do título (fora de kits): "mede 30 cm", "tem 500 ml", "vem com 12 peças".
        foreach (Match m in Regex.Matches(texto, @"\b(\d+(?:[.,]\d+)?)\s?(ml|l|litros?|cm|mm|kg|g|w|v|gb|mb|peças?|pçs?|unidades?|pares?)\b", RegexOptions.IgnoreCase))
        {
            var valor = m.Groups[1].Value;
            var un = m.Groups[2].Value.ToLowerInvariant();
            var frase = un switch
            {
                "cm" or "mm" => $"mede {valor} {un}",
                var u when u.StartsWith("peç") || u.StartsWith("pç") || u.StartsWith("unid") || u.StartsWith("par") => $"vem com {valor} {(u.StartsWith("pç") ? "peças" : u)}",
                _ => $"tem {valor} {un}",
            };
            achados.Add((m.Index - 1000, frase)); // medidas primeiro: costumam ser o dado mais útil
        }

        return achados.OrderBy(a => a.pos).Select(a => a.frase).Distinct().ToList();
    }

    private static string Acentua(string s) => s switch
    {
        "algodao" => "algodão", "plastico" => "plástico", "ceramica" => "cerâmica", "aluminio" => "alumínio", "sintetico" => "sintético",
        "ajustavel" => "ajustável", "regulavel" => "regulável", "zirconia" => "zircônia", "perola" => "pérola", "empilhavel" => "empilhável",
        "dobravel" => "dobrável", "lavavel" => "lavável", "recarregavel" => "recarregável", "portatil" => "portátil", "eletrico" => "elétrico",
        "eletrica" => "elétrica", "automatico" => "automático", "automatica" => "automática", "sem alcool" => "sem álcool", _ => s,
    };

    // ====================================================================================================
    // Autopeças: nome da peça e aplicação informada pelo vendedor ("Voyage de 2016 a 2023 e Gol 1.0").
    private static (string peca, string? aplicacao) SepararPecaEAplicacao(List<string> palavras)
    {
        bool EhVeiculoOuAno(string p) => Veiculos.Contains(p.Trim('(', ')', ',')) || Regex.IsMatch(p, @"^(19|20)\d{2}");
        var idx = palavras.FindIndex(EhVeiculoOuAno);
        if (idx <= 0) return (string.Join(' ', palavras.Take(4)), null);
        var inicio = idx;
        if (inicio > 0 && Marcas.Contains(palavras[inicio - 1].Trim(','))) inicio--;
        var peca = string.Join(' ', palavras.Take(Math.Min(inicio, 4)));

        var grupos = new List<(string nome, string? anos, string? motor)>();
        foreach (var bruto in palavras.Skip(inicio).Take(14))
        {
            var p = bruto.Trim('(', ')', ',');
            if (p.Length == 0 || p.Contains('/') || Regex.IsMatch(p, @"^\d+cc$", RegexOptions.IgnoreCase) || p.Equals("nac.", StringComparison.OrdinalIgnoreCase)) continue;
            var anos = Regex.Match(p, @"^(\d{2,4})-(\d{2,4})$");
            if (anos.Success && grupos.Count > 0)
            {
                var g = grupos[^1];
                grupos[^1] = (g.nome, $"{Ano(anos.Groups[1].Value)} a {Ano(anos.Groups[2].Value)}", g.motor);
            }
            else if (Regex.IsMatch(p, @"^\d\.\d$") && grupos.Count > 0)
            {
                var g = grupos[^1];
                grupos[^1] = (g.nome, g.anos, p);
            }
            else if (Regex.IsMatch(p, @"^(19|20)\d{2}$") && grupos.Count > 0)
            {
                var g = grupos[^1];
                grupos[^1] = (g.nome, Ano(p), g.motor);
            }
            else if (Veiculos.Contains(p) || Marcas.Contains(p))
            {
                // Marca seguida do modelo vira "Honda Fit"; modelo sozinho abre um novo grupo.
                if (Marcas.Contains(p)) grupos.Add((p, null, null));
                else if (grupos.Count > 0 && Marcas.Contains(grupos[^1].nome.Split(' ')[^1]) && grupos[^1].anos is null && grupos[^1].motor is null)
                    grupos[^1] = (grupos[^1].nome + " " + p, null, null);
                else grupos.Add((p, null, null));
            }
        }

        var textos = grupos.Take(3).Select(g =>
            g.nome + (g.motor is not null ? " " + g.motor : "") + (g.anos is not null ? (g.anos.Contains(" a ") ? " de " : " ") + g.anos : "")).ToList();
        return (peca, textos.Count == 0 ? null : Juntar(textos));
    }

    private static string Ano(string a) => a.Length == 4 ? a : (int.Parse(a) <= 30 ? "20" + a : "19" + a);

    // "motor arranque partida" -> "motor de arranque" (como se fala).
    private static readonly (string de, string para)[] NomesComuns =
    {
        ("motor arranque partida", "motor de arranque"), ("motor arranque", "motor de arranque"),
        ("motor partida", "motor de partida"), ("bomba agua", "bomba d'água"), ("reser servo freio", "reservatório do servo de freio"),
    };

    private static string NomeNatural(string nome)
    {
        var s = nome.Trim().ToLowerInvariant();
        foreach (var (de, para) in NomesComuns)
            if (s.StartsWith(de, StringComparison.Ordinal)) return para + s[de.Length..];
        if (Regex.IsMatch(s, @"^kit [^\d]") && !s.StartsWith("kit de ") && !s.StartsWith("kit com ")) s = "kit de " + s[4..];
        s = Regex.Replace(s, @"(?<!\bde )\bar condicionado\b", "de ar condicionado");
        return s;
    }

    // ====================================================================================================
    // Gênero: dicionário, depois terminação; se ainda houver dúvida devolve null e a frase evita artigo/pronome.
    private static bool? GeneroDe(string nome)
    {
        var palavras = nome.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var alvo = palavras.FirstOrDefault(p => !Adjetivos.Contains(p)) ?? palavras.FirstOrDefault();
        if (alvo is null) return null;
        return GeneroPalavra(alvo);
    }

    private static bool? GeneroPalavra(string w)
    {
        if (Genero.TryGetValue(w, out var g)) return g;
        var s = w.ToLowerInvariant();
        if (s.EndsWith("ção") || s.EndsWith("são") || s.EndsWith("dade")) return true;
        if (s.EndsWith("ão") || s.EndsWith("or")) return false;
        if (s.EndsWith("as")) return true;
        if (s.EndsWith("os")) return false;
        if (s.EndsWith('a')) return true;
        if (s.EndsWith('o')) return false;
        return null;
    }

    private static string Juntar(List<string> itens) =>
        itens.Count == 1 ? itens[0] : string.Join(", ", itens.Take(itens.Count - 1)) + " e " + itens[^1];

    // "é elétrico" + "é portátil" -> "é elétrico e portátil"; "tem A" + "tem B" -> "tem A e B"; verbos diferentes ficam como estão.
    private static string JuntarClausulas(List<string> clausulas)
    {
        foreach (var verbo in new[] { "é ", "tem " })
        {
            if (clausulas.Count == 2 && clausulas.All(c => c.StartsWith(verbo)))
                return $"{clausulas[0]} e {clausulas[1][verbo.Length..]}";
        }
        return Juntar(clausulas);
    }

    private static string Frase(string s) => s.Length == 0 ? s : char.ToUpper(s[0]) + s[1..] + (s.EndsWith('.') || s.EndsWith('?') ? "" : ".");
    private static string Maiuscula(string s) => s.Length == 0 ? s : char.ToUpper(s[0]) + s[1..];
    private static string Minuscula(string s) => s.Length == 0 ? s : char.ToLower(s[0]) + s[1..];

    // ====================================================================================================
    // Classificação
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

    // ====================================================================================================
    // Texto da voz e da legenda
    private static readonly string[] Unidades =
    { "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove" };
    private static readonly string[] Dezenas = { "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa" };
    private static readonly string[] Centenas = { "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos" };

    private static string Ate999(int n, bool fem)
    {
        if (n == 0) return "";
        if (n == 100) return "cem";
        var partes = new List<string>();
        var c = n / 100;
        var r = n % 100;
        if (c > 0) partes.Add(fem ? Centenas[c].Replace("entos", "entas") : Centenas[c]);
        if (r > 0)
        {
            if (r < 20) partes.Add(Gen(Unidades[r], fem));
            else partes.Add(Dezenas[r / 10] + (r % 10 > 0 ? " e " + Gen(Unidades[r % 10], fem) : ""));
        }
        return string.Join(" e ", partes);
    }

    private static string Gen(string palavra, bool fem) => fem ? palavra switch { "um" => "uma", "dois" => "duas", _ => palavra } : palavra;

    // Número por extenso em português do Brasil (0 a 999.999). Fora disso, devolve os dígitos.
    public static string PorExtenso(long n, bool fem = false)
    {
        if (n < 0 || n > 999_999) return n.ToString(CultureInfo.InvariantCulture);
        if (n == 0) return "zero";
        if (n < 1000) return Ate999((int)n, fem);
        var mil = (int)(n / 1000);
        var resto = (int)(n % 1000);
        var milTexto = mil == 1 ? "mil" : Ate999(mil, fem) + " mil";
        if (resto == 0) return milTexto;
        return (resto < 100 || resto % 100 == 0) ? $"{milTexto} e {Ate999(resto, fem)}" : $"{milTexto} {Ate999(resto, fem)}";
    }

    private static readonly Dictionary<string, (string singular, string plural, bool fem)> UnidadesFala = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ml"] = ("mililitro", "mililitros", false), ["l"] = ("litro", "litros", false), ["litro"] = ("litro", "litros", false), ["litros"] = ("litro", "litros", false),
        ["cm"] = ("centímetro", "centímetros", false), ["mm"] = ("milímetro", "milímetros", false), ["m"] = ("metro", "metros", false),
        ["kg"] = ("quilo", "quilos", false), ["g"] = ("grama", "gramas", true), ["w"] = ("watt", "watts", false), ["v"] = ("volt", "volts", false),
        ["gb"] = ("gigabyte", "gigabytes", false), ["mb"] = ("megabyte", "megabytes", false),
    };

    // Voz: tudo por extenso e sem símbolos. "500 ml" -> "quinhentos mililitros"; "5 flanelas" -> "cinco flanelas";
    // "2016 a 2023" -> "dois mil e dezesseis a dois mil e vinte e três"; "1.0" -> "um ponto zero"; "TV" -> "tevê".
    public static string Fala(string s)
    {
        s = Regex.Replace(s, @"[()\[\]{}|•–—+/]", " ");
        s = Regex.Replace(s, @"\bTV\b", "tevê");
        s = Regex.Replace(s, @"\b[A-ZÀ-Ý]{4,}\b", m => m.Value.ToLowerInvariant());

        // número com unidade (inclui decimal com vírgula: "1,5 litro" -> "um vírgula cinco litro")
        s = Regex.Replace(s, @"\b(\d+)(?:[.,](\d+))?\s?(ml|litros?|l|cm|mm|kg|gb|mb|w|v|g|m)\b", m =>
        {
            var u = UnidadesFala[m.Groups[3].Value];
            var inteiro = long.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if (m.Groups[2].Success)
                return $"{PorExtenso(inteiro, u.fem)} vírgula {string.Join(' ', m.Groups[2].Value.Select(d => Unidades[d - '0']))} {u.plural}";
            return $"{PorExtenso(inteiro, u.fem)} {(inteiro == 1 ? u.singular : u.plural)}";
        }, RegexOptions.IgnoreCase);

        // decimais sem unidade (cilindrada de motor): "1.6" -> "um ponto seis"
        s = Regex.Replace(s, @"\b(\d{1,2})[.,](\d{1,2})\b", m =>
            $"{PorExtenso(long.Parse(m.Groups[1].Value))} ponto {string.Join(' ', m.Groups[2].Value.Select(d => Unidades[d - '0']))}");

        // número seguido de substantivo: "1"/"2" concordam em gênero ("duas flanelas", "um frasco")
        s = Regex.Replace(s, @"\b(\d{1,2})\s+(\p{L}{3,})", m =>
        {
            var n = long.Parse(m.Groups[1].Value);
            var palavra = m.Groups[2].Value;
            var fem = !Palavrinhas.Contains(palavra) && GeneroPalavra(palavra) == true;
            return $"{PorExtenso(n, fem)} {palavra}";
        });

        s = Regex.Replace(s, @"\b\d{1,6}\b", m => PorExtenso(long.Parse(m.Value)));
        return Regex.Replace(s, @"\s+", " ").Trim();
    }

    // Legenda: mesmas palavras, com números e unidades legíveis ("500 ml", "2016 a 2023").
    public static string Legenda(string s)
    {
        s = Regex.Replace(s, @"(\d{4})\s*-\s*(\d{4})", "$1 a $2");
        s = Regex.Replace(s, @"(\d)(ml|cm|mm|kg|gb|mb|g|l|w|v)\b", "$1 $2", RegexOptions.IgnoreCase);
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
