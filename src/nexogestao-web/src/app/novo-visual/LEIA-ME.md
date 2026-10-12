# Novo visual (pré-visualização) — `/novo-visual`

Prévia do redesenho simples e suave. **Não altera nenhuma tela existente, nem o banco.** Para abrir: Configurações → "Ver o novo visual", ou `/novo-visual`.

## 1. Estrutura do layout

```
novo-visual/
├─ layout.tsx            → envolve tudo no ShellSuave
├─ page.tsx              → Início: Stories, atalhos, agenda do dia, clientes
└─ _ux/
   ├─ tokens.ts          → TODAS as classes Tailwind da paleta (fonte única) + helpers de data
   ├─ EmpresaContext.tsx → carrega a empresa/módulos uma vez e entrega `api()` já autenticada
   ├─ ShellSuave.tsx     → menu lateral agrupado + cabeçalho (nome da loja, tema, Sair)
   ├─ Stories.tsx        → carrossel de novidades + criar (2 toques) + visualizador
   ├─ AgendamentoRapido.tsx → modal "Agendar em 1 toque"
   ├─ AgendaDia.tsx      → agenda em cartões (horários livres tracejados, 1 toque agenda)
   └─ ClientesSuave.tsx  → clientes em cartões com botão "Agendar"
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

## 4. Stories & Novidades

Carrossel no topo do início: **"Novo"** (círculo tracejado) → escolher o tipo (novidade, promoção ou lembrete; o texto já vem sugerido) → **"Publicar"** = 2 toques. Toque no círculo abre o visualizador (barras de progresso, avança sozinho, enviar por WhatsApp, copiar texto, apagar). O círculo "Hoje" resume a agenda do dia.

**Limite desta prévia:** as novidades ficam **só neste aparelho** (`localStorage`, chave `nexo_stories_<empresaId>`) e expiram em 24 h. Para aparecerem para os clientes ou em outros aparelhos é preciso backend (tabela + endpoint público) — decisão pendente.
