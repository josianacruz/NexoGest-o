"use client";

import { useEffect, useRef, useState } from "react";
import { prepararFontesDasArtes } from "../../../lib/exportarArte";
import { blobParaDataUrl } from "../../../lib/imagem";
import { useEmpresa } from "../EmpresaContext";
import type { MidiaResumo } from "../BibliotecaRapida";

// Mostra uma arte de largura fixa (ex.: 360 px) encolhida para caber na tela do celular, sem mudar o tamanho real
// da arte (quem exporta a imagem usa o elemento original, que continua com 360 px).
export function PreviewEscalado({ larguraArte, children }: { larguraArte: number; children: React.ReactNode }) {
  const fora = useRef<HTMLDivElement>(null);
  const dentro = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState(0);

  // Quem mostra uma arte provavelmente vai baixá-la: já prepara as fontes para a imagem sair rápido.
  useEffect(() => {
    prepararFontesDasArtes();
  }, []);

  useEffect(() => {
    const medir = () => {
      const w = fora.current?.clientWidth ?? larguraArte;
      setEscala(Math.min(1, w / larguraArte));
      setAltura(dentro.current?.offsetHeight ?? 0);
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (fora.current) ro.observe(fora.current);
    if (dentro.current) ro.observe(dentro.current);
    return () => ro.disconnect();
  }, [larguraArte]);

  return (
    <div ref={fora} className="w-full" style={{ maxWidth: larguraArte, height: altura * escala || undefined }}>
      <div ref={dentro} style={{ width: larguraArte, transform: `scale(${escala})`, transformOrigin: "top left" }} className="shadow-lg ring-1 ring-black/5">
        {children}
      </div>
    </div>
  );
}

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
