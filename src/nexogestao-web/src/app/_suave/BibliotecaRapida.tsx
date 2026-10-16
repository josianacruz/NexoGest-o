"use client";

import { useEffect, useRef, useState } from "react";
import { reduzirImagem } from "../../lib/imagem";
import { useEmpresa } from "./EmpresaContext";
import { SUAVE } from "./tokens";

export interface MidiaResumo {
  id: number;
  nome: string;
  miniatura: string;
  usos?: number;
}

// "Biblioteca rápida": as últimas fotos da loja em miniaturas. Um toque reaproveita uma foto antiga;
// "Enviar foto" reduz a foto no aparelho, guarda na biblioteca e já a seleciona.
// `dataUrl` só vem quando a foto acabou de ser enviada (quem precisar da foto inteira busca em /midias/{id}/arquivo).
export default function BibliotecaRapida({
  selecionadaId,
  aoEscolher,
  limite = 12,
}: {
  selecionadaId?: number | null;
  aoEscolher: (m: MidiaResumo, dataUrl?: string) => void;
  limite?: number;
}) {
  const { empresa, api } = useEmpresa();
  const [lista, setLista] = useState<MidiaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      try {
        const r = await api(`/midias?limite=${limite}`);
        if (r.ok) setLista(await r.json());
      } finally {
        setCarregando(false);
      }
    })();
  }, [empresa?.id]);

  async function enviar(f: File) {
    setErro(null);
    setEnviando(true);
    try {
      const foto = await reduzirImagem(f);
      const r = await api("/midias", { method: "POST", body: JSON.stringify({ nome: foto.nome, dadosBase64: foto.dadosBase64, miniatura: foto.miniatura }) });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setErro(d?.mensagem ?? "Não consegui guardar a foto. Tente de novo.");
        return;
      }
      const m: MidiaResumo = await r.json();
      setLista((l) => [m, ...l.filter((x) => x.id !== m.id)].slice(0, limite));
      aoEscolher(m, foto.dataUrl);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui preparar a foto.");
    } finally {
      setEnviando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function remover(m: MidiaResumo) {
    const r = await api(`/midias/${m.id}`, { method: "DELETE" });
    if (r.ok || r.status === 404) setLista((l) => l.filter((x) => x.id !== m.id));
  }

  return (
    <div>
      <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Fotos recentes">
        <li className="shrink-0">
          <label className={`grid h-16 w-16 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 text-center text-[11px] font-semibold leading-tight text-violet-900 hover:bg-violet-100 dark:border-violet-300/40 dark:bg-violet-300/10 dark:text-violet-50 ${enviando ? "opacity-60" : ""}`}>
            {enviando ? "…" : <span>＋<br />Foto</span>}
            <input ref={arquivo} type="file" accept="image/*" className="sr-only" disabled={enviando} onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} aria-label="Enviar foto" />
          </label>
        </li>
        {lista.map((m) => (
          <li key={m.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => aoEscolher(m)}
              aria-pressed={selecionadaId === m.id}
              aria-label={`Usar foto ${m.nome || m.id}`}
              className={`block h-16 w-16 overflow-hidden rounded-2xl border-2 transition ${selecionadaId === m.id ? "border-violet-400 ring-2 ring-violet-300" : "border-transparent hover:border-violet-200"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.miniatura} alt="" className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => remover(m)}
              aria-label={`Tirar ${m.nome || "foto"} da biblioteca`}
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-[10px] text-white dark:bg-slate-200 dark:text-slate-900"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {!carregando && lista.length === 0 && !enviando && <p className={`mt-1 text-xs ${SUAVE.textoFraco}`}>Ainda não há fotos. A primeira que você enviar fica guardada aqui.</p>}
      {erro && (
        <p role="alert" className={`mt-2 rounded-2xl p-2 text-xs ${SUAVE.seloErro}`}>
          {erro}
        </p>
      )}
    </div>
  );
}
