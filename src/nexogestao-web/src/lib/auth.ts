// Deriva um nome de exibição pra saudação a partir do e-mail de quem logou
// (não temos um campo "nome da pessoa" no backend) — 100% dinâmico, nunca
// fixo: cada usuário vê o próprio nome, tirado do token JWT já salvo no login.

import { API_URL } from "./api";

export const CHAVE_TOKEN = "nexo_token";
export const CHAVE_REFRESH_TOKEN = "nexo_refresh_token";

export function obterToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAVE_TOKEN);
}

export function obterRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAVE_REFRESH_TOKEN);
}

// Chamado só no login: o access token dura pouco (ver Jwt:ExpiresInMinutes), o refresh token é o que
// mantém a sessão viva por semanas sem pedir email/senha de novo (ver configurarRenovacaoDeSessao).
export function salvarSessao(token: string, refreshToken: string): void {
  localStorage.setItem(CHAVE_TOKEN, token);
  localStorage.setItem(CHAVE_REFRESH_TOKEN, refreshToken);
}

// Encerramento explícito ("Sair"): revoga o refresh token no servidor (melhor esforço — se a rede
// falhar, a sessão local é limpa do mesmo jeito) e limpa os dois tokens deste aparelho.
export function encerrarSessao(): void {
  const refreshToken = obterRefreshToken();
  if (refreshToken) {
    fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      /* sessão local é limpa mesmo se o servidor não responder */
    });
  }
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_REFRESH_TOKEN);
}

function decodificarEmailDoToken(token: string): string | null {
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = decodeURIComponent(
      atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(payloadJson);
    return payload.email ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ?? null;
  } catch {
    return null;
  }
}

export function obterNomeDoUsuario(): string | null {
  const token = obterToken();
  if (!token) return null;

  const email = decodificarEmailDoToken(token);
  if (!email) return null;

  const parteLocal = email.split("@")[0];
  const primeiroNome = parteLocal.split(/[._-]/)[0];
  if (!primeiroNome) return null;

  return primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
}
