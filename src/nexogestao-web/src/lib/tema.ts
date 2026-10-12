// Tema (modo claro / modo escuro) do NexoGestão: um único lugar decide, salva e aplica.
//
// Como funciona:
//  - O tema vale pela classe "dark" na <html> (o Tailwind usa `@custom-variant dark` em globals.css).
//  - A escolha da pessoa fica no localStorage (chave nexo_tema = "claro" | "escuro"), neste navegador/aparelho.
//    Não vai para a API nem para o banco: assim vale também nas telas públicas e antes do login, sem depender
//    de rede, e sem mexer em dados de clientes.
//  - Sem escolha salva: empresas que pediram modo claro por padrão (EMPRESAS_TEMA_CLARO no Nav) ficam em claro;
//    as demais seguem a preferência do aparelho (como já era antes).
//  - Um script no <head> (SCRIPT_TEMA) aplica o tema antes da primeira pintura, para não piscar o tema errado.
//  - As artes de divulgação (Post/Story) NÃO usam este tema: ficam como o modelo escolhido.

export type Tema = "claro" | "escuro";

export const CHAVE_TEMA = "nexo_tema";
// Padrão por empresa (não é a escolha da pessoa): gravado pelo Nav quando a empresa pediu modo claro.
export const CHAVE_CLARO_PADRAO = "nexo_tema_claro_forcado";
export const EVENTO_TEMA = "nexo-tema-mudou";

// Roda no <head>, antes de qualquer pintura. Mantém a mesma regra de temaInicial() abaixo.
export const SCRIPT_TEMA = `
(function () {
  try {
    var salvo = localStorage.getItem("${CHAVE_TEMA}");
    var escuro;
    if (salvo === "escuro") escuro = true;
    else if (salvo === "claro") escuro = false;
    else if (localStorage.getItem("${CHAVE_CLARO_PADRAO}") === "1") escuro = false;
    else escuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var el = document.documentElement;
    if (escuro) el.classList.add("dark"); else el.classList.remove("dark");
    el.style.colorScheme = escuro ? "dark" : "light";
  } catch (e) {}
})();
`;

export function temaSalvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return v === "claro" || v === "escuro" ? v : null;
  } catch {
    return null;
  }
}

// Tema que vale agora, na ordem: escolha salva > padrão claro da empresa > preferência do aparelho.
export function temaInicial(): Tema {
  const salvo = temaSalvo();
  if (salvo) return salvo;
  try {
    if (localStorage.getItem(CHAVE_CLARO_PADRAO) === "1") return "claro";
  } catch {
    /* sem localStorage: segue o aparelho */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function temaAplicado(): Tema {
  return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}

export function aplicarTema(tema: Tema) {
  const el = document.documentElement;
  el.classList.toggle("dark", tema === "escuro");
  el.style.colorScheme = tema === "escuro" ? "dark" : "light";
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

// Salva a escolha da pessoa e aplica na hora, sem recarregar a página.
export function definirTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* sem localStorage: vale só nesta visita */
  }
  aplicarTema(tema);
}

// Chamado pelo Nav quando a empresa tem modo claro por padrão. Nunca sobrescreve a escolha da pessoa.
export function definirPadraoClaroDaEmpresa(claroPorPadrao: boolean) {
  try {
    localStorage.setItem(CHAVE_CLARO_PADRAO, claroPorPadrao ? "1" : "0");
  } catch {
    /* ignora */
  }
  if (claroPorPadrao && !temaSalvo()) aplicarTema("claro");
}

// Ids de empresa que pediram modo CLARO POR PADRÃO (pedido pontual de identidade
// visual). É só o ponto de partida: quem usa pode escolher o modo escuro no seletor
// de aparência, e a escolha dela vale mais que este padrão. Fica por Id — nome é
// dado editável do usuário e não deve decidir comportamento do sistema.
export const EMPRESAS_TEMA_CLARO = [3];
