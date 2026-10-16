import { API_URL } from "../../lib/api";
import type { ServicoPublico } from "../../lib/chic";
import { baixarBlob, gerarPdfCardapio } from "../../lib/pdfCardapio";
import { separarNomeEslogan } from "../../lib/modulos";

export interface Loja {
  nome: string;
  slogan: string | null;
  whatsapp: string | null; // só dígitos com 55, ou nulo se a loja não cadastrou
}

const base = (empresaId: number) => `${API_URL}/api/publico/empresas/${empresaId}/agenda`;

export async function mensagemDeErro(res: Response, padrao: string) {
  const d = await res.json().catch(() => null);
  return d?.mensagem ?? padrao;
}

// ---------------------------------------------------------------------------------------------------------
// Página da loja (nome, WhatsApp e serviços) numa única chamada, com cache no aparelho:
// na segunda visita a tela abre na hora com o que ficou guardado e confere o servidor em segundo plano.
// ---------------------------------------------------------------------------------------------------------
export interface Pagina {
  loja: Loja;
  servicos: ServicoPublico[];
}

const VALIDADE_PAGINA_MS = 6 * 60 * 60 * 1000; // depois de 6 h o guardado não é mais usado
const chavePagina = (id: number, completa: boolean) => `nexo_pagina_${id}_${completa ? "tabela" : "agenda"}`;

export function paginaEmCache(empresaId: number, completa = false): Pagina | null {
  try {
    const bruto = localStorage.getItem(chavePagina(empresaId, completa));
    if (!bruto) return null;
    const { quando, pagina } = JSON.parse(bruto) as { quando: number; pagina: Pagina };
    return Date.now() - quando < VALIDADE_PAGINA_MS && Array.isArray(pagina?.servicos) ? pagina : null;
  } catch {
    return null;
  }
}

export async function buscarPagina(empresaId: number, completa = false): Promise<Pagina> {
  const res = await fetch(`${base(empresaId)}/pagina${completa ? "?completa=true" : ""}`);
  if (!res.ok) {
    if (res.status === 404) {
      try {
        localStorage.removeItem(chavePagina(empresaId, completa)); // a loja desligou o agendamento: não mostrar o guardado
      } catch {
        /* ignora */
      }
    }
    throw Object.assign(new Error(await mensagemDeErro(res, "Agendamento não disponível para esta loja.")), { status: res.status });
  }
  const d = await res.json();
  const n = separarNomeEslogan(d.nome ?? "");
  const pagina: Pagina = { loja: { nome: n.nome, slogan: n.slogan, whatsapp: d.whatsApp ?? d.whatsapp ?? null }, servicos: d.servicos ?? [] };
  try {
    localStorage.setItem(chavePagina(empresaId, completa), JSON.stringify({ quando: Date.now(), pagina }));
  } catch {
    /* sem armazenamento: só não guarda */
  }
  return pagina;
}

// Horários: guardados em memória por 45 s (alternar entre dias e voltar não pede de novo) e podem ser pedidos antes
// (pré-busca) enquanto a pessoa ainda está decidindo.
const VALIDADE_HORARIOS_MS = 45_000;
const horariosGuardados = new Map<string, { quando: number; horarios: string[] }>();
const horariosPedidos = new Map<string, Promise<string[]>>();
const chaveHorarios = (empresaId: number, servicoId: number, data: string) => `${empresaId}|${servicoId}|${data}`;

export function horariosEmCache(empresaId: number, servicoId: number, data: string): string[] | null {
  const g = horariosGuardados.get(chaveHorarios(empresaId, servicoId, data));
  return g && Date.now() - g.quando < VALIDADE_HORARIOS_MS ? g.horarios : null;
}

export function esquecerHorarios(empresaId: number, servicoId: number, data: string) {
  horariosGuardados.delete(chaveHorarios(empresaId, servicoId, data));
}

export function carregarHorarios(empresaId: number, servicoId: number, data: string): Promise<string[]> {
  const chave = chaveHorarios(empresaId, servicoId, data);
  const pronto = horariosEmCache(empresaId, servicoId, data);
  if (pronto) return Promise.resolve(pronto);
  const emAndamento = horariosPedidos.get(chave);
  if (emAndamento) return emAndamento; // já foi pedido (pré-busca): reaproveita a mesma resposta
  const pedido = (async () => {
    const res = await fetch(`${base(empresaId)}/horarios?servicoId=${servicoId}&data=${data}`);
    if (!res.ok) throw new Error(await mensagemDeErro(res, "Não foi possível buscar os horários. Tente novamente."));
    const horarios: string[] = await res.json();
    horariosGuardados.set(chave, { quando: Date.now(), horarios });
    return horarios;
  })().finally(() => horariosPedidos.delete(chave));
  horariosPedidos.set(chave, pedido);
  return pedido;
}

export function preBuscarHorarios(empresaId: number, servicoId: number, data: string) {
  carregarHorarios(empresaId, servicoId, data).catch(() => {
    /* pré-busca é só um adiantamento: o erro aparece se a pessoa realmente chegar nessa tela */
  });
}

export async function confirmarAgendamento(empresaId: number, corpo: { servicoId: number; data: string; hora: string; nomeCliente: string; celular: string }) {
  const res = await fetch(`${base(empresaId)}/agendamento`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  return { ok: res.ok, status: res.status, mensagem: res.ok ? null : await mensagemDeErro(res, "Não foi possível confirmar o agendamento.") };
}

// Baixa a tabela de preços completa em PDF (gerado no celular da cliente; o servidor só entrega a lista).
export async function baixarTabelaPdf(empresaId: number, loja: Loja, linkAgendar: string) {
  const { servicos } = paginaEmCache(empresaId, true) ?? (await buscarPagina(empresaId, true));
  const blob = await gerarPdfCardapio({ nomeSalao: loja.nome, slogan: loja.slogan, servicos, link: linkAgendar });
  baixarBlob(blob, "tabela-de-servicos.pdf");
}

// ---- datas (sempre no calendário do celular da pessoa, não em UTC) ----
const pad = (n: number) => String(n).padStart(2, "0");
export const chaveDoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dataDaChave = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d);
};
export const proximosDias = (n: number) => {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => chaveDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)));
};
export const diaSemanaCurto = (chave: string) => dataDaChave(chave).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
export const diaLongo = (chave: string) => {
  const t = dataDaChave(chave).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
