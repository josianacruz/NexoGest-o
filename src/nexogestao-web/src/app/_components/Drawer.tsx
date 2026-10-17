"use client";

import { ReactNode, useEffect, useRef } from "react";

// Painel lateral no computador; no celular ocupa a tela toda (cabeçalho fixo com o ✕ sempre à mão).
export default function Drawer({
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-md dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">{titulo}</h3>
            {subtitulo && <p className="truncate text-sm text-slate-600 dark:text-slate-300">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      </div>
    </div>
  );
}
