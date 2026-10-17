"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import type { ClienteResumo } from "./AgendamentoRapido";
import { useEmpresa } from "./EmpresaContext";
import { SUAVE, brl } from "./tokens";

interface Cliente extends ClienteResumo {
  totalPendente: number;
  totalVencido: number;
}

// Clientes em cartões: nome, situação financeira em selo suave e dois botões grandes (Agendar e WhatsApp).
export default function ClientesSuave({ atualizar, aoAgendar }: { atualizar: number; aoAgendar: (c: ClienteResumo) => void }) {
  const { empresa, api } = useEmpresa();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    if (!empresa?.modulos.includes("Clientes")) return;
    (async () => {
      const r = await api("/clientes");
      setClientes(r.ok ? await r.json() : []);
      setCarregando(false);
    })();
  }, [empresa?.id, atualizar, recarregar]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (t ? clientes.filter((c) => c.nome.toLowerCase().includes(t) || (c.telefone ?? "").includes(t)) : clientes).slice(0, 6);
  }, [clientes, busca]);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2 || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await api("/clientes", { method: "POST", body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim() || null, email: null }) });
      if (!r.ok) {
        setErro("Não consegui cadastrar. Confira o nome e o celular.");
        return;
      }
      const criado = await r.json();
      setNome("");
      setTelefone("");
      setNovo(false);
      setRecarregar((n) => n + 1);
      aoAgendar({ id: criado.id, nome: criado.nome ?? nome.trim(), telefone: telefone.trim() || null });
    } finally {
      setSalvando(false);
    }
  }

  if (!empresa?.modulos.includes("Clientes")) return null;

  return (
    <section aria-label="Clientes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Clientes</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setNovo((v) => !v)} className={`${SUAVE.botaoSecundario} !px-4 !py-2 min-h-11`}>
            {novo ? "Cancelar" : "+ Novo cliente"}
          </button>
          <Link href="/clientes" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-violet-700 underline dark:text-violet-200">
            Ver todos
          </Link>
        </div>
      </div>

      {novo && (
        <form onSubmit={cadastrar} className={`${SUAVE.cartao} mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]`}>
          <div>
            <label htmlFor="novo-nome" className={SUAVE.rotulo}>
              Nome
            </label>
            <input id="novo-nome" className={SUAVE.campo} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Maria Souza" />
          </div>
          <div>
            <label htmlFor="novo-tel" className={SUAVE.rotulo}>
              Celular (opcional)
            </label>
            <input id="novo-tel" className={SUAVE.campo} inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="11 98765-4321" />
          </div>
          <button type="submit" disabled={nome.trim().length < 2 || salvando} className={`${SUAVE.botaoPrimario} self-end`}>
            {salvando ? "Salvando…" : "Salvar e agendar"}
          </button>
          {erro && (
            <p role="alert" className={`rounded-2xl p-3 text-sm sm:col-span-3 ${SUAVE.seloErro}`}>
              {erro}
            </p>
          )}
        </form>
      )}

      <input className={`${SUAVE.campo} mb-4`} placeholder="Buscar cliente pelo nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />

      {carregando ? (
        <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className={`${SUAVE.cartao} p-5 text-sm ${SUAVE.textoSuave}`}>{busca ? "Ninguém com esse nome." : "Nenhum cliente ainda. Toque em “+ Novo cliente”."}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtrados.map((c) => {
            const wa = criarLinkWhatsApp(c.telefone, `Oi, ${c.nome.split(" ")[0]}! Tudo bem? 😊`);
            return (
              <li key={c.id} className={`${SUAVE.cartaoClicavel} flex flex-col gap-3 p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nome}</p>
                    <p className={`truncate text-sm ${SUAVE.textoFraco}`}>{c.telefone ?? "Sem telefone"}</p>
                  </div>
                  {c.totalVencido > 0 ? (
                    <span className={`${SUAVE.selo} ${SUAVE.seloErro}`}>Vencido {brl(c.totalVencido)}</span>
                  ) : c.totalPendente > 0 ? (
                    <span className={`${SUAVE.selo} ${SUAVE.seloAviso}`}>A receber {brl(c.totalPendente)}</span>
                  ) : (
                    <span className={`${SUAVE.selo} ${SUAVE.seloOk}`}>Em dia</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => aoAgendar({ id: c.id, nome: c.nome, telefone: c.telefone })} className={`${SUAVE.botaoPrimario} flex-1 !py-2.5`}>
                    Agendar
                  </button>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={`${SUAVE.botaoSucesso} flex-1 !py-2.5`}>
                      WhatsApp
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
