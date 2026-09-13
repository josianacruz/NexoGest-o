// Estilos compartilhados — mantém altura, espaçamento e cores consistentes
// em todos os botões, inputs e selects do sistema.

export const inputStyle =
  "h-10 px-3 rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-black/30 dark:placeholder:text-white/30";

export const labelStyle = "text-xs font-medium text-black/60 dark:text-white/60";

export const botaoBase =
  "h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export const botaoPrimario = `${botaoBase} bg-indigo-600 text-white hover:bg-indigo-700`;

export const botaoSecundario = `${botaoBase} bg-black/5 dark:bg-white/10 text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/20`;

export const botaoPerigo = `${botaoBase} bg-red-600 text-white hover:bg-red-700`;

export const botaoTexto =
  "text-indigo-600 hover:underline text-sm font-medium disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed";

export const cardStyle =
  "bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl shadow-sm";

export function badgeEstoque(estoque: number, estoqueMinimo: number) {
  if (estoque <= 0) {
    return { texto: "Sem estoque", classe: "bg-red-500/10 text-red-600 dark:text-red-400" };
  }
  if (estoque <= estoqueMinimo) {
    return { texto: "Estoque baixo", classe: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  }
  return { texto: "Em estoque", classe: "bg-green-500/10 text-green-600 dark:text-green-400" };
}
