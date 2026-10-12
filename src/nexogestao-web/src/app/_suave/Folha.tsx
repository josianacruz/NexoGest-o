"use client";

import { useEffect, useRef } from "react";
import { SUAVE } from "./tokens";

// Janela do visual suave: sobe de baixo no celular e fica centralizada no computador.
// Fecha com o X, com Esc ou tocando fora; devolve o foco para quem abriu.
export default function Folha({
  titulo,
  subtitulo,
  aoFechar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`${SUAVE.cartao} flex max-h-[94vh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-2xl`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{titulo}</h2>
            {subtitulo && <p className={`truncate text-sm ${SUAVE.textoFraco}`}>{subtitulo}</p>}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );
}
