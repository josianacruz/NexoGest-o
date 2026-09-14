// Configuração central dos módulos do sistema — o Nav (e qualquer outra tela
// que precise saber quais módulos existem) usa isto em vez de listas soltas.
// Os nomes das chaves batem com o enum `Modulo` do backend.

export interface ModuloMenu {
  chave: string;
  label: string;
  href: string;
}

// Só entram aqui módulos que já têm uma tela pronta. Financeiro já existe
// como módulo no backend (pra empresas de outros segmentos poderem ser
// configuradas), mas ainda não tem tela — não adianta linkar pra uma
// página que não existe.
// Ordem pensada pro fluxo mais comum primeiro (Produtos → Interesses → Vendas
// → Cobranças); Clientes fica por último porque dá pra achar/cadastrar cliente
// direto na hora de vender, sem precisar de destaque no menu.
export const MODULOS_MENU: ModuloMenu[] = [
  { chave: "Produtos", label: "Produtos", href: "/produtos" },
  { chave: "Interesses", label: "Interesses", href: "/interesses" },
  { chave: "Vendas", label: "Vendas", href: "/vendas" },
  { chave: "Comandas", label: "Comandas", href: "/comandas" },
  { chave: "Agenda", label: "Agenda", href: "/agenda" },
  { chave: "Servicos", label: "Serviços", href: "/servicos" },
  { chave: "Cobrancas", label: "Cobranças", href: "/cobrancas" },
  { chave: "Marketing", label: "Marketing", href: "/marketing" },
  { chave: "Clientes", label: "Clientes", href: "/clientes" },
];

export function temModulo(modulosHabilitados: string[], chave: string): boolean {
  return modulosHabilitados.includes(chave);
}

// Empresas podem guardar "Nome | tagline" no próprio campo Nome (sem precisar
// de coluna nova) — usado em Nav e nas páginas públicas de Story/Interesse.
export function separarNomeEslogan(nomeEmpresa: string): { nome: string; slogan: string | null } {
  const [nome, slogan] = nomeEmpresa.split(" | ");
  return { nome, slogan: slogan ?? null };
}
