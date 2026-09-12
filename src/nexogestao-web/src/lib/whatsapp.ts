// Utilitários reutilizáveis de integração com WhatsApp (link wa.me, sem API oficial,
// sem envio automático — só monta o link e quem decide enviar é o usuário no WhatsApp).

/**
 * Normaliza um telefone brasileiro para o formato esperado pelo wa.me
 * (código do país + DDD + número, só dígitos). Retorna null se o telefone
 * estiver vazio ou não parecer um número brasileiro válido.
 */
export function normalizarTelefone(telefone?: string | null): string | null {
  if (!telefone) return null;

  const digitos = telefone.replace(/\D/g, "");

  // DDD + número, sem código do país (10 dígitos = fixo, 11 = celular com 9º dígito)
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  // Já vem com código do país (55 + DDD + número)
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos;
  }

  return null;
}

/**
 * Monta o link do wa.me para abrir uma conversa, com mensagem pré-preenchida
 * opcional. Retorna null se o telefone for inválido.
 */
export function criarLinkWhatsApp(telefone?: string | null, mensagem?: string): string | null {
  const numero = normalizarTelefone(telefone);
  if (!numero) return null;

  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/**
 * Abre o WhatsApp (app ou web) numa nova aba para o telefone informado.
 * Retorna false (sem abrir nada) se o telefone for inválido/ausente.
 */
export function abrirWhatsApp(telefone?: string | null, mensagem?: string): boolean {
  const link = criarLinkWhatsApp(telefone, mensagem);
  if (!link) return false;

  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}

export function mensagemCobrarFiado(nome: string, valor: number): string {
  return `Olá, ${nome}! Tudo bem? 😊 Passando para lembrar que há um valor de R$ ${valor.toFixed(
    2
  )} pendente conosco. Qualquer dúvida, estamos à disposição.`;
}

export function mensagemAgradecerCompra(nome: string): string {
  return `Olá, ${nome}! 😊 Obrigado pela preferência! Foi um prazer atender você. Esperamos vê-lo novamente em breve!`;
}

export function mensagemPromocaoPadrao(nome: string): string {
  return `Olá, ${nome}! Temos uma promoção especial para você...`;
}
