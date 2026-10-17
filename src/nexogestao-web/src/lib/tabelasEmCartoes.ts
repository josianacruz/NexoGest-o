// Copia o texto do cabeçalho de cada coluna para as células (data-rotulo), que o CSS de "tabela-cartoes" mostra ao lado
// do valor quando a tabela vira cartão no celular. Roda de novo sempre que a tela mudar (listas carregam depois).
export function rotularTabelas(raiz: ParentNode = document) {
  raiz.querySelectorAll<HTMLTableElement>("table.tabela-cartoes").forEach((tabela) => {
    const rotulos = Array.from(tabela.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
    tabela.querySelectorAll("tbody tr").forEach((linha) => {
      Array.from(linha.children).forEach((celula, i) => {
        if (celula.hasAttribute("colspan")) return;
        if (rotulos[i] && celula.getAttribute("data-rotulo") !== rotulos[i]) celula.setAttribute("data-rotulo", rotulos[i]);
      });
    });
  });
}

export function observarTabelas(alvo: HTMLElement): () => void {
  let agendado = false;
  const rodar = () => {
    agendado = false;
    rotularTabelas(alvo);
  };
  const observador = new MutationObserver(() => {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(rodar);
    }
  });
  observador.observe(alvo, { childList: true, subtree: true });
  rodar();
  return () => observador.disconnect();
}
