"use client";

import { useEffect, useRef, useState } from "react";
import { prepararFontesDasArtes } from "../../lib/exportarArte";

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
