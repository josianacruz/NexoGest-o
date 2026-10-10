using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Shared;

// Gera o rascunho de texto (roteiro/legenda/CTA/hashtags) usando só o nome e
// a categoria que o próprio produto já tem. Nunca inventa: medida, material,
// desconto, depoimento, urgência ("últimas unidades") ou experiência pessoal
// — tudo isso só existe se o usuário editar o texto depois com informação
// real do anúncio. Estrutura de roteiro (gancho / produto / detalhe
// confirmado / chamada) segue a orientação de boas práticas da Shopee Vídeo
// que o usuário trouxe: abrir com o produto/benefício nos 2s iniciais, um
// detalhe por vez, e fechar remetendo ao produto marcado (nunca afirma que o
// link na legenda substitui a vinculação do produto no vídeo).
public static class ConteudoAfiliadoGerador
{
    private static readonly string[] GanchosProblemaSolucao =
    {
        "Já teve dificuldade com isso no dia a dia?",
        "Procurando uma solução prática pra esse problema?",
    };

    public static ConteudoAfiliado Gerar(ProdutoAfiliado produto, int empresaId)
    {
        var nome = produto.Nome;
        var categoria = produto.Categoria ?? "produto";
        // Rotaciona a abordagem pelo Id pra não gerar sempre o mesmo roteiro em lote.
        var abordagem = (AbordagemConteudo)(produto.Id % 4);

        var gancho = abordagem switch
        {
            AbordagemConteudo.Demonstracao => $"Conheça de perto: {nome}.",
            AbordagemConteudo.Tutorial => $"Veja como usar: {nome}.",
            AbordagemConteudo.Comparacao => $"Vale a pena considerar na categoria {categoria}?",
            AbordagemConteudo.ProblemaSolucao => GanchosProblemaSolucao[produto.Id % GanchosProblemaSolucao.Length],
            _ => nome,
        };

        var meioDoRoteiro = abordagem switch
        {
            AbordagemConteudo.Demonstracao => $"Apresente o {nome} mostrando o produto real do anúncio, do mesmo ângulo que as fotos.",
            AbordagemConteudo.Tutorial => $"Mostre passo a passo como usar o {nome}, só com o que está confirmado na descrição do anúncio.",
            AbordagemConteudo.Comparacao => $"Compare o {nome} com outra opção da categoria {categoria} que você já conhece de verdade — sem inventar números de vendas de nenhum dos dois.",
            AbordagemConteudo.ProblemaSolucao => $"Mostre o {nome} resolvendo esse problema específico, com o produto real.",
            _ => "",
        };

        var roteiro =
            $"[0-2s] Gancho: \"{gancho}\"\n" +
            $"[2-10s] Produto: {meioDoRoteiro}\n" +
            "[10-16s] Detalhe confirmado: adicione aqui só o que está escrito no anúncio (medida, material, cor) — não invente.\n" +
            "[16-20s] Fechamento: \"Confira as opções no produto marcado.\"\n\n" +
            "Antes de publicar: confira se as imagens, o texto e o anúncio batem com o produto real.";

        var legenda = $"{nome} — confira os detalhes no produto marcado. 👇";

        var chamada = "Link do produto marcado neste vídeo. Lembrete: a comissão do Shopee Vídeo depende de vincular o produto ao vídeo na publicação, não só colocar o link na legenda.";

        var hashtagsBase = categoria
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(p => p.Length > 2)
            .Take(3)
            .Select(p => "#" + p.Trim('.', ',').ToLowerInvariant());
        var hashtags = string.Join(" ", new[] { "#shopee", "#achadinhos" }.Concat(hashtagsBase).Distinct().Take(5));

        return new ConteudoAfiliado
        {
            EmpresaId = empresaId,
            ProdutoAfiliadoId = produto.Id,
            Abordagem = abordagem,
            Roteiro = roteiro,
            Legenda = legenda,
            ChamadaParaCompra = chamada,
            Hashtags = hashtags,
            Status = StatusConteudo.Pronto,
        };
    }
}
