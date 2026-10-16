"use client";

import { useCallback, useEffect, useState } from "react";

// Parte visual dos Stories, compartilhada pela tela do Dono e pela página pública dos clientes.
// Não depende de empresa nem de login: recebe os dados e os botões de rodapé prontos.

export type Tipo = "novidade" | "promocao" | "lembrete";

export interface StoryVista {
  id: string;
  tipo: Tipo;
  texto: string;
  automatico?: boolean;
  imagemUrl?: string; // foto da novidade (opcional)
}

export const DURACAO_MS = 6000;

export const TIPOS: Record<Tipo, { nome: string; icone: string; sugestao: string; fundo: string; anel: string }> = {
  novidade: {
    nome: "Novidade",
    icone: "✨",
    sugestao: "Novidade chegando! Conta aqui o que mudou na loja.",
    fundo: "from-sky-100 to-violet-100 dark:from-sky-900/60 dark:to-violet-900/60",
    anel: "from-sky-300 to-violet-300",
  },
  promocao: {
    nome: "Promoção",
    icone: "🏷️",
    sugestao: "Promoção de hoje: escreva o que está com preço especial e até quando vale.",
    fundo: "from-amber-100 to-rose-100 dark:from-amber-900/50 dark:to-rose-900/50",
    anel: "from-amber-300 to-rose-300",
  },
  lembrete: {
    nome: "Lembrete",
    icone: "🔔",
    sugestao: "Lembrete: amanhã estamos com horários livres. Chame para agendar!",
    fundo: "from-emerald-100 to-sky-100 dark:from-emerald-900/50 dark:to-sky-900/50",
    anel: "from-emerald-300 to-sky-300",
  },
};

// A API devolve o nome do tipo ("Novidade", "Promocao", "Lembrete"); aqui vira a chave em minúsculas.
export function tipoDaApi(valor: string): Tipo {
  const t = valor.toLowerCase();
  return t === "promocao" || t === "lembrete" ? t : "novidade";
}

export function Anel({ s, aoAbrir }: { s: StoryVista; aoAbrir: () => void }) {
  return (
    <button type="button" onClick={aoAbrir} className="flex w-20 flex-col items-center gap-2" aria-label={`Ver ${TIPOS[s.tipo].nome}`}>
      <span className={`rounded-full bg-gradient-to-tr p-[3px] ${TIPOS[s.tipo].anel}`}>
        <span className="grid h-[66px] w-[66px] place-items-center overflow-hidden rounded-full border-2 border-white bg-white text-2xl dark:border-slate-800 dark:bg-slate-800">
          {s.imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imagemUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            TIPOS[s.tipo].icone
          )}
        </span>
      </span>
      <span className="w-full truncate text-center text-xs font-semibold">{s.automatico ? "Hoje" : TIPOS[s.tipo].nome}</span>
    </button>
  );
}

// Visualizador em tela cheia: barras de progresso, avança sozinho, toque na metade direita/esquerda muda.
export function VerStory({
  todos,
  indice,
  aoMudar,
  aoFechar,
  rodape,
}: {
  todos: StoryVista[];
  indice: number;
  aoMudar: (i: number) => void;
  aoFechar: () => void;
  rodape: (s: StoryVista) => React.ReactNode;
}) {
  const s = todos[indice];
  const foto = !!s.imagemUrl;
  const [pausado, setPausado] = useState(false);

  const proximo = useCallback(() => (indice + 1 < todos.length ? aoMudar(indice + 1) : aoFechar()), [indice, todos.length, aoMudar, aoFechar]);
  const anterior = () => indice > 0 && aoMudar(indice - 1);

  // Avança sozinho a cada 6 s; segurar/passar o mouse pausa.
  useEffect(() => {
    if (pausado) return;
    const t = setTimeout(proximo, DURACAO_MS);
    return () => clearTimeout(t);
  }, [indice, pausado, proximo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") proximo();
      if (e.key === "ArrowLeft") anterior();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-3" role="dialog" aria-modal="true" aria-label={TIPOS[s.tipo].nome}>
      <div
        className={`relative flex aspect-[9/16] max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-gradient-to-b p-5 shadow-xl ${TIPOS[s.tipo].fundo}`}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
      >
        {foto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/45 via-slate-900/25 to-slate-900/80" aria-hidden="true" />
          </>
        )}
        <div className="relative flex gap-1" aria-hidden="true">
          {todos.map((x, i) => (
            <span key={x.id} className={`h-1 flex-1 overflow-hidden rounded-full ${foto ? "bg-white/30" : "bg-slate-900/15 dark:bg-white/20"}`}>
              <span
                className={`block h-full rounded-full ${foto ? "bg-white" : "bg-slate-700 dark:bg-slate-100"} ${i < indice ? "w-full" : i === indice ? "story-progresso" : "w-0"}`}
                style={i === indice ? { animationDuration: `${DURACAO_MS}ms`, animationPlayState: pausado ? "paused" : "running" } : undefined}
              />
            </span>
          ))}
        </div>

        <div className={`relative mt-4 flex items-center justify-between ${foto ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>
          <span className="text-sm font-bold">
            <span aria-hidden="true">{TIPOS[s.tipo].icone}</span> {s.automatico ? "Hoje" : TIPOS[s.tipo].nome}
          </span>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className={`grid h-9 w-9 place-items-center rounded-full ${foto ? "bg-slate-900/50 text-white" : "bg-white/60 dark:bg-slate-900/40"}`}>
            ✕
          </button>
        </div>

        <div className="relative flex flex-1 items-center">
          {/* áreas de toque: metade esquerda volta, metade direita avança */}
          <button type="button" aria-label="Anterior" onClick={anterior} className="absolute inset-y-0 left-0 w-1/2" />
          <button type="button" aria-label="Próxima" onClick={proximo} className="absolute inset-y-0 right-0 w-1/2" />
          <p className={`pointer-events-none w-full break-words text-center text-2xl font-bold leading-snug ${foto ? "text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]" : "text-slate-800 dark:text-slate-100"}`}>{s.texto}</p>
        </div>

        <div className="relative z-10 space-y-2">{rodape(s)}</div>
      </div>
    </div>
  );
}
