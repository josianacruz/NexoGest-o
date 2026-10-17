// Mantém a pessoa logada em segundo plano: o access token dura pouco (ver Jwt:ExpiresInMinutes no
// backend), então qualquer chamada autenticada que volte 401 tenta renovar com o refresh token
// (de longa duração) e repete a chamada original — sem recarregar a tela e sem pedir senha de novo.
// Só quando o refresh também falha (token revogado ou expirado de verdade, ex.: semanas sem abrir o
// app) é que a sessão é encerrada e a pessoa volta pro login.
import { API_URL } from "./api";
import { CHAVE_TOKEN, CHAVE_REFRESH_TOKEN, obterRefreshToken } from "./auth";

let renovacaoEmAndamento: Promise<string | null> | null = null;
let jaRedirecionou = false;

async function renovarToken(): Promise<string | null> {
  const refreshToken = obterRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const dados = await res.json();
    localStorage.setItem(CHAVE_TOKEN, dados.token);
    localStorage.setItem(CHAVE_REFRESH_TOKEN, dados.refreshToken);
    return dados.token as string;
  } catch {
    return null;
  }
}

function obterAutorizacao(init: RequestInit | undefined): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get("Authorization");
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === "authorization")?.[1] ?? null;
  const chave = Object.keys(h).find((k) => k.toLowerCase() === "authorization");
  return chave ? (h as Record<string, string>)[chave] : null;
}

function comNovaAutorizacao(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

function sessaoExpirou(): void {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_REFRESH_TOKEN);
  if (jaRedirecionou || typeof window === "undefined") return;
  jaRedirecionou = true;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

// Chamado uma única vez (na raiz do app) para ligar a renovação automática em toda chamada à API,
// mesmo nas telas que montam o cabeçalho Authorization "na mão" em vez de usar um client central.
export function configurarRenovacaoDeSessao(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __nexoSessaoConfigurada?: boolean };
  if (w.__nexoSessaoConfigurada) return;
  w.__nexoSessaoConfigurada = true;

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    // Guarda uma cópia intacta para poder repetir a chamada depois de renovar o token — uma vez
    // consumido pelo fetch, o corpo de um Request/stream não pode ser lido de novo.
    const copiaParaRetentativa = entrada instanceof Request ? entrada.clone() : null;
    const resposta = await fetchOriginal(entrada, init);

    const url = entrada instanceof Request ? entrada.url : entrada.toString();
    const chamouAutenticado = url.startsWith(API_URL) && !url.startsWith(`${API_URL}/api/auth/`);
    const tinhaAutorizacao = entrada instanceof Request ? entrada.headers.get("Authorization") : obterAutorizacao(init);

    if (resposta.status !== 401 || !chamouAutenticado || !tinhaAutorizacao) {
      return resposta;
    }

    if (!renovacaoEmAndamento) {
      renovacaoEmAndamento = renovarToken().finally(() => {
        renovacaoEmAndamento = null;
      });
    }
    const novoToken = await renovacaoEmAndamento;

    if (!novoToken) {
      sessaoExpirou();
      return resposta;
    }

    if (copiaParaRetentativa) {
      copiaParaRetentativa.headers.set("Authorization", `Bearer ${novoToken}`);
      return fetchOriginal(copiaParaRetentativa);
    }
    return fetchOriginal(entrada, comNovaAutorizacao(init, novoToken));
  };
}
