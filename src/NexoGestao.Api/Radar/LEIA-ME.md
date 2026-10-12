# Radar Shopee: atualização diária pela API oficial

Estado: **preparado, aguardando a liberação da Shopee**. Sem App ID e Secret aprovados, nada é consultado. O CSV do
painel de afiliados continua funcionando normalmente.

## O que existe

- `Shared/ShopeeAffiliateApiService.cs`: cliente GraphQL (assinatura, paginação, tratamento de erro e de limite).
- `Radar/RadarService.cs`: grava e atualiza produtos, preserva links já guardados, registra uma foto diária dos números,
  controla uma execução por vez e é idempotente por dia (horário de Brasília).
- `Radar/RadarController.cs`: tela do Dono (consultas diárias, liga/desliga, histórico, variações) e o gatilho externo.
- `RadarAgendadorService`: agendador interno às 08:00 de Brasília (desligado por padrão).
- `.github/workflows/radar-diario.yml`: agendador externo (11:00 UTC = 08:00 em Brasília), desligado por padrão.

## O que NÃO está confirmado (vem de material de terceiros)

A documentação oficial fica atrás do login do painel e ainda não foi lida. Estes pontos foram montados a partir de
bibliotecas e ferramentas **não oficiais** e precisam ser conferidos na documentação oficial:

| Item | Suposição atual | Onde ajustar |
|---|---|---|
| Endereço | `https://open-api.affiliate.shopee.com.br/graphql` | `Shopee:Affiliate:Endpoint` |
| Assinatura | SHA-256 de `AppId + timestamp + corpo + Secret` no cabeçalho `Authorization: SHA256 Credential=…, Timestamp=…, Signature=…` | `ShopeeAffiliateApiService.Assinar` |
| Consulta | `productOfferV2(keyword, sortType, page, limit)` com os campos de `MontarCorpoConsulta` | mesmo arquivo |
| Ordenação | 1 relevância, 2 vendas, 3 preço maior, 4 preço menor, 5 comissão | `OrdenacaoRadar` |
| Unidade da taxa | fração (0,38 = 38%) | `Shopee:Affiliate:TaxaEhFracao` |
| Código de limite | erro 10030 | `TemErroDeLimite` |
| "Comissão Extra" | **não confirmado** que `sellerCommissionRate` seja isso; o Nexo mostra "taxa do vendedor" e "taxa da Shopee" e não usa o nome "Extra" | tela e `ProdutoAfiliado` |
| Vendas | não se sabe se é total acumulado ou de um período | por isso a tela mostra a variação entre as consultas do próprio Nexo |
| Limites de requisição | **desconhecidos**; há espera crescente e parada ao receber o aviso de limite | `Shopee:Affiliate:*` (itens por página, páginas, pausa) |

Os testes automatizados (`tests/NexoGestao.Tests`) usam respostas **simuladas** nesse formato. Eles provam que o código lê,
assina e trata erros como projetado, **não** como a API real responde.

## Variáveis de ambiente (nada disso vai para o repositório)

| Variável | Para quê |
|---|---|
| `Shopee__Affiliate__AppId`, `Shopee__Affiliate__AppSecret` | credenciais globais (alternativa: cadastro criptografado da empresa em Afiliados > Configuração; a da empresa tem prioridade) |
| `Shopee__Affiliate__ChaveAgendador` | chave do gatilho externo; sem ela o endpoint responde 404 |
| `Shopee__Affiliate__AgendadorInternoHabilitado` | `true` liga o agendador interno (precisa de servidor sempre ligado) |
| `Shopee__Affiliate__TaxaEhFracao`, `__ItensPorPagina`, `__MaximoPaginasPorConsulta`, `__PausaEntrePaginasMs` | ajustes depois de ler a documentação |

## Quando a Shopee liberar o acesso (passo a passo)

1. Leia a documentação oficial no painel (Open API). Confirme: endereço, assinatura, campos, unidade das taxas, o que é
   "Comissão Extra", limites de requisição e se as regras permitem uso diário automático. Ajuste o que divergir.
2. Cadastre o App ID e o Secret (Afiliados > Configuração) ou use as variáveis acima. **Nunca envie o Secret por chat.**
3. No Radar, cadastre uma consulta (ex.: "mini processador de alimentos") e clique em **Atualizar agora**.
4. Confira o histórico: `RadarExecucoes.AmostraBruta` guarda um item bruto da resposta para você comparar os campos reais
   com os esperados. Se algo vier diferente, o aviso aparece na mensagem da execução.
5. Só então marque "Atualizar automaticamente todos os dias às 08:00".
6. Agendamento: no servidor grátis (que dorme), use o workflow do GitHub (variável `RADAR_ATIVO=true` e segredos
   `RADAR_API_URL` e `RADAR_CHAVE`, e só vale depois de ir para a `main`). Com servidor sempre ligado, use o agendador interno.

## Regras que continuam valendo

- Nenhuma raspagem de página, tela logada ou painel (Termos de afiliados, cláusula 4.4(d)). Só a API oficial e o CSV
  exportado por você.
- Nenhum link de afiliada é criado por montagem; só o que a API devolve ou o que você já guardou. Links já guardados
  não são trocados.
- Dados ausentes ficam em branco; zero vendas é um valor real.
