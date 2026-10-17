// Aviso "pagamento efetuado com sucesso": qualquer tela do caixa (vendas, comandas, cobranças, agenda, contas do cliente)
// chama avisarPagamento() depois que o servidor CONFIRMOU a gravação; o painel mostra o cartão de confirmação.
export const EVENTO_PAGAMENTO = "nexo:pagamento";

export interface DadosPagamento {
  titulo?: string; // padrão: "Pagamento efetuado com sucesso"
  valor?: number;
  forma?: string; // Pix, Dinheiro, Crédito…
  quem?: string; // cliente
  detalhe?: string;
}

export function avisarPagamento(dados: DadosPagamento = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_PAGAMENTO, { detail: dados }));
}
