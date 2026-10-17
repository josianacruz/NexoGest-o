// Empresa em uso neste aparelho. Quem tem mais de uma empresa (ou a administradora máster, que vê todas) escolhe no topo
// do painel; a escolha fica guardada aqui e TODAS as telas passam a mostrar essa empresa.
export const CHAVE_EMPRESA_ATIVA = "nexo_empresa_id";

export function empresaAtivaId(): number | null {
  try {
    const n = Number(localStorage.getItem(CHAVE_EMPRESA_ATIVA));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function definirEmpresaAtiva(id: number) {
  try {
    localStorage.setItem(CHAVE_EMPRESA_ATIVA, String(id));
  } catch {
    /* sem armazenamento: volta para a primeira empresa */
  }
}

// Escolhe, na lista devolvida pela API, a empresa ativa (ou a primeira, se a guardada não estiver mais na lista).
// (As telas antigas recebem a lista como `any`; por isso o tipo genérico não força nenhuma forma.)
export function escolherEmpresa<T = any>(lista: T[]): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  const id = empresaAtivaId();
  return lista.find((e) => (e as unknown as { id: number }).id === id) ?? lista[0];
}
