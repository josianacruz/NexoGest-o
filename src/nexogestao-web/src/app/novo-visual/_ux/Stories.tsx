"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { criarLinkWhatsApp } from "../../../lib/whatsapp";
import { SUAVE } from "./tokens";

type Tipo = "novidade" | "promocao" | "lembrete";

export interface Story {
  id: string;
  tipo: Tipo;
  texto: string;
  criadoEm: number;
  automatico?: boolean;
}

const DURACAO_MS = 6000;
const VALIDADE_MS = 24 * 60 * 60 * 1000;

const TIPOS: Record<Tipo, { nome: string; icone: string; sugestao: string; fundo: string; anel: string }> = {
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

const chave = (empresaId: number) => `nexo_stories_${empresaId}`;

function carregar(empresaId: number): Story[] {
  try {
    const lista: Story[] = JSON.parse(localStorage.getItem(chave(empresaId)) ?? "[]");
    return lista.filter((s) => Date.now() - s.criadoEm < VALIDADE_MS);
  } catch {
    return [];
  }
}

function salvar(empresaId: number, lista: Story[]) {
  try {
    localStorage.setItem(chave(empresaId), JSON.stringify(lista));
  } catch {
    /* sem localStorage: vale só nesta visita */
  }
}

// "Stories" da tela inicial: novidades, promoções e lembretes do dia em formato de cartão vertical.
// Ficam NESTE aparelho por 24 horas (ainda não vão para o servidor); para chegar aos clientes, o botão
// "Enviar no WhatsApp" abre a conversa com o texto pronto.
export default function Stories({
  empresaId,
  resumoHoje,
  criarAberto,
  aoFecharCriar,
  aoAbrirCriar,
}: {
  empresaId: number;
  resumoHoje: string | null;
  criarAberto: boolean;
  aoFecharCriar: () => void;
  aoAbrirCriar: () => void;
}) {
  const [lista, setLista] = useState<Story[]>([]);
  const [vendo, setVendo] = useState<number | null>(null);

  useEffect(() => setLista(carregar(empresaId)), [empresaId]);

  const todos: Story[] = [
    ...(resumoHoje ? [{ id: "auto-hoje", tipo: "lembrete" as Tipo, texto: resumoHoje, criadoEm: Date.now(), automatico: true }] : []),
    ...lista,
  ];

  function publicar(tipo: Tipo, texto: string) {
    const novo: Story = { id: `${Date.now()}`, tipo, texto: texto.trim(), criadoEm: Date.now() };
    const nova = [novo, ...lista];
    setLista(nova);
    salvar(empresaId, nova);
    aoFecharCriar();
  }

  function excluir(id: string) {
    const nova = lista.filter((s) => s.id !== id);
    setLista(nova);
    salvar(empresaId, nova);
    setVendo(null);
  }

  return (
    <section aria-label="Novidades do dia">
      <ul className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        <li className="snap-start shrink-0">
          <button type="button" onClick={aoAbrirCriar} className="group flex w-20 flex-col items-center gap-2" aria-label="Criar novidade">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-dashed border-violet-300 bg-violet-50 text-3xl text-violet-700 transition group-hover:bg-violet-100 dark:border-violet-300/40 dark:bg-violet-300/10 dark:text-violet-100">
              +
            </span>
            <span className="text-xs font-semibold">Novo</span>
          </button>
        </li>
        {todos.map((s, i) => (
          <li key={s.id} className="snap-start shrink-0">
            <button type="button" onClick={() => setVendo(i)} className="flex w-20 flex-col items-center gap-2" aria-label={`Ver ${TIPOS[s.tipo].nome}`}>
              <span className={`rounded-full bg-gradient-to-tr p-[3px] ${TIPOS[s.tipo].anel}`}>
                <span className="grid h-[66px] w-[66px] place-items-center rounded-full border-2 border-white bg-white text-2xl dark:border-slate-800 dark:bg-slate-800">
                  {TIPOS[s.tipo].icone}
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{s.automatico ? "Hoje" : TIPOS[s.tipo].nome}</span>
            </button>
          </li>
        ))}
      </ul>
      {todos.length === 0 && <p className={`text-sm ${SUAVE.textoFraco}`}>Nenhuma novidade ainda. Toque em “Novo” para criar a primeira.</p>}

      {criarAberto && <CriarStory aoPublicar={publicar} aoFechar={aoFecharCriar} />}
      {vendo !== null && todos[vendo] && (
        <VerStory todos={todos} indice={vendo} aoMudar={setVendo} aoFechar={() => setVendo(null)} aoExcluir={excluir} />
      )}
    </section>
  );
}

function CriarStory({ aoPublicar, aoFechar }: { aoPublicar: (t: Tipo, texto: string) => void; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo>("novidade");
  const [texto, setTexto] = useState(TIPOS.novidade.sugestao);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  function escolher(t: Tipo) {
    // Só troca o texto se a pessoa ainda não mexeu nele.
    const aindaSugestao = Object.values(TIPOS).some((x) => x.sugestao === texto);
    setTipo(t);
    if (aindaSugestao) setTexto(TIPOS[t].sugestao);
    setTimeout(() => campo.current?.focus(), 0);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Nova novidade">
      <div className={`${SUAVE.cartao} w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-b-2xl`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nova novidade</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            ✕
          </button>
        </div>

        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-3 gap-2">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => escolher(t)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                tipo === t ? "border-violet-300 bg-violet-100 text-violet-900 ring-2 ring-violet-300 dark:border-violet-300/40 dark:bg-violet-300/20 dark:text-violet-50" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {TIPOS[t].icone}
              </span>
              {TIPOS[t].nome}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="texto-story" className={SUAVE.rotulo}>
            O que você quer contar? (até 180 letras)
          </label>
          <textarea id="texto-story" ref={campo} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 180))} rows={4} className={SUAVE.campo} />
          <p className={`mt-1 text-right text-xs ${SUAVE.textoFraco}`}>{texto.length}/180</p>
        </div>

        <button type="button" disabled={texto.trim().length < 3} onClick={() => aoPublicar(tipo, texto)} className={`${SUAVE.botaoPrimario} w-full`}>
          Publicar
        </button>
      </div>
    </div>
  );
}

function VerStory({
  todos,
  indice,
  aoMudar,
  aoFechar,
  aoExcluir,
}: {
  todos: Story[];
  indice: number;
  aoMudar: (i: number) => void;
  aoFechar: () => void;
  aoExcluir: (id: string) => void;
}) {
  const s = todos[indice];
  const [pausado, setPausado] = useState(false);
  const [copiado, setCopiado] = useState(false);

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

  const link = criarLinkWhatsApp(undefined, s.texto) ?? `https://wa.me/?text=${encodeURIComponent(s.texto)}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-3" role="dialog" aria-modal="true" aria-label={TIPOS[s.tipo].nome}>
      <div
        className={`relative flex aspect-[9/16] max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-gradient-to-b p-5 shadow-xl ${TIPOS[s.tipo].fundo}`}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
      >
        <div className="flex gap-1" aria-hidden="true">
          {todos.map((x, i) => (
            <span key={x.id} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-900/15 dark:bg-white/20">
              <span
                className={`block h-full rounded-full bg-slate-700 dark:bg-slate-100 ${i < indice ? "w-full" : i === indice ? "story-progresso" : "w-0"}`}
                style={i === indice ? { animationDuration: `${DURACAO_MS}ms`, animationPlayState: pausado ? "paused" : "running" } : undefined}
              />
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-slate-800 dark:text-slate-100">
          <span className="text-sm font-bold">
            <span aria-hidden="true">{TIPOS[s.tipo].icone}</span> {s.automatico ? "Hoje" : TIPOS[s.tipo].nome}
          </span>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-white/60 dark:bg-slate-900/40">
            ✕
          </button>
        </div>

        <div className="relative flex flex-1 items-center">
          {/* áreas de toque: metade esquerda volta, metade direita avança */}
          <button type="button" aria-label="Anterior" onClick={anterior} className="absolute inset-y-0 left-0 w-1/2" />
          <button type="button" aria-label="Próxima" onClick={proximo} className="absolute inset-y-0 right-0 w-1/2" />
          <p className="pointer-events-none text-center text-2xl font-bold leading-snug text-slate-800 dark:text-slate-100">{s.texto}</p>
        </div>

        <div className="relative z-10 space-y-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className={`${SUAVE.botaoSucesso} w-full`}>
            Enviar no WhatsApp
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(s.texto).then(() => setCopiado(true))}
              className={`${SUAVE.botaoSecundario} flex-1 !py-2`}
            >
              {copiado ? "Copiado" : "Copiar texto"}
            </button>
            {!s.automatico && (
              <button type="button" onClick={() => aoExcluir(s.id)} className={`${SUAVE.botaoSecundario} flex-1 !py-2`}>
                Excluir
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-slate-600 dark:text-slate-300">Fica neste aparelho por 24 horas.</p>
        </div>
      </div>
    </div>
  );
}
