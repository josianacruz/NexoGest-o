"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CHAVE_TEMA, EVENTO_TEMA, aplicarTema, definirTema, temaAplicado, temaInicial, temaSalvo, type Tema } from "../../lib/tema";

function assinar(aviso: () => void) {
  const sistema = window.matchMedia("(prefers-color-scheme: dark)");
  // Sem escolha salva, acompanha mudanças do aparelho; com escolha salva, ignora.
  const aoMudarSistema = () => {
    if (!temaSalvo()) aplicarTema(temaInicial());
  };
  // Outra aba mudou o tema: aplica aqui também.
  const aoMudarArmazenamento = (e: StorageEvent) => {
    if (e.key === CHAVE_TEMA) aplicarTema(temaInicial());
  };
  window.addEventListener(EVENTO_TEMA, aviso);
  window.addEventListener("storage", aoMudarArmazenamento);
  sistema.addEventListener("change", aoMudarSistema);
  return () => {
    window.removeEventListener(EVENTO_TEMA, aviso);
    window.removeEventListener("storage", aoMudarArmazenamento);
    sistema.removeEventListener("change", aoMudarSistema);
  };
}

export function useTema(): Tema {
  return useSyncExternalStore(assinar, temaAplicado, () => "claro" as Tema);
}

function Sol() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function Lua() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// Seletor de aparência: dois botões (Claro / Escuro) com ícone e texto. Troca na hora, sem recarregar.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const tema = useTema();

  // Se outra parte do sistema mudar a classe sem passar por aqui, o estado se resincroniza ao montar.
  useEffect(() => {
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }, []);

  const base =
    "h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
  // O botão ativo é pintado pelo próprio CSS (variante dark:), então acerta de primeira, sem esperar o React
  // hidratar e sem piscar o botão errado.
  const claro = "bg-indigo-600 text-white dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10";
  const escuro = "text-black/70 hover:bg-black/5 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-600";

  return (
    <div
      role="group"
      aria-label="Aparência do sistema"
      className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-black/15 dark:border-white/15 ${className}`}
    >
      <button type="button" aria-pressed={tema === "claro"} onClick={() => definirTema("claro")} className={`${base} ${claro}`}>
        <Sol />
        <span>Claro</span>
      </button>
      <button type="button" aria-pressed={tema === "escuro"} onClick={() => definirTema("escuro")} className={`${base} ${escuro}`}>
        <Lua />
        <span>Escuro</span>
      </button>
    </div>
  );
}
