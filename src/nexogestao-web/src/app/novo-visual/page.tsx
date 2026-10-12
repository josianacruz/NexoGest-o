"use client";

import { useState } from "react";
import Link from "next/link";
import AgendamentoRapido, { type ClienteResumo } from "./_ux/AgendamentoRapido";
import AgendaDia from "./_ux/AgendaDia";
import ClientesSuave from "./_ux/ClientesSuave";
import { useEmpresa } from "./_ux/EmpresaContext";
import Stories from "./_ux/Stories";
import { SUAVE } from "./_ux/tokens";

// Início do novo visual: novidades (Stories), atalhos grandes, agenda em cartões e clientes.
export default function NovoVisualInicio() {
  const { empresa } = useEmpresa();
  const [modal, setModal] = useState(false);
  const [cliente, setCliente] = useState<ClienteResumo | null>(null);
  const [horario, setHorario] = useState<{ dia: string; hora: string } | null>(null);
  const [criarStory, setCriarStory] = useState(false);
  const [atualizar, setAtualizar] = useState(0);
  const [resumo, setResumo] = useState<string | null>(null);

  if (!empresa) return null;

  function abrirAgendamento(c: ClienteResumo | null = null, h: { dia: string; hora: string } | null = null) {
    setCliente(c);
    setHorario(h);
    setModal(true);
  }

  const dataBruta = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dataHoje = dataBruta.charAt(0).toUpperCase() + dataBruta.slice(1);
  const temAgenda = empresa.modulos.includes("Agenda");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oi! 👋</h1>
        <p className={`text-sm ${SUAVE.textoSuave}`}>{dataHoje}</p>
      </div>

      <Stories
        empresaId={empresa.id}
        resumoHoje={resumo}
        criarAberto={criarStory}
        aoAbrirCriar={() => setCriarStory(true)}
        aoFecharCriar={() => setCriarStory(false)}
      />

      <section aria-label="Atalhos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {temAgenda && (
          <button type="button" onClick={() => abrirAgendamento()} className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 bg-violet-50 p-4 text-left dark:bg-violet-300/10`}>
            <span className="text-2xl" aria-hidden="true">
              📅
            </span>
            <span className="font-semibold">Agendar agora</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>2 toques</span>
          </button>
        )}
        <button type="button" onClick={() => setCriarStory(true)} className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4 text-left`}>
          <span className="text-2xl" aria-hidden="true">
            ✨
          </span>
          <span className="font-semibold">Enviar novidade</span>
          <span className={`text-xs ${SUAVE.textoFraco}`}>2 toques</span>
        </button>
        {empresa.modulos.includes("Vendas") && (
          <Link href="/vendas" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4`}>
            <span className="text-2xl" aria-hidden="true">
              🛍️
            </span>
            <span className="font-semibold">Nova venda</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>Abre as vendas</span>
          </Link>
        )}
        {empresa.modulos.includes("Cobrancas") && (
          <Link href="/cobrancas" className={`${SUAVE.cartaoClicavel} flex flex-col items-start gap-2 p-4`}>
            <span className="text-2xl" aria-hidden="true">
              💰
            </span>
            <span className="font-semibold">Cobranças</span>
            <span className={`text-xs ${SUAVE.textoFraco}`}>Quem deve</span>
          </Link>
        )}
      </section>

      <AgendaDia atualizar={atualizar} aoAgendar={(dia, hora) => abrirAgendamento(null, { dia, hora })} aoCarregarHoje={(total, proximo) => setResumo(total === 0 ? "Hoje a agenda está livre. Que tal chamar clientes para marcar?" : `Hoje você tem ${total} ${total === 1 ? "atendimento" : "atendimentos"}${proximo ? `. O próximo é às ${proximo}.` : "."}`)} />

      <ClientesSuave atualizar={atualizar} aoAgendar={(c) => abrirAgendamento(c)} />

      <p className={`rounded-2xl border border-dashed border-slate-300 p-4 text-xs dark:border-slate-600 ${SUAVE.textoFraco}`}>
        Esta é uma pré-visualização do novo visual. As outras telas (vendas, produtos, relatórios…) continuam no visual atual e abrem normalmente pelo menu.
      </p>

      <AgendamentoRapido
        aberto={modal}
        aoFechar={() => setModal(false)}
        aoCriar={() => setAtualizar((n) => n + 1)}
        clienteInicial={cliente}
        horarioInicial={horario}
      />
    </div>
  );
}
