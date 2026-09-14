// Deriva um nome de exibição pra saudação a partir do e-mail de quem logou
// (não temos um campo "nome da pessoa" no backend) — 100% dinâmico, nunca
// fixo: cada usuário vê o próprio nome, tirado do token JWT já salvo no login.

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
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("nexo_token");
  if (!token) return null;

  const email = decodificarEmailDoToken(token);
  if (!email) return null;

  const parteLocal = email.split("@")[0];
  const primeiroNome = parteLocal.split(/[._-]/)[0];
  if (!primeiroNome) return null;

  return primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
}
