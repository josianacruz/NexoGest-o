"use client";

import { ReactNode } from "react";

export default function PageHeader({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      {acao}
    </div>
  );
}
