"use client";

import { useEffect, useMemo, useState } from "react";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import { useEmpresa } from "./EmpresaContext";
import { SELO_STATUS, SUAVE, TEXTO_STATUS, brl, gerarHorarios, horaDoAgendamento, horarioOcupado, isoDoDia, pad, rotuloDoDia, somarDias } from "./tokens";

interface Agendamento {
  id: number;
  clienteNome: string;
  clienteTelefone: string | null;
  servicoNome: string;
  dataHora: string;
  duracaoMinutos: number;
  valor: number;
  status: string;
}

// Agenda em cartões, um dia por vez: cada compromisso é um cartão com a hora em destaque, e cada horário livre
// é um cartão pontilhado que, ao ser tocado, já abre o agendamento rápido naquele horário.
export default function AgendaDia({
  atualizar,
  aoAgendar,
  aoCarregarHoje,
}: {
  atualizar: number;
  aoAgendar: (dia: string, hora: string) => void;
  aoCarregarHoje: (total: number, proximo: string | null) => void;
}) {
  const { empresa, api } = useEmpresa();
  const hoje = isoDoDia(new Date());
  const dias = useMemo(() => [0, 1, 2, 3, 4].map((n) => isoDoDia(somarDias(new Date(), n))), []);
  const [dia, setDia] = useState(hoje);
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [expediente, setExpediente] = useState({ inicio: "08:00", fim: "18:00" });
  const [carregando, setCarregando] = useState(true);
  const temAgenda = empresa?.modulos.includes("Agenda");

  useEffect(() => {
    if (!empresa || !temAgenda) return;
    (async () => {
      const r = await api("/agenda/configuracao");
      if (r.ok) {
        const c = await r.json();
        setExpediente({ inicio: c.horaInicioAtendimento ?? "08:00", fim: c.horaFimAtendimento ?? "18:00" });
      }
    })();
  }, [empresa?.id]);

  useEffect(() => {
    if (!empresa || !temAgenda) return;
    setCarregando(true);
    (async () => {
      const r = await api(`/agendamentos?inicio=${dia}&fim=${dia}`);
      const dados: Agendamento[] = r.ok ? await r.json() : [];
      setLista(dados);
      setCarregando(false);
      if (dia === hoje) {
        const ativos = dados.filter((a) => a.status !== "Cancelado");
        const agora = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
        const prox = ativos.find((a) => horaDoAgendamento(a.dataHora) >= agora);
        aoCarregarHoje(ativos.length, prox ? `${horaDoAgendamento(prox.dataHora)} ${prox.clienteNome}` : null);
      }
    })();
  }, [empresa?.id, dia, atualizar]);

  const itens = useMemo(() => {
    const agora = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
    const ativos = lista.filter((a) => a.status !== "Cancelado");
    const marcados = lista.map((a) => ({ hora: horaDoAgendamento(a.dataHora), tipo: "agendamento" as const, a }));
    const livres = gerarHorarios(expediente.inicio, expediente.fim, 60)
      .filter((h) => !(dia === hoje && h <= agora) && !horarioOcupado(h, 60, ativos))
      .map((h) => ({ hora: h, tipo: "livre" as const, a: null }));
    return [...marcados, ...livres].sort((x, y) => x.hora.localeCompare(y.hora));
  }, [lista, expediente, dia, hoje]);

  if (!temAgenda) return null;

  return (
    <section aria-label="Agenda">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Agenda</h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dia">
          {dias.map((d) => (
            <button key={d} type="button" role="tab" aria-selected={dia === d} onClick={() => setDia(d)} className={dia === d ? SUAVE.chipAtivo : SUAVE.chip}>
              {rotuloDoDia(d, hoje)}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p className={`${SUAVE.cartao} p-5 text-sm ${SUAVE.textoSuave}`}>Nada marcado e nenhum horário livre {dia === hoje ? "pelo resto de hoje" : "nesse dia"}.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {itens.map((it, i) =>
            it.tipo === "agendamento" && it.a ? (
              <li key={`a${it.a.id}`} className={`${SUAVE.cartaoClicavel} flex items-center gap-3 p-4`}>
                <span className="grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-violet-100 text-base font-bold text-violet-900 dark:bg-violet-300/20 dark:text-violet-50">{it.hora}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{it.a.clienteNome}</p>
                  <p className={`truncate text-sm ${SUAVE.textoSuave}`}>
                    {it.a.servicoNome} · {it.a.duracaoMinutos} min · {brl(it.a.valor)}
                  </p>
                  <span className={`${SUAVE.selo} mt-1 ${SELO_STATUS[it.a.status] ?? SUAVE.seloNeutro}`}>{TEXTO_STATUS[it.a.status] ?? it.a.status}</span>
                </div>
                {criarLinkWhatsApp(it.a.clienteTelefone, `Oi, ${it.a.clienteNome.split(" ")[0]}! Passando para confirmar seu horário de ${it.a.servicoNome} ${rotuloDoDia(dia, hoje).toLowerCase()} às ${it.hora}. Posso contar com você? 😊`) && (
                  <a
                    href={criarLinkWhatsApp(it.a.clienteTelefone, `Oi, ${it.a.clienteNome.split(" ")[0]}! Passando para confirmar seu horário de ${it.a.servicoNome} ${rotuloDoDia(dia, hoje).toLowerCase()} às ${it.hora}. Posso contar com você? 😊`)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Confirmar com ${it.a.clienteNome} no WhatsApp`}
                    className={`${SUAVE.botaoPequeno} ${SUAVE.seloOk} shrink-0`}
                  >
                    Confirmar
                  </a>
                )}
              </li>
            ) : (
              <li key={`l${it.hora}${i}`}>
                <button type="button" onClick={() => aoAgendar(dia, it.hora)} className={`${SUAVE.cartaoLivre} flex w-full items-center gap-3 p-4 text-left transition hover:bg-violet-50 dark:hover:bg-violet-300/10`}>
                  <span className={`grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-slate-100 text-base font-bold dark:bg-slate-700`}>{it.hora}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">Horário livre</span>
                    <span className={`block text-sm ${SUAVE.textoFraco}`}>Toque para agendar</span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-violet-600 dark:text-violet-200">
                    +
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
