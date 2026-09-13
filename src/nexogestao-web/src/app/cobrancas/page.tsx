"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import PageHeader from "../_components/PageHeader";
import { labelStyle, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";
import { abrirWhatsApp, mensagemLembreteVencimento, mensagemCobrancaVencida } from "../../lib/whatsapp";

interface ContaReceber {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  vendaId: number;
  valorOriginal: number;
  valorPendente: number;
  dataVencimento: string;
  dataPagamento?: string | null;
  status: "PENDENTE" | "VENCIDO" | "PAGO";
}

interface Resumo {
  aReceber: number;
  venceHoje: number;
  vencidas: number;
  quantidadeVencidas: number;
}

type Filtro = "todos" | "pendentes" | "vencendo-hoje" | "vencidos" | "pagos";

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

function formatarDataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const filtros: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "pendentes", label: "Pendentes" },
  { valor: "vencendo-hoje", label: "Vencendo hoje" },
  { valor: "vencidos", label: "Vencidos" },
  { valor: "pagos", label: "Pagos" },
];

export default function CobrancasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarTudo(filtroAtual: Filtro) {
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
      if (empresas.length === 0) return;

      const empresa = empresas[0];
      setEmpresaId(empresa.id);
      setEmpresaNome(empresa.nome);
      setComandasHabilitadas(empresa.comandasHabilitadas ?? true);

      const filtroQuery = filtroAtual === "todos" ? "" : `?filtro=${filtroAtual}`;
      const [resContas, resResumo] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${empresa.id}/contas-receber${filtroQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/contas-receber/resumo`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setContas(await resContas.json());
      setResumo(await resResumo.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function registrarPagamento(contaId: number) {
    if (salvando || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/contas-receber/${contaId}/pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível registrar o pagamento."));
        return;
      }

      await carregarTudo(filtro);
    } finally {
      setSalvando(false);
    }
  }

  function enviarLembrete(conta: ContaReceber) {
    const mensagem =
      conta.status === "VENCIDO"
        ? mensagemCobrancaVencida(conta.clienteNome, conta.valorPendente, conta.dataVencimento)
        : mensagemLembreteVencimento(conta.clienteNome, conta.valorPendente, conta.dataVencimento);
    const abriu = abrirWhatsApp(conta.clienteTelefone, mensagem);
    if (!abriu) setErro("Este cliente não possui telefone cadastrado.");
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Cobranças" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className={`${cardStyle} p-4`}>
            <div className={labelStyle}>A receber</div>
            <div className="text-2xl font-bold mt-1">R$ {(resumo?.aReceber ?? 0).toFixed(2)}</div>
          </div>
          <div className={`${cardStyle} p-4`}>
            <div className={labelStyle}>Vence hoje</div>
            <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">
              R$ {(resumo?.venceHoje ?? 0).toFixed(2)}
            </div>
          </div>
          <div className={`${cardStyle} p-4`}>
            <div className={labelStyle}>Vencidas</div>
            <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
              R$ {(resumo?.vencidas ?? 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {filtros.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                filtro === f.valor
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <div className={`${cardStyle} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2.5 px-4 font-medium">Cliente</th>
                <th className="py-2.5 px-4 font-medium">Valor</th>
                <th className="py-2.5 px-4 font-medium">Vencimento</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium text-center">WhatsApp</th>
                <th className="py-2.5 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 px-4">{c.clienteNome}</td>
                  <td className="py-2.5 px-4 font-medium">R$ {c.valorPendente.toFixed(2)}</td>
                  <td className="py-2.5 px-4">{formatarDataBr(c.dataVencimento)}</td>
                  <td className="py-2.5 px-4">
                    {c.status === "PAGO" && (
                      <span className="text-xs font-medium text-green-600 dark:text-green-500">🟢 Pago</span>
                    )}
                    {c.status === "PENDENTE" && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-500">🟡 Pendente</span>
                    )}
                    {c.status === "VENCIDO" && (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">🔴 Vencido</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {c.status !== "PAGO" && (
                      <button
                        onClick={() => enviarLembrete(c)}
                        title={`Cobrar ${c.clienteNome} no WhatsApp`}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
                      >
                        <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M16.001 3C9.096 3 3.5 8.596 3.5 15.5c0 2.316.63 4.484 1.727 6.35L3 29l7.32-2.19a12.44 12.44 0 0 0 5.68 1.44h.001c6.905 0 12.5-5.596 12.5-12.5S22.906 3 16.001 3zm0 22.7h-.001a10.2 10.2 0 0 1-5.2-1.43l-.373-.222-3.87 1.159 1.176-3.77-.243-.387a10.17 10.17 0 0 1-1.59-5.55c0-5.632 4.578-10.2 10.203-10.2 5.624 0 10.199 4.568 10.199 10.2 0 5.633-4.575 10.2-10.201 10.2zm5.593-7.638c-.306-.153-1.81-.893-2.09-.994-.28-.102-.484-.153-.688.152-.204.306-.79.994-.968 1.198-.178.204-.356.23-.663.077-.306-.153-1.293-.477-2.463-1.52-.91-.812-1.525-1.815-1.703-2.121-.178-.306-.019-.471.134-.623.137-.137.306-.357.459-.535.153-.178.204-.306.306-.51.102-.204.05-.383-.026-.535-.077-.153-.688-1.658-.943-2.271-.248-.596-.5-.515-.688-.524l-.586-.01c-.204 0-.535.077-.815.383-.28.306-1.068 1.043-1.068 2.545s1.093 2.953 1.246 3.157c.153.204 2.152 3.286 5.213 4.607.728.314 1.296.502 1.739.642.731.232 1.396.199 1.922.121.586-.088 1.81-.74 2.065-1.454.255-.714.255-1.326.178-1.454-.076-.128-.28-.204-.586-.357z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {c.status !== "PAGO" && (
                      <button onClick={() => registrarPagamento(c.id)} disabled={salvando} className={botaoTexto}>
                        Registrar pagamento
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {contas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando ? "Carregando..." : "Nenhuma conta encontrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
