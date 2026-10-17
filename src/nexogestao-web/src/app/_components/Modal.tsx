"use client";

import { ReactNode, useEffect, useRef } from "react";

// Janela de formulário no padrão do celular: sobe de baixo como uma "folha" (com margem de segurança do iPhone),
// ocupa no máximo 92% da altura e rola por dentro; no computador fica centralizada.
// `protegido`: toque fora da janela NÃO fecha (evita perder um cadastro por um toque sem querer); fecha pelo ✕ ou Esc.
export default function Modal({
  titulo,
  onFechar,
  children,
  protegido = true,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  protegido?: boolean;
}) {
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    // a página de trás não rola enquanto a janela está aberta
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-900/45 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => {
        if (!protegido && e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-slate-200 bg-white shadow-xl sm:max-w-md sm:rounded-3xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <h3 className="text-lg font-bold leading-snug">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
      </div>
    </div>
  );
}
