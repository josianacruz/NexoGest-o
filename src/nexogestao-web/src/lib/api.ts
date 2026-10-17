export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5104";

export const MODULO_INDISPONIVEL_MSG =
  "Este módulo não está disponível para a sua empresa. Fale com quem administra sua conta se acha que isso é um engano.";

/**
 * true se alguma das respostas veio 403 — o backend nega assim quando o
 * módulo daquela API está desabilitado para a empresa (ver ModulosEmpresa).
 * Usar antes de chamar `.json()` nessas respostas, que vêm sem corpo.
 */
export function moduloIndisponivel(...respostas: Response[]): boolean {
  return respostas.some((r) => r.status === 403);
}

// ---------------------------------------------------------------------------------------------------------
// Chamadas à API pensadas para celular (internet oscilando, servidor acordando):
//  - limite de tempo: nenhuma tela fica "carregando" para sempre;
//  - leituras (GET) tentam de novo sozinhas se a rede falhar ou o servidor responder 502/503/504;
//  - gravações (POST/PUT/DELETE) NÃO são repetidas sozinhas (para nunca gravar duas vezes): a tela mantém o que a
//    pessoa digitou e ela toca de novo;
//  - quando a rede falha, avisa o resto da tela (faixa "sem conexão") e some sozinha quando volta.
// ---------------------------------------------------------------------------------------------------------
export type TipoFalhaDeRede = "sem-conexao" | "demora" | "servidor-ocupado";

export class FalhaDeRede extends Error {
  tipo: TipoFalhaDeRede;
  constructor(tipo: TipoFalhaDeRede) {
    super(mensagemDeRede(tipo));
    this.name = "FalhaDeRede";
    this.tipo = tipo;
  }
}

export function mensagemDeRede(tipo: TipoFalhaDeRede): string {
  switch (tipo) {
    case "sem-conexao":
      return "Sem conexão com a internet. O que você digitou continua aqui; confira o sinal e tente de novo.";
    case "demora":
      return "A conexão está lenta e a resposta não chegou. O que você digitou continua aqui; toque de novo em alguns segundos.";
    default:
      return "O servidor está se reconectando. O que você digitou continua aqui; tente de novo em alguns segundos.";
  }
}

export const EVENTO_REDE = "nexo:rede";
const avisarRede = (ok: boolean, tipo?: TipoFalhaDeRede) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_REDE, { detail: { ok, tipo } }));
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiFetch(url: string, init: RequestInit = {}, opcoes: { timeoutMs?: number; tentativas?: number } = {}): Promise<Response> {
  const metodo = (init.method ?? "GET").toUpperCase();
  const leitura = metodo === "GET" || metodo === "HEAD";
  const maximo = leitura ? (opcoes.tentativas ?? 3) : 1;
  const limite = opcoes.timeoutMs ?? (leitura ? 20_000 : 30_000);
  let ultima: FalhaDeRede | null = null;

  for (let i = 0; i < maximo; i++) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), limite);
    try {
      const res = await fetch(url, { ...init, signal: controle.signal });
      clearTimeout(relogio);
      if (leitura && [502, 503, 504].includes(res.status) && i < maximo - 1) {
        ultima = new FalhaDeRede("servidor-ocupado");
        await esperar(500 * (i + 1) ** 2);
        continue;
      }
      avisarRede(true);
      return res;
    } catch (e) {
      clearTimeout(relogio);
      const abortou = e instanceof DOMException && e.name === "AbortError";
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      ultima = new FalhaDeRede(abortou ? "demora" : offline ? "sem-conexao" : "sem-conexao");
      if (i < maximo - 1) await esperar(500 * (i + 1) ** 2);
    }
  }
  avisarRede(false, ultima?.tipo);
  throw ultima ?? new FalhaDeRede("sem-conexao");
}

// Texto para mostrar à pessoa quando uma chamada falhou por qualquer motivo.
export function textoDoErro(e: unknown, padrao: string): string {
  return e instanceof FalhaDeRede ? e.message : padrao;
}
