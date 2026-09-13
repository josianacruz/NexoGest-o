"use client";

import { ReactNode } from "react";

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
  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex justify-end" onClick={onFechar}>
      <div
        className="bg-white dark:bg-neutral-900 border-l border-black/10 dark:border-white/10 shadow-lg w-full sm:max-w-md h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{titulo}</h3>
            {subtitulo && <p className="text-sm text-black/50 dark:text-white/50">{subtitulo}</p>}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-black/50 dark:text-white/50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
