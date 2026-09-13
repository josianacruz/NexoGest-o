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
