// Paleta e classes do "visual suave" (pré-visualização). Tudo é Tailwind padrão, sem cor inventada:
//   Lilás suave  = violet     (ação principal, item ativo)
//   Azul bebê    = sky        (informação)
//   Verde menta  = emerald    (positivo / confirmado)
//   Âmbar suave  = amber      (atenção)
//   Rosa suave   = rose       (erro / vencido)
//   Cinza pastel = slate      (fundos, bordas e textos)
// Modo escuro suave: ardósia (slate-900 fundo, slate-800 superfícies), nunca preto puro.
// Botões e selos usam fundo pastel com texto escuro (contraste alto) em vez de cor forte com texto branco.

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500";
const botaoBase = `inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${foco}`;

export const SUAVE = {
  // Fundo da página e textos
  pagina: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  texto: "text-slate-800 dark:text-slate-100",
  textoSuave: "text-slate-600 dark:text-slate-300",
  textoFraco: "text-slate-500 dark:text-slate-400",

  // Cartões
  cartao: "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800",
  cartaoClicavel: "rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800",
  cartaoLivre: "rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/40",

  // Botões
  botaoPrimario: `${botaoBase} bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-300/25 dark:text-violet-50 dark:hover:bg-violet-300/35`,
  botaoSecundario: `${botaoBase} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`,
  botaoSucesso: `${botaoBase} bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-100 dark:hover:bg-emerald-400/30`,
  botaoPequeno: `inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${foco}`,

  // Campos
  campo:
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-200/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-400/20",
  rotulo: "mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300",

  // Opções em formato de pastilha (cliente, serviço, dia, horário)
  chip: `inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition cursor-pointer hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${foco}`,
  chipAtivo: `inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-200 px-4 py-2 text-sm font-semibold text-violet-950 ring-2 ring-violet-300 cursor-pointer dark:border-violet-300/40 dark:bg-violet-300/30 dark:text-violet-50 dark:ring-violet-300/30 ${foco}`,
  chipOcupado: "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500",

  // Selos de estado
  selo: "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
  seloOk: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100",
  seloInfo: "bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100",
  seloAviso: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100",
  seloErro: "bg-rose-100 text-rose-900 dark:bg-rose-400/20 dark:text-rose-100",
  seloNeutro: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",

  // Menu lateral
  lateral: "border-r border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90",
  itemMenu: "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
  itemMenuAtivo: "flex items-center gap-3 rounded-2xl bg-violet-100 px-3 py-2.5 text-sm font-semibold text-violet-900 dark:bg-violet-300/20 dark:text-violet-50",
  grupoMenu: "px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
} as const;

export const SELO_STATUS: Record<string, string> = {
  Agendado: SUAVE.seloInfo,
  Confirmado: SUAVE.seloOk,
  Concluido: SUAVE.seloOk,
  Cancelado: SUAVE.seloErro,
  Faltou: SUAVE.seloAviso,
};

export const TEXTO_STATUS: Record<string, string> = {
  Agendado: "Marcado",
  Confirmado: "Confirmado",
  Concluido: "Concluído",
  Cancelado: "Cancelado",
  Faltou: "Faltou",
};

// ---------- datas e horários (a agenda guarda o horário "de relógio" como UTC; aqui se lê do mesmo jeito) ----------
export const pad = (n: number) => String(n).padStart(2, "0");

export function isoDoDia(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function somarDias(d: Date, dias: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export function horaDoAgendamento(dataHoraIso: string) {
  const d = new Date(dataHoraIso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function gerarHorarios(inicio: string, fim: string, passo = 30) {
  const lista: string[] = [];
  for (let t = minutos(inicio); t + passo <= minutos(fim); t += passo) lista.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  return lista;
}

export function horarioOcupado(hhmm: string, duracao: number, agendamentos: { dataHora: string; duracaoMinutos: number; status?: string }[]) {
  const ini = minutos(hhmm);
  const fim = ini + duracao;
  return agendamentos.some((a) => {
    if (a.status === "Cancelado") return false;
    const ai = minutos(horaDoAgendamento(a.dataHora));
    return ai < fim && ini < ai + a.duracaoMinutos;
  });
}

export function rotuloDoDia(iso: string, hojeIso: string) {
  if (iso === hojeIso) return "Hoje";
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const amanha = isoDoDia(somarDias(new Date(), 1));
  if (iso === amanha) return "Amanhã";
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
