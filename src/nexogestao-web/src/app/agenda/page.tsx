"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import PageHeader from "../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";

interface Cliente {
  id: number;
  nome: string;
  telefone?: string | null;
}

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
}

type StatusAgendamento = "Agendado" | "Confirmado" | "Concluido" | "Cancelado" | "Faltou";

interface Agendamento {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  servicoId?: number | null;
  servicoNome: string;
  dataHora: string;
  duracaoMinutos: number;
  valor: number;
  observacao?: string | null;
  status: StatusAgendamento;
}

interface Conflito {
  id: number;
  dataHora: string;
  duracaoMinutos: number;
  servicoNome: string;
  clienteNome: string;
}

interface Resumo {
  totalHoje: number;
  naoConfirmados: number;
  proximoAtendimento: { id: number; dataHora: string; servicoNome: string; clienteNome: string } | null;
}

type Visualizacao = "dia" | "semana";

const STATUS_ESTILO: Record<StatusAgendamento, string> = {
  Agendado: "bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70",
  Confirmado: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  Concluido: "bg-green-500/10 text-green-600 dark:text-green-400",
  Cancelado: "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 line-through",
  Faltou: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const PROXIMOS_STATUS: Record<StatusAgendamento, StatusAgendamento[]> = {
  Agendado: ["Confirmado", "Concluido", "Cancelado", "Faltou"],
  Confirmado: ["Concluido", "Cancelado", "Faltou"],
  Concluido: [],
  Cancelado: [],
  Faltou: [],
};

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

function paraChaveData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hojeChave(): string {
  return paraChaveData(new Date());
}

function somarDias(chave: string, dias: number): string {
  const d = new Date(chave + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return paraChaveData(d);
}

function inicioDaSemana(chave: string): string {
  const d = new Date(chave + "T00:00:00");
  const diaSemana = d.getDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana; // volta pra segunda-feira
  d.setDate(d.getDate() + deslocamento);
  return paraChaveData(d);
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function formatarDataCurta(chave: string): string {
  return new Date(chave + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarDataLonga(chave: string): string {
  return new Date(chave + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function horarioFim(dataHora: string, duracaoMinutos: number): string {
  const fim = new Date(new Date(dataHora).getTime() + duracaoMinutos * 60000).toISOString();
  return formatarHora(fim);
}

export default function AgendaPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("dia");
  const [dataSelecionada, setDataSelecionada] = useState(hojeChave());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [servicoSelecionado, setServicoSelecionado] = useState("");
  const [dataForm, setDataForm] = useState(hojeChave());
  const [horaForm, setHoraForm] = useState("09:00");
  const [duracaoForm, setDuracaoForm] = useState("30");
  const [valorForm, setValorForm] = useState("");
  const [observacaoForm, setObservacaoForm] = useState("");
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null);

  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  const { inicioRange, fimRange } = useMemo(() => {
    if (visualizacao === "dia") return { inicioRange: dataSelecionada, fimRange: dataSelecionada };
    const inicio = inicioDaSemana(dataSelecionada);
    return { inicioRange: inicio, fimRange: somarDias(inicio, 6) };
  }, [visualizacao, dataSelecionada]);

  async function carregarBase() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) {
        setErro("Você ainda não tem nenhuma empresa cadastrada.");
        return;
      }
      const empresa = empresas[0];
      setEmpresaId(empresa.id);
      setEmpresaNome(empresa.nome);
      setComandasHabilitadas(empresa.comandasHabilitadas ?? true);

      const [resClientes, resServicos] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${empresa.id}/clientes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/servicos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (moduloIndisponivel(resServicos)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }

      setClientes(await resClientes.json());
      setServicos(await resServicos.json());
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAgendamentos(idEmpresa: number, inicio: string, fim: string) {
    const token = getToken();
    if (!token) return;

    const [resLista, resResumo] = await Promise.all([
      fetch(`${API_URL}/api/empresas/${idEmpresa}/agendamentos?inicio=${inicio}&fim=${fim}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_URL}/api/empresas/${idEmpresa}/agendamentos/resumo`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (moduloIndisponivel(resLista, resResumo)) {
      setErro(MODULO_INDISPONIVEL_MSG);
      return;
    }

    if (resLista.ok) setAgendamentos(await resLista.json());
    if (resResumo.ok) setResumo(await resResumo.json());
  }

  useEffect(() => {
    carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (empresaId) carregarAgendamentos(empresaId, inicioRange, fimRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, inicioRange, fimRange]);

  function selecionarServico(id: string) {
    setServicoSelecionado(id);
    const servico = servicos.find((s) => s.id === Number(id));
    if (servico) {
      setDuracaoForm(String(servico.duracaoMinutos));
      setValorForm(String(servico.preco));
    }
  }

  function limparFormulario() {
    setClienteSelecionado("");
    setServicoSelecionado("");
    setHoraForm("09:00");
    setDuracaoForm("30");
    setValorForm("");
    setObservacaoForm("");
    setConflitos(null);
  }

  async function agendar(forcarComConflito: boolean) {
    if (salvando || !empresaId) return;
    setErro(null);

    if (!clienteSelecionado) {
      setErro("Selecione o cliente.");
      return;
    }
    if (!servicoSelecionado) {
      setErro("Selecione o serviço.");
      return;
    }

    const token = getToken();
    if (!token) return;

    const servico = servicos.find((s) => s.id === Number(servicoSelecionado));

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/agendamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clienteId: Number(clienteSelecionado),
          servicoId: servico?.id ?? null,
          servicoNome: servico?.nome ?? "",
          data: dataForm,
          hora: horaForm,
          duracaoMinutos: Number(duracaoForm || "0"),
          valor: Number(valorForm || "0"),
          observacao: observacaoForm.trim() || null,
          forcarComConflito,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflitos(data.conflitos ?? []);
        return;
      }

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível criar o agendamento."));
        return;
      }

      limparFormulario();
      setDataSelecionada(dataForm);
      setVisualizacao("dia");
      await carregarAgendamentos(empresaId, dataForm, dataForm);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(agendamentoId: number, status: StatusAgendamento) {
    if (salvando || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/agendamentos/${agendamentoId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível atualizar o status."));
        return;
      }
      await carregarAgendamentos(empresaId, inicioRange, fimRange);
    } finally {
      setSalvando(false);
    }
  }

  // Dois agendamentos (não cancelados) do mesmo dia cujos horários se cruzam.
  const idsEmConflito = useMemo(() => {
    const ids = new Set<number>();
    const porDia = new Map<string, Agendamento[]>();
    for (const a of agendamentos) {
      if (a.status === "Cancelado") continue;
      const chave = a.dataHora.slice(0, 10);
      const lista = porDia.get(chave) ?? [];
      lista.push(a);
      porDia.set(chave, lista);
    }
    for (const lista of porDia.values()) {
      for (let i = 0; i < lista.length; i++) {
        const aIni = new Date(lista[i].dataHora).getTime();
        const aFim = aIni + lista[i].duracaoMinutos * 60000;
        for (let j = i + 1; j < lista.length; j++) {
          const bIni = new Date(lista[j].dataHora).getTime();
          const bFim = bIni + lista[j].duracaoMinutos * 60000;
          if (aIni < bFim && bIni < aFim) {
            ids.add(lista[i].id);
            ids.add(lista[j].id);
          }
        }
      }
    }
    return ids;
  }, [agendamentos]);

  const agora = Date.now();
  const emBreveIds = useMemo(() => {
    const ids = new Set<number>();
    for (const a of agendamentos) {
      if (a.status === "Cancelado" || a.status === "Faltou" || a.status === "Concluido") continue;
      const inicio = new Date(a.dataHora).getTime();
      const diffMin = (inicio - agora) / 60000;
      if (diffMin >= 0 && diffMin <= 60) ids.add(a.id);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos]);

  const diasDaSemana =
    visualizacao === "semana"
      ? Array.from({ length: 7 }, (_, i) => somarDias(inicioRange, i))
      : [dataSelecionada];

  const agendamentosPorDia = (chave: string) =>
    agendamentos
      .filter((a) => a.dataHora.slice(0, 10) === chave)
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  function renderAgendamento(a: Agendamento) {
    const emConflito = idsEmConflito.has(a.id);
    const emBreve = emBreveIds.has(a.id);
    return (
      <div
        key={a.id}
        className={`${cardStyle} p-3 flex flex-col gap-1.5 ${
          emConflito ? "border-red-400 dark:border-red-600 ring-1 ring-red-400/40" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-sm">
            {formatarHora(a.dataHora)}–{horarioFim(a.dataHora, a.duracaoMinutos)}
          </span>
          <div className="flex items-center gap-1.5">
            {emBreve && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Em breve
              </span>
            )}
            {emConflito && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
                Conflito
              </span>
            )}
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_ESTILO[a.status]}`}>
              {a.status}
            </span>
          </div>
        </div>
        <div className="text-sm">
          <span className="font-medium">{a.clienteNome}</span>
          <span className="text-black/50 dark:text-white/50"> — {a.servicoNome}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-black/50 dark:text-white/50">R$ {a.valor.toFixed(2)}</span>
          {a.observacao && <span className="text-black/40 dark:text-white/40 truncate max-w-[60%]">{a.observacao}</span>}
        </div>
        {PROXIMOS_STATUS[a.status].length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1 border-t border-black/5 dark:border-white/5 mt-1">
            {PROXIMOS_STATUS[a.status].map((proximo) => (
              <button
                key={proximo}
                onClick={() => mudarStatus(a.id, proximo)}
                disabled={salvando}
                className={botaoTexto}
              >
                {proximo === "Concluido" ? "Concluir" : proximo === "Cancelado" ? "Cancelar" : proximo}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Agenda" />

        {resumo && (resumo.totalHoje > 0 || resumo.proximoAtendimento) && (
          <div className="flex flex-col gap-2 mb-6">
            {resumo.proximoAtendimento && (
              <div className="rounded-lg bg-indigo-600/10 px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-400">
                <span className="font-semibold">Próximo atendimento:</span> {resumo.proximoAtendimento.clienteNome} —{" "}
                {resumo.proximoAtendimento.servicoNome} — {formatarHora(resumo.proximoAtendimento.dataHora)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg bg-black/5 dark:bg-white/10 px-4 py-2.5 text-sm">
                Você tem <span className="font-semibold">{resumo.totalHoje}</span>{" "}
                {resumo.totalHoje === 1 ? "agendamento" : "agendamentos"} hoje
              </div>
              {resumo.naoConfirmados > 0 && (
                <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2.5 text-sm">
                  {resumo.naoConfirmados} ainda {resumo.naoConfirmados === 1 ? "não confirmado" : "não confirmados"}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${cardStyle} p-5 mb-6`}>
          <h2 className="text-sm font-semibold mb-4">Novo agendamento</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Cliente</label>
              <select
                value={clienteSelecionado}
                onChange={(e) => setClienteSelecionado(e.target.value)}
                className={inputStyle}
              >
                <option value="">Selecione</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Serviço</label>
              <select
                value={servicoSelecionado}
                onChange={(e) => selecionarServico(e.target.value)}
                className={inputStyle}
              >
                <option value="">Selecione</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} — {s.duracaoMinutos} min — R$ {s.preco.toFixed(2)}
                  </option>
                ))}
              </select>
              {servicos.length === 0 && (
                <span className="text-xs text-black/40 dark:text-white/40">
                  Cadastre um serviço primeiro na tela Serviços.
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end mb-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Data</label>
              <input
                type="date"
                value={dataForm}
                onChange={(e) => setDataForm(e.target.value)}
                className={`${inputStyle} w-40`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Hora</label>
              <input
                type="time"
                value={horaForm}
                onChange={(e) => setHoraForm(e.target.value)}
                className={`${inputStyle} w-28`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Duração (min)</label>
              <input
                type="number"
                min="1"
                value={duracaoForm}
                onChange={(e) => setDuracaoForm(e.target.value)}
                className={`${inputStyle} w-24`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Valor</label>
              <input
                type="number"
                step="0.01"
                value={valorForm}
                onChange={(e) => setValorForm(e.target.value)}
                className={`${inputStyle} w-28`}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className={labelStyle}>Observação (opcional)</label>
              <input
                value={observacaoForm}
                onChange={(e) => setObservacaoForm(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          {conflitos && conflitos.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 mb-3 text-sm">
              <p className="font-semibold text-red-700 dark:text-red-400 mb-2">
                Já existe(m) agendamento(s) nesse horário:
              </p>
              <ul className="flex flex-col gap-1 mb-3">
                {conflitos.map((c) => (
                  <li key={c.id} className="text-black/70 dark:text-white/70">
                    {formatarHora(c.dataHora)} — {c.clienteNome} — {c.servicoNome}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => agendar(true)} disabled={salvando} className={botaoPrimario}>
                  Agendar mesmo assim
                </button>
                <button onClick={() => setConflitos(null)} className={botaoSecundario}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

          {!conflitos && (
            <div className="flex justify-end">
              <button onClick={() => agendar(false)} disabled={salvando} className={`${botaoPrimario} w-full sm:w-auto`}>
                {salvando ? "Agendando..." : "Agendar"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDataSelecionada((d) => somarDias(d, visualizacao === "dia" ? -1 : -7))}
              className={botaoSecundario}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button onClick={() => setDataSelecionada(hojeChave())} className={botaoSecundario}>
              Hoje
            </button>
            <button
              onClick={() => setDataSelecionada((d) => somarDias(d, visualizacao === "dia" ? 1 : 7))}
              className={botaoSecundario}
              aria-label="Próximo"
            >
              ›
            </button>
            <span className="text-sm font-medium text-black/70 dark:text-white/70 ml-1">
              {visualizacao === "dia"
                ? formatarDataLonga(dataSelecionada)
                : `${formatarDataCurta(inicioRange)} – ${formatarDataCurta(fimRange)}`}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVisualizacao("dia")}
              className={visualizacao === "dia" ? botaoPrimario : botaoSecundario}
            >
              Dia
            </button>
            <button
              onClick={() => setVisualizacao("semana")}
              className={visualizacao === "semana" ? botaoPrimario : botaoSecundario}
            >
              Semana
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {diasDaSemana.map((chave) => {
            const lista = agendamentosPorDia(chave);
            const eHoje = chave === hojeChave();
            return (
              <div key={chave}>
                {visualizacao === "semana" && (
                  <h3
                    className={`text-sm font-semibold mb-2 ${
                      eHoje ? "text-indigo-600 dark:text-indigo-400" : "text-black/70 dark:text-white/70"
                    }`}
                  >
                    {formatarDataLonga(chave)}
                    {eHoje && " · Hoje"}
                  </h3>
                )}
                <div className="flex flex-col gap-2">
                  {lista.length === 0 ? (
                    <p className="text-sm text-black/40 dark:text-white/40 py-2">
                      {carregando ? "Carregando..." : "Nenhum agendamento."}
                    </p>
                  ) : (
                    lista.map(renderAgendamento)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
