import type { Metadata, Viewport } from "next";
import { preconnect } from "react-dom";
import { API_URL } from "../../lib/api";
import { CHIC, familiaCorpo, fonteCorpo, fonteTitulo } from "../../lib/chic";
import AvisoDeConexao from "../_components/AvisoDeConexao";
import TravaModoClaro from "./TravaModoClaro";

// Páginas públicas dos clientes da loja (agendar, tabela de preços): visual "minimalista chic" fixo,
// feito para o celular. Largura da tela (sem zoom forçado: quem quiser ampliar continua podendo).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: CHIC.fundo,
};

export const metadata: Metadata = {
  title: "Agende seu horário",
  robots: { index: false }, // são links para enviar às clientes, não para aparecer no Google
};

// Antes de pintar qualquer coisa, tira o modo escuro (o do aparelho ou do sistema): estas páginas têm um visual próprio.
const SCRIPT_CLARO =
  "var h=document.documentElement;if(h.classList.contains('dark'))h.dataset.temaEscuro='1';h.classList.remove('dark');h.style.colorScheme='light';";

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  // Abre a conexão segura com a API enquanto a página ainda carrega: a primeira chamada já sai com a "estrada" pronta.
  preconnect(API_URL);
  return (
    <div className={`${fonteTitulo.variable} ${fonteCorpo.variable} min-h-dvh`} style={{ background: CHIC.fundo, color: CHIC.chumbo, fontFamily: familiaCorpo, colorScheme: "light" }}>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_CLARO }} />
      <TravaModoClaro />
      <AvisoDeConexao estilo="chic" />
      {children}
    </div>
  );
}
