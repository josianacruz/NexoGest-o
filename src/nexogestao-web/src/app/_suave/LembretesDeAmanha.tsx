"use client";

import { useEffect, useState } from "react";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import { separarNomeEslogan } from "../../lib/modulos";
import { useEmpresa } from "./EmpresaContext";
import Folha from "./Folha";
import { SELO_STATUS, SUAVE, TEXTO_STATUS, horaDoAgendamento, isoDoDia, somarDias } from "./tokens";

interface Agendamento {
  id: number;
  clienteNome: string;
  clienteTelefone: string | null;
  servicoNome: string;
  dataHora: string;
  status: string;
}

const chaveEnviado = (empresaId: number, id: number) => `nexo_lembrete_${empresaId}_${id}`;

function jaEnviado(empresaId: number, id: number) {
  try {
    return localStorage.getItem(chaveEnviado(empresaId, id)) === "1";
  } catch {
    return false;
  }
}

function marcarEnviado(empresaId: number, id: number) {
  try {
    localStorage.setItem(chaveEnviado(empresaId, id), "1");
  } catch {
    /* sem armazenamento: só não lembra que já foi avisado */
  }
}

// Lembrete de amanhã: lista quem tem horário amanhã e abre o WhatsApp com a mensagem pronta, um toque por cliente.
// Nada é enviado sozinho (sem custo): a dona toca em "Avisar" e só confirma o envio no próprio WhatsApp.
export default function LembretesDeAmanha() {
  const { empresa, api } = useEmpresa();
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [aberto, setAberto] = useState(false);
  const [avisados, setAvisados] = useState<Set<number>>(new Set());
  const temAgenda = empresa?.modulos.includes("Agenda");

  useEffect(() => {
    if (!empresa || !temAgenda) return;
    const amanha = isoDoDia(somarDias(new Date(), 1));
    (async () => {
      try {
        const r = await api(`/agendamentos?inicio=${amanha}&fim=${amanha}`);
        if (!r.ok) return;
        const dados: Agendamento[] = (await r.json()).filter((a: Agendamento) => a.status === "Agendado" || a.status === "Confirmado");
        setLista(dados);
        setAvisados(new Set(dados.filter((a) => jaEnviado(empresa.id, a.id)).map((a) => a.id)));
      } catch {
        /* o cartão só não aparece */
      }
    })();
  }, [empresa?.id]);

  if (!empresa || !temAgenda || lista.length === 0) return null;

  const nomeLoja = separarNomeEslogan(empresa.nome).nome;
  const linkAgendar = typeof window !== "undefined" ? `${window.location.origin}/agendar/${empresa.id}` : "";
  const faltam = lista.filter((a) => !avisados.has(a.id)).length;

  function mensagem(a: Agendamento) {
    const primeiro = a.clienteNome.split(" ")[0];
    return `Oi, ${primeiro}! Lembrete: amanhã às ${horaDoAgendamento(a.dataHora)} você tem ${a.servicoNome} no ${nomeLoja}. Pode confirmar pra mim? 💖\n\nPrecisa remarcar? É só escolher outro horário aqui: ${linkAgendar}`;
  }

  function avisar(a: Agendamento) {
    marcarEnviado(empresa!.id, a.id);
    setAvisados((s) => new Set(s).add(a.id));
  }

  return (
    <section aria-label="Lembretes de amanhã">
      <button type="button" onClick={() => setAberto(true)} className={`${SUAVE.cartaoClicavel} flex w-full items-center gap-3 p-4 text-left`}>
        <span className="text-2xl" aria-hidden="true">
          🔔
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Lembretes de amanhã</span>
          <span className={`block text-sm ${SUAVE.textoSuave}`}>
            {lista.length} {lista.length === 1 ? "cliente tem horário" : "clientes têm horário"} amanhã
            {faltam === 0 ? " · todas avisadas ✓" : ` · ${faltam} ${faltam === 1 ? "falta avisar" : "faltam avisar"}`}
          </span>
        </span>
        <span className={`${SUAVE.selo} ${faltam === 0 ? SUAVE.seloOk : SUAVE.seloAviso}`}>{faltam === 0 ? "Pronto" : "Avisar"}</span>
      </button>

      {aberto && (
        <Folha titulo="Lembretes de amanhã" subtitulo="Toque em Avisar: o WhatsApp abre com a mensagem pronta" aoFechar={() => setAberto(false)}>
          <ul className="grid gap-2 overflow-y-auto px-5 pb-5 pt-3">
            {lista.map((a) => {
              const link = criarLinkWhatsApp(a.clienteTelefone, mensagem(a));
              const feito = avisados.has(a.id);
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/40">
                  <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-bold text-violet-900 dark:bg-violet-300/20 dark:text-violet-50">{horaDoAgendamento(a.dataHora)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.clienteNome}</p>
                    <p className={`truncate text-sm ${SUAVE.textoSuave}`}>{a.servicoNome}</p>
                    <span className={`${SUAVE.selo} mt-1 ${SELO_STATUS[a.status] ?? SUAVE.seloNeutro}`}>{TEXTO_STATUS[a.status] ?? a.status}</span>
                  </div>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => avisar(a)} className={`${SUAVE.botaoPequeno} shrink-0 ${feito ? SUAVE.seloNeutro : SUAVE.seloOk}`}>
                      {feito ? "Avisar de novo" : "Avisar"}
                    </a>
                  ) : (
                    <span className={`${SUAVE.selo} shrink-0 ${SUAVE.seloAviso}`}>Sem WhatsApp</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Folha>
      )}
    </section>
  );
}
