"use client";

import { ReactNode } from "react";

export default function Modal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-30 p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl p-5 w-full max-w-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-4">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
