"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Modal from "../_components/Modal";
import PageHeader from "../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";
import { abrirWhatsApp, mensagemAgendamentoConfirmacao } from "../../lib/whatsapp";

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

interface CobrancaPendente {
  id: number;
  clienteId: number;
  clienteNome: string;
  valor: number;
  motivo: string;
}

interface AgendamentoHoje {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  servicoNome: string;
  dataHora: string;
  duracaoMinutos: number;
  valor: number;
  status: StatusAgendamento;
  chegou: boolean;
}

interface Resumo {
  totalHoje: number;
  naoConfirmados: number;
  proximoAtendimento: { id: number; dataHora: string; servicoNome: string; clienteNome: string } | null;
  cobrancasPendentes: CobrancaPendente[];
  agendamentosHoje: AgendamentoHoje[];
}

interface Configuracao {
  horasAntesLembrete: number;
  horasMinimasCancelamento: number;
  cobrarCancelamentoForaPrazo: boolean;
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

function BotaoWhatsApp({ nome, onClick }: { nome: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Chamar ${nome} no WhatsApp`}
      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
    >
      <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M16.001 3C9.096 3 3.5 8.596 3.5 15.5c0 2.316.63 4.484 1.727 6.35L3 29l7.32-2.19a12.44 12.44 0 0 0 5.68 1.44h.001c6.905 0 12.5-5.596 12.5-12.5S22.906 3 16.001 3zm0 22.7h-.001a10.2 10.2 0 0 1-5.2-1.43l-.373-.222-3.87 1.159 1.176-3.77-.243-.387a10.17 10.17 0 0 1-1.59-5.55c0-5.632 4.578-10.2 10.203-10.2 5.624 0 10.199 4.568 10.199 10.2 0 5.633-4.575 10.2-10.201 10.2zm5.593-7.638c-.306-.153-1.81-.893-2.09-.994-.28-.102-.484-.153-.688.152-.204.306-.79.994-.968 1.198-.178.204-.356.23-.663.077-.306-.153-1.293-.477-2.463-1.52-.91-.812-1.525-1.815-1.703-2.121-.178-.306-.019-.471.134-.623.137-.137.306-.357.459-.535.153-.178.204-.306.306-.51.102-.204.05-.383-.026-.535-.077-.153-.688-1.658-.943-2.271-.248-.596-.5-.515-.688-.524l-.586-.01c-.204 0-.535.077-.815.383-.28.306-1.068 1.043-1.068 2.545s1.093 2.953 1.246 3.157c.153.204 2.152 3.286 5.213 4.607.728.314 1.296.502 1.739.642.731.232 1.396.199 1.922.121.586-.088 1.81-.74 2.065-1.454.255-.714.255-1.326.178-1.454-.076-.128-.28-.204-.586-.357z" />
      </svg>
    </button>
  );
}

// Input nativo de data/hora só abre o seletor se você acertar o iconezinho —
// aqui qualquer clique no campo abre, e uma legenda deixa isso óbvio.
function CampoDataHora({
  label,
  tipo,
  value,
  onChange,
  className = "",
}: {
  label: string;
  tipo: "date" | "time";
  value: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelStyle}>{label}</label>
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className={`${inputStyle} ${className} cursor-pointer`}
      />
      <span className="text-[11px] text-black/40 dark:text-white/40">Toque para escolher</span>
    </div>
  );
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
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    if (typeof window !== "undefined") {
      const dataDaUrl = new URLSearchParams(window.location.search).get("data");
      if (dataDaUrl) return dataDaUrl;
    }
    return hojeChave();
  });
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
  const [avisoCobranca, setAvisoCobranca] = useState<string | null>(null);

  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [config, setConfig] = useState<Configuracao>({
    horasAntesLembrete: 24,
    horasMinimasCancelamento: 24,
    cobrarCancelamentoForaPrazo: false,
  });
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [concluindoId, setConcluindoId] = useState<number | null>(null);
  const [valorRecebidoConclusao, setValorRecebidoConclusao] = useState("");
  const [formaPagamentoConclusao, setFormaPagamentoConclusao] = useState("PIX");

  const [reagendandoId, setReagendandoId] = useState<number | null>(null);
  const [novaDataReagendar, setNovaDataReagendar] = useState("");
  const [novaHoraReagendar, setNovaHoraReagendar] = useState("");
  const [conflitosReagendar, setConflitosReagendar] = useState<Conflito[] | null>(null);

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
      await carregarConfig(empresa.id);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarConfig(idEmpresa: number) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/empresas/${idEmpresa}/agenda/configuracao`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setConfig(await res.json());
  }

  async function salvarConfig() {
    if (!empresaId || salvandoConfig) return;
    const token = getToken();
    if (!token) return;

    setSalvandoConfig(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/agenda/configuracao`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar a configuração."));
        return;
      }
      setModalConfigAberto(false);
    } finally {
      setSalvandoConfig(false);
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

  async function mudarStatus(
    agendamentoId: number,
    status: StatusAgendamento,
    extra?: { valorRecebido?: number; formaPagamento?: string }
  ) {
    if (salvando || !empresaId) return;
    setErro(null);
    setAvisoCobranca(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/agendamentos/${agendamentoId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível atualizar o status."));
        return;
      }
      const data = await res.json();
      if (data.avisoCobranca) setAvisoCobranca(data.avisoCobranca.mensagem);
      setConcluindoId(null);
      await carregarAgendamentos(empresaId, inicioRange, fimRange);
    } finally {
      setSalvando(false);
    }
  }

  function iniciarConclusao(a: Agendamento) {
    setConcluindoId(a.id);
    setValorRecebidoConclusao(String(a.valor));
    setFormaPagamentoConclusao("PIX");
  }

  function iniciarReagendamento(a: { id: number; dataHora: string }) {
    setReagendandoId(a.id);
    setNovaDataReagendar(a.dataHora.slice(0, 10));
    setNovaHoraReagendar(new Date(a.dataHora).toISOString().slice(11, 16));
    setConflitosReagendar(null);
  }

  async function confirmarReagendamento(forcarComConflito: boolean) {
    if (salvando || !empresaId || !reagendandoId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/agendamentos/${reagendandoId}/reagendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: novaDataReagendar, hora: novaHoraReagendar, forcarComConflito }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflitosReagendar(data.conflitos ?? []);
        return;
      }

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível reagendar."));
        return;
      }

      setReagendandoId(null);
      setConflitosReagendar(null);
      await carregarAgendamentos(empresaId, inicioRange, fimRange);
    } finally {
      setSalvando(false);
    }
  }

  function enviarConfirmacao(a: AgendamentoHoje) {
    const mensagem = mensagemAgendamentoConfirmacao(
      a.clienteNome,
      formatarDataLonga(a.dataHora.slice(0, 10)),
      formatarHora(a.dataHora),
      a.servicoNome
    );
    const abriu = abrirWhatsApp(a.clienteTelefone, mensagem);
    if (!abriu) setErro(`${a.clienteNome} não tem telefone cadastrado.`);
    return abriu;
  }

  // "Começar confirmações": abre o WhatsApp de cada pendente, um de cada vez,
  // avançando a cada clique — sem precisar caçar cada card na tela.
  const [indiceConfirmacao, setIndiceConfirmacao] = useState<number | null>(null);

  function iniciarFilaConfirmacoes(lista: AgendamentoHoje[]) {
    if (lista.length === 0) return;
    setIndiceConfirmacao(0);
    enviarConfirmacao(lista[0]);
  }

  function proximaConfirmacao(lista: AgendamentoHoje[]) {
    if (indiceConfirmacao === null) return;
    const proximo = indiceConfirmacao + 1;
    if (proximo >= lista.length) {
      setIndiceConfirmacao(null);
      return;
    }
    setIndiceConfirmacao(proximo);
    enviarConfirmacao(lista[proximo]);
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

  // Sem "Chegou" — o profissional não precisa mexer na agenda durante o
  // atendimento. Prioridade fixa: próximo atendimento, confirmações a
  // enviar agora (dentro da antecedência configurada), não confirmados
  // (fora dessa janela ainda) e cobranças pendentes.
  const ativosHoje = useMemo(
    () => (resumo?.agendamentosHoje ?? []).filter((a) => a.status === "Agendado" || a.status === "Confirmado"),
    [resumo]
  );

  const proximoAtendimento = useMemo(
    () =>
      ativosHoje
        .filter((a) => new Date(a.dataHora).getTime() >= agora)
        .sort((a, b) => a.dataHora.localeCompare(b.dataHora))[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativosHoje]
  );

  const confirmacoesAEnviar = useMemo(
    () =>
      ativosHoje
        .filter((a) => a.status === "Agendado" && new Date(a.dataHora).getTime() - agora <= config.horasAntesLembrete * 3600000)
        .sort((a, b) => a.dataHora.localeCompare(b.dataHora)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativosHoje, config.horasAntesLembrete]
  );

  const naoConfirmadosFora = useMemo(
    () => ativosHoje.filter((a) => a.status === "Agendado" && !confirmacoesAEnviar.includes(a)),
    [ativosHoje, confirmacoesAEnviar]
  );

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
        {PROXIMOS_STATUS[a.status].length > 0 && concluindoId !== a.id && reagendandoId !== a.id && (
          <div className="flex flex-wrap gap-3 pt-1 border-t border-black/5 dark:border-white/5 mt-1">
            {PROXIMOS_STATUS[a.status].map((proximo) => (
              <button
                key={proximo}
                onClick={() => (proximo === "Concluido" ? iniciarConclusao(a) : mudarStatus(a.id, proximo))}
                disabled={salvando}
                className={botaoTexto}
              >
                {proximo === "Concluido" ? "Concluir" : proximo === "Cancelado" ? "Cancelar" : proximo}
              </button>
            ))}
            <button onClick={() => iniciarReagendamento(a)} disabled={salvando} className={botaoTexto}>
              Reagendar
            </button>
          </div>
        )}

        {(a.status === "Cancelado" || a.status === "Faltou") && (
          <div className="flex flex-wrap gap-3 pt-1 border-t border-black/5 dark:border-white/5 mt-1">
            <a
              href={`/marketing/horario-disponivel?data=${a.dataHora.slice(0, 10)}&hora=${formatarHora(a.dataHora)}`}
              className={botaoTexto}
            >
              Divulgar horário
            </a>
          </div>
        )}

        {reagendandoId === a.id && (
          <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5 mt-1">
            {conflitosReagendar && conflitosReagendar.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Conflita com{" "}
                {conflitosReagendar.map((c) => `${c.clienteNome} (${formatarHora(c.dataHora)})`).join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <CampoDataHora
                label="Data"
                tipo="date"
                value={novaDataReagendar}
                onChange={setNovaDataReagendar}
                className="w-36"
              />
              <CampoDataHora
                label="Hora"
                tipo="time"
                value={novaHoraReagendar}
                onChange={setNovaHoraReagendar}
                className="w-24"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmarReagendamento(conflitosReagendar !== null)}
                disabled={salvando}
                className={botaoPrimario}
              >
                {conflitosReagendar ? "Reagendar mesmo assim" : "Salvar"}
              </button>
              <button
                onClick={() => {
                  setReagendandoId(null);
                  setConflitosReagendar(null);
                }}
                className={botaoSecundario}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {concluindoId === a.id && (
          <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5 mt-1">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Valor recebido</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={a.valor}
                  value={valorRecebidoConclusao}
                  onChange={(e) => setValorRecebidoConclusao(e.target.value)}
                  className={`${inputStyle} h-9 w-28`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Forma de pagamento</label>
                <select
                  value={formaPagamentoConclusao}
                  onChange={(e) => setFormaPagamentoConclusao(e.target.value)}
                  className={`${inputStyle} h-9`}
                >
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </div>
            </div>
            {Number(valorRecebidoConclusao || "0") < a.valor && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Restante de R$ {(a.valor - Number(valorRecebidoConclusao || "0")).toFixed(2)} vira cobrança pendente.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  mudarStatus(a.id, "Concluido", {
                    valorRecebido: Number(valorRecebidoConclusao || "0"),
                    formaPagamento: formaPagamentoConclusao,
                  })
                }
                disabled={salvando}
                className={botaoPrimario}
              >
                Confirmar conclusão
              </button>
              <button onClick={() => setConcluindoId(null)} className={botaoSecundario}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader
          titulo="Agenda"
          acao={
            <button onClick={() => setModalConfigAberto(true)} className={botaoSecundario}>
              Configurações
            </button>
          }
        />

        {avisoCobranca && (
          <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2.5 text-sm mb-4">
            {avisoCobranca}
          </div>
        )}

        {resumo && resumo.totalHoje > 0 && (
          <div className="rounded-lg bg-black/5 dark:bg-white/10 px-4 py-2.5 text-sm mb-4 w-fit">
            Você tem <span className="font-semibold">{resumo.totalHoje}</span>{" "}
            {resumo.totalHoje === 1 ? "agendamento" : "agendamentos"} hoje
            {resumo.naoConfirmados > 0 &&
              ` · ${resumo.naoConfirmados} ainda ${resumo.naoConfirmados === 1 ? "não confirmado" : "não confirmados"}`}
          </div>
        )}

        {proximoAtendimento && (
          <div className={`${cardStyle} p-4 mb-4 bg-indigo-600/5`}>
            <div className={labelStyle}>Próximo atendimento</div>
            <div className="text-sm mt-1">
              <span className="font-semibold">{formatarHora(proximoAtendimento.dataHora)}</span> —{" "}
              <span className="font-medium">{proximoAtendimento.clienteNome}</span> —{" "}
              {proximoAtendimento.servicoNome}
            </div>
          </div>
        )}

        {confirmacoesAEnviar.length > 0 && (
          <div className={`${cardStyle} p-5 mb-4`}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h2 className="text-sm font-semibold">Confirmações a enviar ({confirmacoesAEnviar.length})</h2>
              {indiceConfirmacao === null ? (
                <button onClick={() => iniciarFilaConfirmacoes(confirmacoesAEnviar)} className={botaoPrimario}>
                  Começar confirmações
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                  <span>
                    Enviando {indiceConfirmacao + 1} de {confirmacoesAEnviar.length}
                  </span>
                  <button onClick={() => proximaConfirmacao(confirmacoesAEnviar)} className={botaoTexto}>
                    Próxima
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {confirmacoesAEnviar.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{a.clienteNome}</span>
                    <span className="text-black/50 dark:text-white/50"> — {a.servicoNome} — {formatarHora(a.dataHora)}</span>
                  </div>
                  <BotaoWhatsApp nome={a.clienteNome} onClick={() => enviarConfirmacao(a)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {naoConfirmadosFora.length > 0 && (
          <div className={`${cardStyle} p-5 mb-4`}>
            <h2 className="text-sm font-semibold mb-3">Não confirmados ({naoConfirmadosFora.length})</h2>
            <div className="flex flex-col gap-2">
              {naoConfirmadosFora.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{a.clienteNome}</span>
                    <span className="text-black/50 dark:text-white/50"> — {a.servicoNome} — {formatarHora(a.dataHora)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BotaoWhatsApp nome={a.clienteNome} onClick={() => enviarConfirmacao(a)} />
                    <button onClick={() => mudarStatus(a.id, "Confirmado")} disabled={salvando} className={botaoTexto}>
                      Confirmar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {resumo && resumo.cobrancasPendentes.length > 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 mb-6 text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Cobranças pendentes:</p>
            <ul className="flex flex-col gap-0.5 text-black/70 dark:text-white/70">
              {resumo.cobrancasPendentes.map((c) => (
                <li key={c.id}>
                  {c.clienteNome} — R$ {c.valor.toFixed(2)} ({c.motivo})
                </li>
              ))}
            </ul>
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
            <CampoDataHora label="Data" tipo="date" value={dataForm} onChange={setDataForm} className="w-40" />
            <CampoDataHora label="Hora" tipo="time" value={horaForm} onChange={setHoraForm} className="w-28" />
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

      {modalConfigAberto && (
        <Modal titulo="Configurações da Agenda" onFechar={() => setModalConfigAberto(false)}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Link público de agendamento</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={empresaId ? `${window.location.origin}/agendar/${empresaId}` : ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`${inputStyle} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (empresaId) navigator.clipboard.writeText(`${window.location.origin}/agendar/${empresaId}`);
                  }}
                  className={botaoTexto}
                >
                  Copiar
                </button>
              </div>
              <span className="text-[11px] text-black/40 dark:text-white/40">
                Envie esse link para os clientes marcarem horário sozinhos, sem login. Só serviços com "Permitir autoagendamento" habilitado aparecem nele.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Horas antes para lembrar confirmação</label>
              <input
                type="number"
                min="0"
                value={config.horasAntesLembrete}
                onChange={(e) => setConfig({ ...config, horasAntesLembrete: Number(e.target.value) })}
                className={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Horas mínimas para cancelamento sem cobrança</label>
              <input
                type="number"
                min="0"
                value={config.horasMinimasCancelamento}
                onChange={(e) => setConfig({ ...config, horasMinimasCancelamento: Number(e.target.value) })}
                className={inputStyle}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.cobrarCancelamentoForaPrazo}
                onChange={(e) => setConfig({ ...config, cobrarCancelamentoForaPrazo: e.target.checked })}
                className="accent-indigo-600"
              />
              Cobrar cancelamento fora do prazo (valor integral do serviço)
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setModalConfigAberto(false)}
                className="h-10 px-3 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button onClick={salvarConfig} disabled={salvandoConfig} className={botaoPrimario}>
                {salvandoConfig ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
