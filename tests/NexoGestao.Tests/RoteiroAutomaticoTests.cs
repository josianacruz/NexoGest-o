using System.Text.Json;
using NexoGestao.Api.Shared;
using Xunit;
using Xunit.Abstractions;

namespace NexoGestao.Tests;

// Regras do gerador de falas que valem para TODOS os produtos: tom de pessoa apresentando, números por
// extenso só na voz, sem frases proibidas, sem invenção e roteiro mais curto quando faltam dados.
public class RoteiroAutomaticoTests(ITestOutputHelper saida)
{
    private static readonly string[] FrasesProibidas =
    {
        "o anúncio cita", "no anúncio aparece", "segundo o anúncio", "dá pra ver", "dá para ver", "nas fotos", "nesse ângulo", "nesse angulo",
        "por mais de um ângulo", "confira as opções", "veja as opções", "produto marcado", "informações estão", "confira tudo", "ficha técnica",
    };

    private static readonly string[] Fotos = { "img_0.jpg", "img_1.jpg", "img_2.jpg", "img_3.jpg", "img_4.jpg" };

    private static (List<(string fala, string legenda, string tom, int shots)> Cenas, RoteiroGerado R) Roteiro(string titulo, long itemId = 1, string? obs = null,
        string[]? categorias = null, string[]? fotos = null)
    {
        var r = RoteiroAutomatico.Gerar(titulo, itemId, fotos ?? Fotos, categorias, obs);
        using var doc = JsonDocument.Parse(r.RoteiroJson);
        var cenas = doc.RootElement.GetProperty("cenas").EnumerateArray()
            .Select(c => (c.GetProperty("fala").GetString()!, c.GetProperty("legenda").GetString()!, c.GetProperty("tom").GetString()!, c.GetProperty("shots").GetArrayLength()))
            .ToList();
        return (cenas, r);
    }

    private void Mostra(string titulo, long itemId = 1, string? obs = null)
    {
        var (cenas, r) = Roteiro(titulo, itemId, obs);
        saida.WriteLine($"TÍTULO: {titulo}  [{r.Categoria}, versão {r.Versao}]");
        foreach (var c in cenas)
        {
            saida.WriteLine($"  VOZ:     {c.fala}");
            if (c.fala != c.legenda) saida.WriteLine($"  LEGENDA: {c.legenda}");
        }
        saida.WriteLine($"  POST:    {r.Legenda}   {r.Hashtags}");
        saida.WriteLine("");
    }

    [Fact]
    public void Imprime_exemplos_para_conferir_o_tom()
    {
        Mostra("Kit Limpa Telas  500ml + 5 Flanelas – Celular Monitor Tv Notebooks Limpa Óculos  Petra Sports", 0);
        Mostra("Calça Jeans Feminina Wide Leg Cintura Alta Pantalona", 1);
        Mostra("Motor Arranque Partida Voyage 2016-2023 Gol 1.0 3cc", 2, "As fotos mostram marcas de uso");
        Mostra("Mangueira Pequena Ar Condicionado Honda Fit 1.5 09-14", 0);
        Mostra("Mini Processador de Alimentos", 1);
        Mostra("Mini Processador Triturador Elétrico Alho Cebola Portátil Recarregável", 2);
        Mostra("Garrafa Térmica Inox 500ml com Tampa", 3);
        Mostra("Colar Feminino Dourado com Pérola", 1);
    }

    [Theory]
    [InlineData("Kit Limpa Telas  500ml + 5 Flanelas – Celular Monitor Tv Notebooks Limpa Óculos  Petra Sports")]
    [InlineData("Calça Jeans Feminina Wide Leg Cintura Alta Pantalona")]
    [InlineData("Motor Arranque Partida Voyage 2016-2023 Gol 1.0 3cc")]
    [InlineData("Mangueira Pequena Ar Condicionado Honda Fit 1.5 09-14")]
    [InlineData("Mini Processador de Alimentos")]
    [InlineData("Garrafa Térmica Inox 500ml com Tampa")]
    [InlineData("Colar Feminino Dourado com Pérola")]
    [InlineData("Produto Qualquer Sem Informacao Nenhuma")]
    public void Nunca_usa_as_frases_proibidas_em_nenhuma_variante(string titulo)
    {
        for (long id = 0; id < 12; id++)
        {
            var (cenas, r) = Roteiro(titulo, id, id % 2 == 0 ? "Peça usada" : null);
            var tudo = string.Join(" | ", cenas.Select(c => c.fala + " " + c.legenda)).ToLowerInvariant() + " " + r.Legenda.ToLowerInvariant();
            foreach (var proibida in FrasesProibidas)
                Assert.DoesNotContain(proibida, tudo);
        }
    }

    [Fact]
    public void Kit_na_voz_sai_por_extenso_e_na_legenda_com_digitos()
    {
        var (cenas, _) = Roteiro("Kit Limpa Telas  500ml + 5 Flanelas – Celular Monitor Tv Notebooks Limpa Óculos  Petra Sports", 0);
        var voz = string.Join(" ", cenas.Select(c => c.fala));
        var legenda = string.Join(" ", cenas.Select(c => c.legenda));
        Assert.Contains("quinhentos mililitros", voz);
        Assert.Contains("cinco flanelas", voz);
        Assert.DoesNotContain(voz, char.IsDigit);
        Assert.Contains("500 ml", legenda);
        Assert.Contains("5 flanelas", legenda);
        Assert.Contains("Tá procurando um kit", voz);
        Assert.Contains("tevê", voz); // "TV" é falada como "tevê"
    }

    [Fact]
    public void Autopeca_fala_anos_e_motor_por_extenso_e_atribui_a_aplicacao_ao_vendedor()
    {
        var (cenas, _) = Roteiro("Motor Arranque Partida Voyage 2016-2023 Gol 1.0 3cc", 0, "As fotos mostram marcas de uso");
        var voz = string.Join(" ", cenas.Select(c => c.fala));
        Assert.Contains("motor de arranque", voz);
        Assert.Contains("O vendedor indica pra Voyage de dois mil e dezesseis a dois mil e vinte e três e Gol um ponto zero", voz);
        Assert.Contains("As fotos mostram marcas de uso.", voz); // observação de quem revisou entra como veio
        Assert.DoesNotContain(voz, char.IsDigit);
        Assert.DoesNotContain("3cc", string.Join(" ", cenas.Select(c => c.legenda)));
        // compatibilidade nunca é garantida só pelo título
        Assert.Contains(cenas, c => c.tom == "fechamento" && (c.fala.Contains("conferir") || c.fala.Contains("Confere")));
    }

    [Fact]
    public void Anos_de_dois_digitos_viram_quatro()
    {
        var (cenas, _) = Roteiro("Mangueira Pequena Ar Condicionado Honda Fit 1.5 09-14", 0);
        var legenda = string.Join(" ", cenas.Select(c => c.legenda));
        Assert.Contains("Honda Fit 1.5 de 2009 a 2014", legenda);
    }

    [Fact]
    public void Roupa_descreve_modelagem_e_cintura_em_frase_falada()
    {
        var (cenas, _) = Roteiro("Calça Jeans Feminina Wide Leg Cintura Alta Pantalona", 1);
        var voz = string.Join(" ", cenas.Select(c => c.fala));
        Assert.Contains("Tá atrás de" + " uma calça jeans feminina", voz.Replace("Precisa de", "Tá atrás de").Replace("Tá procurando", "Tá atrás de"));
        Assert.Contains("wide leg", voz);
        Assert.Contains("cintura alta", voz);
        Assert.DoesNotContain("pantalona, ", voz); // não lê a lista do título
    }

    [Fact]
    public void Sem_informacao_o_roteiro_fica_curto_e_nao_enche_linguica()
    {
        var (cenas, _) = Roteiro("Produto Qualquer Sem Informacao Nenhuma", 1);
        Assert.True(cenas.Count <= 3, $"esperava roteiro curto, veio com {cenas.Count} cenas");
        var voz = string.Join(" ", cenas.Select(c => c.fala)).ToLowerInvariant();
        Assert.DoesNotContain("qualidade", voz);
        Assert.DoesNotContain("confort", voz);
        Assert.DoesNotContain("desconto", voz);
        Assert.DoesNotContain("aproveite", voz);
    }

    [Fact]
    public void Encerramento_nao_e_obrigatorio_e_varia_entre_produtos()
    {
        var finais = Enumerable.Range(0, 4)
            .Select(id => Roteiro("Garrafa Térmica Inox 500ml com Tampa", id).Cenas.Last())
            .Select(c => c.tom == "fechamento" ? c.fala : "(sem encerramento)")
            .Distinct().ToList();
        Assert.True(finais.Count >= 3, "os encerramentos deveriam variar: " + string.Join(" / ", finais));
        Assert.Contains("(sem encerramento)", finais); // em alguns vídeos termina sem chamada
    }

    [Fact]
    public void Fotos_e_visual_continuam_funcionando_com_poucas_e_muitas_fotos()
    {
        var (poucas, _) = Roteiro("Garrafa Térmica Inox 500ml com Tampa", 1, fotos: new[] { "a.jpg", "b.jpg", "c.jpg" });
        Assert.All(poucas, c => Assert.Equal(1, c.shots) );
        var (muitas, _) = Roteiro("Garrafa Térmica Inox 500ml com Tampa", 1, fotos: Enumerable.Range(0, 9).Select(i => $"{i}.jpg").ToArray());
        Assert.Equal(1, muitas[0].shots); // abre com a capa inteira
        Assert.Contains(muitas, c => c.shots >= 2);
    }

    [Theory]
    [InlineData(0, "zero")]
    [InlineData(5, "cinco")]
    [InlineData(16, "dezesseis")]
    [InlineData(21, "vinte e um")]
    [InlineData(100, "cem")]
    [InlineData(101, "cento e um")]
    [InlineData(500, "quinhentos")]
    [InlineData(1000, "mil")]
    [InlineData(1500, "mil e quinhentos")]
    [InlineData(1998, "mil novecentos e noventa e oito")]
    [InlineData(2016, "dois mil e dezesseis")]
    [InlineData(2023, "dois mil e vinte e três")]
    [InlineData(21000, "vinte e um mil")]
    public void Numeros_por_extenso_em_portugues_do_brasil(long n, string esperado) =>
        Assert.Equal(esperado, RoteiroAutomatico.PorExtenso(n));

    [Theory]
    [InlineData("500 ml", "quinhentos mililitros")]
    [InlineData("1 ml", "um mililitro")]
    [InlineData("2 l", "dois litros")]
    [InlineData("1,5 l", "um vírgula cinco litros")]
    [InlineData("30 cm", "trinta centímetros")]
    [InlineData("2 flanelas", "duas flanelas")]
    [InlineData("1 frasco", "um frasco")]
    [InlineData("3 peças", "três peças")]
    [InlineData("Gol 1.6", "Gol um ponto seis")]
    [InlineData("2016 a 2023", "dois mil e dezesseis a dois mil e vinte e três")]
    [InlineData("500ml", "quinhentos mililitros")]
    public void Fala_converte_numeros_e_unidades(string entrada, string esperado) =>
        Assert.Equal(esperado, RoteiroAutomatico.Fala(entrada));

    [Fact]
    public void Legenda_mantem_digitos_e_separa_a_unidade()
    {
        Assert.Equal("vem com 500 ml e 5 flanelas", RoteiroAutomatico.Legenda("vem com 500ml e 5 flanelas"));
        Assert.Equal("2016 a 2023", RoteiroAutomatico.Legenda("2016-2023"));
    }
}
