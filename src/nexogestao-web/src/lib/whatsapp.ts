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

function formatarDataBr(data: string | Date): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function mensagemLembreteVencimento(nome: string, valor: number, vencimento: string | Date): string {
  return `Olá, ${nome}! 😊 Passando para lembrar que seu pagamento de R$ ${valor.toFixed(
    2
  )}, com vencimento em ${formatarDataBr(vencimento)}, está próximo. Qualquer dúvida, estamos à disposição.`;
}

export function mensagemCobrancaVencida(nome: string, valor: number, vencimento: string | Date): string {
  return `Olá, ${nome}! Passando para lembrar que o pagamento de R$ ${valor.toFixed(
    2
  )}, com vencimento em ${formatarDataBr(vencimento)}, está pendente. Se você já realizou o pagamento, pode desconsiderar esta mensagem. 😊`;
}

export function mensagemAgendamentoAtrasado(nome: string, hora: string): string {
  return `Oi, ${nome}! Seu horário estava marcado para ${hora}. Está a caminho?`;
}

// Sem link de confirmação online (o sistema ainda não tem essa página) —
// pede a confirmação diretamente pela conversa.
export function mensagemAgendamentoConfirmacao(nome: string, data: string, hora: string, servico: string): string {
  return `Oi, ${nome}! Seu horário está marcado para ${data} às ${hora} para ${servico}. Você pode confirmar, reagendar ou cancelar respondendo aqui, por favor?`;
}

export function mensagemAgendamentoLembrete(nome: string, hora: string): string {
  return `Oi, ${nome}! Passando para lembrar do seu horário hoje às ${hora} 😊`;
}

export function mensagemLinkAgendamento(nome: string, link: string): string {
  return `Oi, ${nome}! Você pode marcar seu horário direto por aqui, quando for melhor pra você: ${link}`;
}

export function mensagemInteresseProduto(nome: string, produtoNome: string, preco: number): string {
  return `Oi, ${nome}! Vi que você tem interesse em ${produtoNome} (R$ ${preco.toFixed(
    2
  )}). Posso te ajudar a fechar? 😊`;
}
