"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obterNomeDoUsuario } from "../../../lib/auth";
import AgendamentoRapido, { type ClienteResumo } from "../../_suave/AgendamentoRapido";
import AgendaDia from "../../_suave/AgendaDia";
import ClientesSuave from "../../_suave/ClientesSuave";
import { useEmpresa } from "../../_suave/EmpresaContext";
import Stories from "../../_suave/Stories";
import { SUAVE, brl } from "../../_suave/tokens";

// Início: novidades (Stories), atalhos grandes, agenda do dia em cartões e clientes.
export default function InicioPage() {
  const { empresa, api } = useEmpresa();
  const [modal, setModal] = useState(false);
  const [cliente, setCliente] = useState<ClienteResumo | null>(null);
  const [horario, setHorario] = useState<{ dia: string; hora: string } | null>(null);
  const [criarStory, setCriarStory] = useState(false);
  const [atualizar, setAtualizar] = useState(0);
  const [resumo, setResumo] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [interessesNovos, setInteressesNovos] = useState(0);
  const [aReceber, setAReceber] = useState(0);

  useEffect(() => setNomeUsuario(obterNomeDoUsuario()), []);

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      if (empresa.modulos.includes("Interesses")) {
        const r = await api("/interesses?status=Novo");
        if (r.ok) setInteressesNovos((await r.json()).length ?? 0);
      }
      if (empresa.modulos.includes("Cobrancas")) {
        const r = await api("/contas-receber/resumo");
        if (r.ok) setAReceber((await r.json()).aReceber ?? 0);
      }
    })();
  }, [empresa?.id]);

  if (!empresa) return null;

  function abrirAgendamento(c: ClienteResumo | null = null, h: { dia: string; hora: string } | null = null) {
    setCliente(c);
    setHorario(h);
    setModal(true);
  }

  const dataBruta = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dataHoje = dataBruta.charAt(0).toUpperCase() + dataBruta.slice(1);
  const tem = (m: string) => empresa.modulos.includes(m);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oi{nomeUsuario ? `, ${nomeUsuario}` : ""}! 👋</h1>
        <p className={`text-sm ${SUAVE.textoSuave}`}>{dataHoje}</p>
      </div>

      <Stories resumoHoje={resumo} criarAberto={criarStory} aoAbrirCriar={() => setCriarStory(true)} aoFecharCriar={() => setCriarStory(false)} />

      <section aria-label="Atalhos" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tem("Agenda") && (
          <button type="button" onClick={() => abrirAgendamento()} className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 bg-violet-50 p-4 text-left dark:bg-violet-300/10`}>
            <span className="text-2xl" aria-hidden="true">
              📅
            </span>
            <span className="font-semibold">Agendar agora</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>2 toques</span>
          </button>
        )}
        {empresa.papel === "Dono" && (
          <button type="button" onClick={() => setCriarStory(true)} className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4 text-left`}>
            <span className="text-2xl" aria-hidden="true">
              ✨
            </span>
            <span className="font-semibold">Enviar novidade</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>Os clientes veem</span>
          </button>
        )}
        {tem("Interesses") && (
          <Link href="/interesses" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4 ${interessesNovos > 0 ? "ring-2 ring-violet-300 dark:ring-violet-300/40" : ""}`}>
            <span className="text-2xl" aria-hidden="true">
              💎
            </span>
            <span className="font-semibold">Interesses</span>
            <span className={`text-xs ${interessesNovos > 0 ? "font-semibold text-violet-800 dark:text-violet-200" : SUAVE.textoFraco}`}>
              {interessesNovos > 0 ? `${interessesNovos} ${interessesNovos === 1 ? "pessoa esperando" : "pessoas esperando"}` : "Quem já mostrou interesse"}
            </span>
          </Link>
        )}
        {tem("Vendas") && (
          <Link href="/vendas?nova=1" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4`}>
            <span className="text-2xl" aria-hidden="true">
              🛍️
            </span>
            <span className="font-semibold">Nova venda</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>Vender direto</span>
          </Link>
        )}
        {tem("Produtos") && (
          <Link href="/produtos" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4`}>
            <span className="text-2xl" aria-hidden="true">
              📸
            </span>
            <span className="font-semibold">Divulgar uma peça</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>Criar o Story do produto</span>
          </Link>
        )}
        {tem("Cobrancas") && (
          <Link href="/cobrancas" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4`}>
            <span className="text-2xl" aria-hidden="true">
              💰
            </span>
            <span className="font-semibold">Cobranças</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>{aReceber > 0 ? `${brl(aReceber)} a receber` : "Quem deve"}</span>
          </Link>
        )}
      </section>

      <AgendaDia atualizar={atualizar} aoAgendar={(dia, hora) => abrirAgendamento(null, { dia, hora })} aoCarregarHoje={(total, proximo) => setResumo(total === 0 ? "Hoje a agenda está livre. Que tal chamar clientes para marcar?" : `Hoje você tem ${total} ${total === 1 ? "atendimento" : "atendimentos"}${proximo ? `. O próximo é às ${proximo}.` : "."}`)} />

      <ClientesSuave atualizar={atualizar} aoAgendar={(c) => abrirAgendamento(c)} />

      <AgendamentoRapido aberto={modal} aoFechar={() => setModal(false)} aoCriar={() => setAtualizar((n) => n + 1)} clienteInicial={cliente} horarioInicial={horario} />
    </main>
  );
}
