// Estilos compartilhados — mantém altura, espaçamento e cores consistentes
// em todos os botões, inputs e selects do sistema.

// 16 px no celular: abaixo disso o iPhone dá zoom sozinho ao tocar no campo
export const inputStyle = "h-12 sm:h-11 min-w-0 px-4 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-200/60 dark:focus:ring-violet-400/20";

export const labelStyle = "text-xs font-semibold text-slate-600 dark:text-slate-300";

export const botaoBase = "h-11 px-5 inline-flex items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

export const botaoPrimario = `${botaoBase} bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-300/25 dark:text-violet-50 dark:hover:bg-violet-300/35`;

export const botaoSecundario = `${botaoBase} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`;

export const botaoPerigo = `${botaoBase} bg-rose-200 text-rose-950 hover:bg-rose-300 dark:bg-rose-400/25 dark:text-rose-50 dark:hover:bg-rose-400/35`;

export const botaoTexto = "inline-flex min-h-11 items-center px-1 text-violet-800 dark:text-violet-200 hover:underline text-sm font-semibold disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed";

export const cardStyle = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm";

export function badgeEstoque(estoque: number, estoqueMinimo: number) {
  if (estoque <= 0) {
    return { texto: "Sem estoque", classe: "bg-red-500/10 text-red-600 dark:text-red-400" };
  }
  if (estoque <= estoqueMinimo) {
    return { texto: "Estoque baixo", classe: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  }
  return { texto: "Em estoque", classe: "bg-green-500/10 text-green-600 dark:text-green-400" };
}

// Cor-base das artes de divulgação (Post/Story). As artes NÃO seguem o tema claro/escuro da interface:
// o texto de cada arte já tem cor própria e a raiz fixa esta cor, para nada herdar do tema.
export const ARTE_COR_BASE = "#171717";
