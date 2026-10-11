using System.Globalization;
using System.Text;

namespace NexoGestao.Api.Shared;

public record LinhaRelatorioShopee(
    int NumeroLinha,
    string ItemId,
    string Nome,
    decimal? Preco,
    int? Vendas,
    string? NomeLoja,
    decimal? ComissaoPercentual,
    decimal? ComissaoValor,
    string LinkProduto,
    string LinkOferta);

public record ResultadoLeituraRelatorio(List<LinhaRelatorioShopee> Linhas, List<string> Erros, string? ErroGeral);

// Lê o CSV exportado do gerador de links em lote do painel de afiliados
// (colunas observadas em arquivos reais: Item Id, Item Name, Price, Sales,
// Nome da loja, Commission Rate, Commission, Product Link, Offer Link).
// Valores no padrão brasileiro: "113,99", "86%", "R$98,03". Vendas "0" é um
// valor real (vira 0); campo vazio vira null — nunca se confundem.
public static class RelatorioShopeeCsv
{
    private static readonly Dictionary<string, string> Apelidos = new(StringComparer.OrdinalIgnoreCase)
    {
        ["item id"] = "itemid", ["itemid"] = "itemid", ["id do item"] = "itemid",
        ["item name"] = "nome", ["product name"] = "nome", ["nome do produto"] = "nome", ["nome"] = "nome",
        ["price"] = "preco", ["preço"] = "preco", ["preco"] = "preco",
        ["sales"] = "vendas", ["vendas"] = "vendas",
        ["nome da loja"] = "loja", ["shop name"] = "loja", ["loja"] = "loja",
        ["commission rate"] = "comissaopct", ["taxa de comissão"] = "comissaopct", ["taxa de comissao"] = "comissaopct",
        ["commission"] = "comissaovalor", ["comissão"] = "comissaovalor", ["comissao"] = "comissaovalor",
        ["product link"] = "linkproduto", ["link do produto"] = "linkproduto",
        ["offer link"] = "linkoferta", ["link da oferta"] = "linkoferta", ["link de afiliado"] = "linkoferta",
    };

    public static ResultadoLeituraRelatorio Ler(string texto, int maxLinhas)
    {
        var tabela = ParseCsv(texto);
        if (tabela.Count == 0)
            return new(new(), new(), "O arquivo está vazio.");

        var cabecalho = tabela[0].Select(c => c.Trim().TrimStart('﻿')).ToList();

        // Arquivo de ofertas de CATEGORIA (Offer Name / Offer Type): não tem produtos.
        if (cabecalho.Any(c => c.Equals("Offer Type", StringComparison.OrdinalIgnoreCase)))
            return new(new(), new(), "Esse arquivo é de ofertas de categoria (não tem produtos, preço nem comissão por produto). Exporte pelo gerador de links de produtos do painel.");

        var coluna = new Dictionary<string, int>();
        for (var i = 0; i < cabecalho.Count; i++)
            if (Apelidos.TryGetValue(cabecalho[i], out var chave) && !coluna.ContainsKey(chave))
                coluna[chave] = i;

        var faltando = new[] { "itemid", "nome", "linkproduto", "linkoferta" }.Where(c => !coluna.ContainsKey(c)).ToList();
        if (faltando.Count > 0)
            return new(new(), new(), $"Faltam colunas obrigatórias no arquivo: {string.Join(", ", faltando)}. Colunas encontradas: {string.Join(", ", cabecalho)}.");

        if (tabela.Count - 1 > maxLinhas)
            return new(new(), new(), $"O arquivo tem mais de {maxLinhas} produtos. Divida em arquivos menores.");

        string? Campo(List<string> linha, string chave) =>
            coluna.TryGetValue(chave, out var i) && i < linha.Count ? linha[i].Trim() : null;

        var linhas = new List<LinhaRelatorioShopee>();
        var erros = new List<string>();

        for (var n = 1; n < tabela.Count; n++)
        {
            var l = tabela[n];
            if (l.All(string.IsNullOrWhiteSpace))
                continue;

            var numero = n + 1;
            var itemId = Campo(l, "itemid") ?? "";
            var nome = Campo(l, "nome") ?? "";
            var linkProduto = Campo(l, "linkproduto") ?? "";
            var linkOferta = Campo(l, "linkoferta") ?? "";

            if (itemId.Length == 0 || !itemId.All(char.IsDigit))
            { erros.Add($"Linha {numero}: Item Id inválido ou vazio."); continue; }
            if (nome.Length == 0)
            { erros.Add($"Linha {numero}: nome do produto vazio."); continue; }
            if (linkProduto.Length == 0 || linkOferta.Length == 0)
            { erros.Add($"Linha {numero}: falta o Product Link ou o Offer Link."); continue; }

            var precoTxt = Campo(l, "preco");
            var preco = ParseDecimalBr(precoTxt);
            if (!string.IsNullOrWhiteSpace(precoTxt) && preco is null)
            { erros.Add($"Linha {numero}: preço ilegível (\"{precoTxt}\")."); continue; }

            var vendasTxt = Campo(l, "vendas");
            var vendas = ParseInt(vendasTxt);
            if (!string.IsNullOrWhiteSpace(vendasTxt) && vendas is null)
            { erros.Add($"Linha {numero}: vendas ilegível (\"{vendasTxt}\")."); continue; }

            var pctTxt = Campo(l, "comissaopct");
            var pct = ParseDecimalBr(pctTxt);
            if (!string.IsNullOrWhiteSpace(pctTxt) && pct is null)
            { erros.Add($"Linha {numero}: percentual de comissão ilegível (\"{pctTxt}\")."); continue; }

            var valTxt = Campo(l, "comissaovalor");
            var val = ParseDecimalBr(valTxt);
            if (!string.IsNullOrWhiteSpace(valTxt) && val is null)
            { erros.Add($"Linha {numero}: valor de comissão ilegível (\"{valTxt}\")."); continue; }

            var loja = Campo(l, "loja");
            linhas.Add(new LinhaRelatorioShopee(numero, itemId, nome, preco, vendas,
                string.IsNullOrWhiteSpace(loja) ? null : loja, pct, val, linkProduto, linkOferta));
        }

        return new(linhas, erros, null);
    }

    // "113,99" -> 113.99 | "R$98,03" -> 98.03 | "86%" -> 86 | "1.234,56" -> 1234.56 | "" -> null
    public static decimal? ParseDecimalBr(string? bruto)
    {
        if (string.IsNullOrWhiteSpace(bruto))
            return null;

        var s = bruto.Replace("R$", "", StringComparison.OrdinalIgnoreCase)
            .Replace("%", "").Replace(" ", " ").Trim().Replace(" ", "");
        if (s.Length == 0)
            return null;

        // Com vírgula: padrão brasileiro (ponto = milhar). Sem vírgula: só aceita número simples.
        s = s.Contains(',') ? s.Replace(".", "").Replace(",", ".") : s;

        return decimal.TryParse(s, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign,
            CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    public static int? ParseInt(string? bruto)
    {
        if (string.IsNullOrWhiteSpace(bruto))
            return null;
        var s = bruto.Trim().Replace(".", "").Replace(" ", "");
        return int.TryParse(s, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    // CSV de verdade (RFC 4180): campos entre aspas podem ter vírgula, aspas duplicadas e quebra de linha.
    public static List<List<string>> ParseCsv(string texto)
    {
        var linhas = new List<List<string>>();
        var linha = new List<string>();
        var campo = new StringBuilder();
        var entreAspas = false;

        for (var i = 0; i < texto.Length; i++)
        {
            var c = texto[i];
            if (entreAspas)
            {
                if (c == '"' && i + 1 < texto.Length && texto[i + 1] == '"') { campo.Append('"'); i++; }
                else if (c == '"') entreAspas = false;
                else campo.Append(c);
            }
            else if (c == '"') entreAspas = true;
            else if (c == ',') { linha.Add(campo.ToString()); campo.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < texto.Length && texto[i + 1] == '\n') i++;
                linha.Add(campo.ToString()); campo.Clear();
                linhas.Add(linha); linha = new List<string>();
            }
            else campo.Append(c);
        }

        if (campo.Length > 0 || linha.Count > 0)
        {
            linha.Add(campo.ToString());
            linhas.Add(linha);
        }
        return linhas;
    }
}
