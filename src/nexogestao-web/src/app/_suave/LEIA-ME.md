# Visual suave (design system) — telas migradas em etapas

O visual suave é o padrão das telas **já migradas**: Início, Clientes, Agenda, Vendas, Comandas, Cobranças, Interesses,
Produtos, Serviços, Relatórios, Avisos, Afiliados, Marketing e Configurações: **todas as telas do sistema**. Só a tela de login e as páginas públicas dos clientes (agendar, vaga, interesse) têm layout próprio.
As artes de divulgação (`data-arte`) não seguem o tema nem a fonte da tela: ficam sempre iguais (fonte Arial fixada em `globals.css`).
Os estilos de botões, campos e cartões das telas antigas vêm de `_components/ui.ts`, que já usa a paleta suave. Para migrar uma tela:
mover a pasta dela para `src/app/(suave)/` (o grupo `(suave)` não aparece no endereço) e trocar `Nav`/`PageHeader` e os
estilos antigos pelos de `_suave/tokens.ts`. Etapa 1 concluída; sugestão de próximas: Agenda, Vendas/Comandas, Cobranças,
Produtos/Interesses, Marketing/Afiliados, Serviços/Relatórios, Configurações.

## 1. Estrutura do layout

```
(suave)/
├─ layout.tsx            → fonte Plus Jakarta Sans + ShellSuave (menu lateral e cabeçalho)
├─ inicio/page.tsx       → Início: Stories, atalhos, agenda do dia, clientes
└─ clientes/page.tsx     → Clientes em cartões (novo/editar, contas a receber, WhatsApp, agendar)
_suave/
├─ tokens.ts             → TODAS as classes Tailwind da paleta (fonte única) + helpers de data
├─ EmpresaContext.tsx    → carrega a empresa/módulos uma vez e entrega `api()` já autenticada
├─ ShellSuave.tsx        → menu lateral agrupado + cabeçalho (nome da loja, tema, Sair)
├─ Folha.tsx             → janela padrão (sobe de baixo no celular, centralizada no computador)
├─ StoriesVisual.tsx     → tipos, anéis e visualizador (usado pelo Dono e pelos clientes)
├─ Stories.tsx           → Stories do Dono (criar/apagar na API)
├─ VitrineStories.tsx    → faixa de novidades que o CLIENTE vê em /agendar/<loja>
├─ AgendamentoRapido.tsx → modal "Agendar em 1 toque"
├─ AgendaDia.tsx         → agenda em cartões (horários livres tracejados, 1 toque agenda)
└─ ClientesSuave.tsx     → prévia de clientes no Início
```

Menu lateral (os 12 botões antigos, agrupados; só aparecem os módulos que a empresa tem):

| Grupo | Itens |
|---|---|
| Hoje | Início · Agenda · Clientes |
| Vender | Vendas · Comandas · Cobranças · Interesses · Produtos |
| Divulgar | Marketing · Afiliados |
| Gestão | Serviços · Relatórios · Configurações |

No computador o menu é fixo e recolhível (guarda a escolha). No celular vira gaveta (botão ☰).

## 2. Paleta (Tailwind padrão, sem cor inventada)

Lilás = `violet` · azul bebê = `sky` · menta = `emerald` · âmbar = `amber` · rosa = `rose` · cinza = `slate`.
Escuro suave: ardósia (`slate-900` fundo, `slate-800` superfícies), nunca preto puro.
Botões e selos: fundo pastel + texto escuro (contraste alto), não cor forte com texto branco.

| Uso | Classes |
|---|---|
| Página | `bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100` |
| Cartão | `rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800` |
| Cartão livre (horário vago) | `rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/40` |
| Botão principal | `rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-300/25 dark:text-violet-50` |
| Botão secundário | `… bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100` |
| Botão sucesso | `… bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-100` |
| Campo | `rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-violet-400 focus:ring-4 focus:ring-violet-200/60 dark:border-slate-600 dark:bg-slate-900` |
| Pastilha | `rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700` |
| Pastilha ativa | `rounded-full border border-violet-300 bg-violet-200 text-violet-950 ring-2 ring-violet-300 dark:bg-violet-300/30 dark:text-violet-50` |
| Selo ok / info / aviso / erro | `bg-emerald-100 text-emerald-900` · `bg-sky-100 text-sky-900` · `bg-amber-100 text-amber-900` · `bg-rose-100 text-rose-900` (escuro: `bg-<cor>-400/20 text-<cor>-100`) |
| Menu item | `rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700` |
| Menu item ativo | `rounded-2xl bg-violet-100 text-violet-900 font-semibold dark:bg-violet-300/20 dark:text-violet-50` |

Fonte: *Plus Jakarta Sans* (Google Fonts via `next/font`), carregada só no `layout.tsx` do novo visual.
Auditoria de contraste (automática, mínimo 4,5:1 texto / 3:1 ícones): zero falhas em claro e escuro, tela inicial e modal.

## 3. Agendamento rápido (poucos toques)

Abre por: atalho "Agendar agora" (início), botão "Agendar" no cartão do cliente, ou toque num horário livre da agenda (já vem com dia e hora).

Lógica para chegar em **1–2 toques**:

1. **Cliente**: já vem escolhido quando o toque veio do cartão do cliente. Senão, pastilhas dos 8 primeiros + busca por nome/telefone + "+ Cliente novo" (só nome e telefone; é cadastrado junto).
2. **Serviço**: pré-seleciona o **último usado** (guardado neste aparelho); senão o primeiro.
3. **Dia/hora**: dia = hoje (ou amanhã se o expediente de hoje já acabou); hora = **primeiro horário livre** que cabe a duração do serviço, respeitando o expediente da empresa e os agendamentos existentes.
4. Resumo em uma linha ("Ana Souza · Corte feminino · amanhã às 09:00 · R$ 80,00") e **um botão "Agendar"**.
5. Se o horário foi ocupado entretanto, a API responde 409; o modal mostra "Já tem X nesse horário" com **"Agendar mesmo assim"**.
6. Sucesso: "Agendado! ✅" + link **"Avisar o cliente no WhatsApp"** com a mensagem pronta.

```tsx
// resumo do essencial de AgendamentoRapido.tsx
const livres = gerarHorarios(expediente.inicio, expediente.fim, 30)
  .filter((h) => !(dia === hoje && h <= horaAgora) && !horarioOcupado(h, duracao, doDia));
useEffect(() => { if (!hora || !livres.includes(hora)) setHora(livres[0] ?? null); }, [livres]); // 1º livre automático

await api("/agendamentos", { method: "POST", body: JSON.stringify({
  clienteId, servicoId, servicoNome, data: `${dia}T00:00:00Z`, hora,
  duracaoMinutos, valor, forcarComConflito: forcar,   // true só em "Agendar mesmo assim"
}) });
```

## 4. Stories & Novidades (no servidor, visíveis para os clientes)

- **Dono**: no Início, "Novo" (ou "Enviar novidade") → tipo (novidade, promoção ou lembrete; o texto já vem sugerido) → **"Publicar"** = 2 toques. Depois de publicar aparece "Copiar link para os clientes". Só o Dono publica e apaga.
- **Cliente**: vê a faixa de novidades no topo da página pública de agendamento `/agendar/<id da loja>`, sem login, e toca em "Agendar um horário".
- **Regras**: texto simples de até 180 letras (mostrado como texto, nunca como HTML), validade de 24 h, no máximo 10 no ar por loja; expirados há mais de 7 dias são removidos na próxima publicação.
- **API**: `GET/POST api/empresas/{id}/stories`, `DELETE api/empresas/{id}/stories/{storyId}` (login; escrita só Dono) e `GET api/publico/empresas/{id}/stories` (público, com limite de requisições). Tabela nova `StoriesLoja` (migration `CriaStoriesDaLoja`, só cria a tabela).

## 5. Biblioteca rápida de fotos

- Componente `BibliotecaRapida`: miniaturas das últimas fotos da loja; **1 toque reaproveita** uma foto, "＋ Foto" envia outra e já a seleciona. Aparece ao criar novidade (Stories), no cadastro de produto e no Story do produto.
- A foto é reduzida no aparelho (lado maior 1080 px, JPEG, até ~380 KB) antes de enviar; a mesma foto não entra duas vezes (SHA-256) e só volta para o topo.
- Limite de 60 fotos por loja: ao passar, sai a mais antiga que não esteja numa novidade no ar.
- API: `GET/POST api/empresas/{id}/midias`, `GET .../midias/{mid}/arquivo`, `POST .../midias/{mid}/usar`, `DELETE .../midias/{mid}` (login, só da própria loja). A foto de uma novidade no ar é pública apenas em `GET api/publico/empresas/{id}/stories/{storyId}/imagem`; as demais fotos da biblioteca nunca são expostas.
- Tabela `MidiasLoja`; novidades ganham `MidiaId` (opcional).

## 6. Nicho da loja e cadastro por nicho

- Configurações → "Tipo da loja": Alimentos, Moda e roupas, Beleza e serviços ou Outros (só o Dono muda). Sem escolha, vale o padrão do tipo de negócio com que a loja foi criada.
- O cadastro de produto (`CamposDoNicho`) mostra: **Alimentos** = ingredientes, tamanhos (com preço) e adicionais (com preço); **Moda** = grade PP–XG e cores; **Beleza/Serviços** = duração em minutos; **Outros** = nada extra.
- Os detalhes ficam em `Produto.AtributosJson`, validados pela API (limites: 20 adicionais, 8 tamanhos, 20 cores, grade só PP/P/M/G/GG/XG, duração de 5 a 600 min). Trocar de nicho não apaga o que já foi cadastrado.
