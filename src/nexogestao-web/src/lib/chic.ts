import { Jost, Playfair_Display } from "next/font/google";

// Identidade "Minimalista Chic" usada nas artes de divulgação do salão e nas páginas públicas dos clientes:
// fundo off-white, texto em cinza chumbo, detalhes em rosa quartzo e dourado suave.
// Os valores de texto foram escolhidos para ter contraste mínimo de 4,5:1 sobre o off-white.
export const CHIC = {
  fundo: "#FAF7F4", // off-white
  fundoRosado: "#F7DDE0", // rosa quartzo bem claro (degradê)
  quartzo: "#F2C9CD", // rosa quartzo (fundos de botões e selos)
  quartzoForte: "#E8B4BA", // rosa quartzo mais firme (botão principal)
  chumbo: "#2F3036", // texto principal
  cinza: "#66666E", // texto secundário
  douradoTexto: "#8A6A2F", // dourado escuro: legível como texto
  douradoLinha: "#C9A96E", // dourado suave: filetes e molduras
} as const;

export const fonteTitulo = Playfair_Display({ subsets: ["latin"], variable: "--font-chic-titulo", display: "swap" });
export const fonteCorpo = Jost({ subsets: ["latin"], variable: "--font-chic-corpo", display: "swap" });

export const familiaTitulo = 'var(--font-chic-titulo), Georgia, "Times New Roman", serif';
export const familiaCorpo = 'var(--font-chic-corpo), "Helvetica Neue", Arial, sans-serif';

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Endereço sem "https://" para mostrar dentro das artes (ex.: nexo.vercel.app/agendar/36).
export const linkCurto = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export interface ServicoPublico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
  permiteAutoagendamento?: boolean;
}

// Tamanho da letra do nome do salão nas artes: nomes longos encolhem para caber com folga numa linha
// (a letra do arquivo exportado pode ficar um pouco mais larga que a da tela, então nada de caber "no limite").
export function tamanhoNomeSalao(nome: string, base: number) {
  const n = nome.length;
  if (n <= 14) return base;
  if (n <= 20) return Math.round(base * 0.84 * 10) / 10;
  if (n <= 28) return Math.round(base * 0.7 * 10) / 10;
  return Math.round(base * 0.6 * 10) / 10;
}
