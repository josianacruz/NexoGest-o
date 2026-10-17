"use client";

import { useEffect, useState } from "react";
import { blobParaDataUrl } from "../../../lib/imagem";
import { useEmpresa } from "../EmpresaContext";
import type { MidiaResumo } from "../BibliotecaRapida";

export { PreviewEscalado } from "../../_comum/PreviewEscalado";

// QR Code do link, na cor chumbo e com fundo transparente (a arte coloca o fundo branco).
export function useQr(link: string) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(link, { margin: 0, width: 240, color: { dark: "#2F3036", light: "#FFFFFF" } });
        if (vivo) setQr(url);
      } catch {
        if (vivo) setQr(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [link]);
  return qr;
}

// Endereços públicos da loja (agendamento e tabela de preços), a partir do endereço em que o sistema está aberto.
export function useLinksDaLoja() {
  const { empresa } = useEmpresa();
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  return {
    agendar: empresa && origem ? `${origem}/agendar/${empresa.id}` : "",
    tabela: empresa && origem ? `${origem}/tabela/${empresa.id}` : "",
  };
}

// Foto da biblioteca → data URL (para a arte poder ser exportada sem pedir a imagem de outro endereço).
export async function fotoDaBiblioteca(api: (c: string, i?: RequestInit) => Promise<Response>, m: MidiaResumo, dataUrl?: string) {
  if (dataUrl) return dataUrl;
  const r = await api(`/midias/${m.id}/arquivo`);
  if (!r.ok) throw new Error("Não consegui carregar essa foto.");
  return blobParaDataUrl(await r.blob());
}
