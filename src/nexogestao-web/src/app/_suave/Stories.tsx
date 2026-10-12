"use client";

import { useEffect, useRef, useState } from "react";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import { useEmpresa } from "./EmpresaContext";
import { Anel, TIPOS, VerStory, tipoDaApi, type StoryVista, type Tipo } from "./StoriesVisual";
import { SUAVE } from "./tokens";

interface StoryApi {
  id: number;
  tipo: string;
  texto: string;
}

// "Stories" da tela inicial: novidades, promoções e lembretes em formato de cartão vertical.
// Ficam no servidor por 24 horas e aparecem para os clientes na página pública de agendamento (/agendar/<loja>).
// Só o Dono publica e apaga; os outros membros apenas veem.
export default function Stories({
  resumoHoje,
  criarAberto,
  aoFecharCriar,
  aoAbrirCriar,
}: {
  resumoHoje: string | null;
  criarAberto: boolean;
  aoFecharCriar: () => void;
  aoAbrirCriar: () => void;
}) {
  const { empresa, api } = useEmpresa();
  const [lista, setLista] = useState<StoryVista[]>([]);
  const [vendo, setVendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const ehDono = empresa?.papel === "Dono";
  const link = empresa && typeof window !== "undefined" ? `${window.location.origin}/agendar/${empresa.id}` : "";

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      const r = await api("/stories");
      if (r.ok) setLista(((await r.json()) as StoryApi[]).map((s) => ({ id: String(s.id), tipo: tipoDaApi(s.tipo), texto: s.texto })));
    })();
  }, [empresa?.id]);

  const todos: StoryVista[] = [...(resumoHoje ? [{ id: "auto-hoje", tipo: "lembrete" as Tipo, texto: resumoHoje, automatico: true }] : []), ...lista];

  // Devolve a mensagem de erro (para o formulário mostrar) ou null quando publicou.
  async function publicar(tipo: Tipo, texto: string): Promise<string | null> {
    const r = await api("/stories", { method: "POST", body: JSON.stringify({ tipo, texto: texto.trim() }) });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      return r.status === 403 ? "Só o Dono da loja pode publicar novidades." : (d?.mensagem ?? "Não consegui publicar. Tente de novo.");
    }
    const s = (await r.json()) as StoryApi;
    setLista((l) => [{ id: String(s.id), tipo: tipoDaApi(s.tipo), texto: s.texto }, ...l]);
    setAviso("Publicado! ✅ Seus clientes veem na página de agendamento por 24 horas.");
    aoFecharCriar();
    return null;
  }

  async function excluir(id: string) {
    const r = await api(`/stories/${id}`, { method: "DELETE" });
    if (r.ok || r.status === 404) {
      setLista((l) => l.filter((s) => s.id !== id));
      setVendo(null);
    }
  }

  return (
    <section aria-label="Novidades do dia">
      <ul className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {ehDono && (
          <li className="snap-start shrink-0">
            <button type="button" onClick={aoAbrirCriar} className="group flex w-20 flex-col items-center gap-2" aria-label="Criar novidade">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-dashed border-violet-300 bg-violet-50 text-3xl text-violet-700 transition group-hover:bg-violet-100 dark:border-violet-300/40 dark:bg-violet-300/10 dark:text-violet-100">+</span>
              <span className="text-xs font-semibold">Novo</span>
            </button>
          </li>
        )}
        {todos.map((s, i) => (
          <li key={s.id} className="snap-start shrink-0">
            <Anel s={s} aoAbrir={() => setVendo(i)} />
          </li>
        ))}
      </ul>
      {todos.length === 0 && <p className={`text-sm ${SUAVE.textoFraco}`}>{ehDono ? "Nenhuma novidade no ar. Toque em “Novo” para criar a primeira." : "Nenhuma novidade no ar."}</p>}

      {aviso && (
        <div role="status" className={`mt-3 flex flex-wrap items-center gap-2 rounded-2xl p-3 text-sm ${SUAVE.seloOk}`}>
          <span className="flex-1">{aviso}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(link).then(() => setCopiado(true))}
            className={`${SUAVE.botaoPequeno} bg-white/70 text-emerald-900 dark:bg-slate-900/40 dark:text-emerald-100`}
          >
            {copiado ? "Link copiado" : "Copiar link para os clientes"}
          </button>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="px-1">
            ✕
          </button>
        </div>
      )}

      {criarAberto && <CriarStory aoPublicar={publicar} aoFechar={aoFecharCriar} />}
      {vendo !== null && todos[vendo] && (
        <VerStory
          todos={todos}
          indice={vendo}
          aoMudar={setVendo}
          aoFechar={() => setVendo(null)}
          rodape={(s) => (
            <>
              <a href={criarLinkWhatsApp(undefined, `${s.texto}\n\nVeja mais: ${link}`) ?? `https://wa.me/?text=${encodeURIComponent(`${s.texto}\n\nVeja mais: ${link}`)}`} target="_blank" rel="noopener noreferrer" className={`${SUAVE.botaoSucesso} w-full`}>
                Enviar no WhatsApp
              </a>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigator.clipboard?.writeText(s.texto)} className={`${SUAVE.botaoSecundario} flex-1 !py-2`}>
                  Copiar texto
                </button>
                {!s.automatico && ehDono && (
                  <button type="button" onClick={() => excluir(s.id)} className={`${SUAVE.botaoSecundario} flex-1 !py-2`}>
                    Apagar
                  </button>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-600 dark:text-slate-300">{s.automatico ? "Resumo só para você, não aparece para os clientes." : "No ar para os clientes por 24 horas."}</p>
            </>
          )}
        />
      )}
    </section>
  );
}

function CriarStory({ aoPublicar, aoFechar }: { aoPublicar: (t: Tipo, texto: string) => Promise<string | null>; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo>("novidade");
  const [texto, setTexto] = useState(TIPOS.novidade.sugestao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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

  async function publicar() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const e = await aoPublicar(tipo, texto);
      if (e) setErro(e);
    } finally {
      setEnviando(false);
    }
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

        <p className={`text-xs ${SUAVE.textoSuave}`}>👀 Seus clientes veem esta novidade na página de agendamento por 24 horas. Não coloque dados pessoais.</p>

        {erro && (
          <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
            {erro}
          </p>
        )}

        <button type="button" disabled={texto.trim().length < 3 || enviando} onClick={publicar} className={`${SUAVE.botaoPrimario} w-full`}>
          {enviando ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}
