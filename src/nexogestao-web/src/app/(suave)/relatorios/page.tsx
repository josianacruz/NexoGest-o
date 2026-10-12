"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import Modal from "../../_components/Modal";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoSecundario, cardStyle } from "../../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../../lib/api";

type Periodo = "hoje" | "semana" | "mes" | "personalizado";

interface Resumo {
  totalVendido: number;
  quantidadeVendas: number;
  totalRecebido: number;
  faltaReceber: number;
  temMovimentacao: boolean;
}

interface FormaPagamentoResumo {
  forma: string;
  valor: number;
  quantidade: number;
  percentual: number;
}

interface PagamentoDetalhe {
  id: number;
  valor: number;
  data: string;
  vendaId: number;
  clienteNome: string;
  formaPagamento?: string;
}

interface RelatorioVendas {
  totalVendido: number;
  quantidade: number;
  valorMedio: number;
  vendasPagas: number;
  vendasPendentes: number;
  produtosMaisVendidos: { produtoNome: string; quantidade: number; totalVendido: number }[];
  serieDiaria: { data: string; valor: number }[];
}

const LABEL_FORMA: Record<string, string> = {
  Pix: "PIX",
  Dinheiro: "Dinheiro",
  CartaoCredito: "Crédito",
  CartaoDebito: "Débito",
  TransferenciaBancaria: "Transferência",
  Outros: "Outros",
};

const ICONE_FORMA: Record<string, string> = {
  Pix: "💚",
  Dinheiro: "💵",
  CartaoCredito: "💳",
  CartaoDebito: "💳",
  TransferenciaBancaria: "🏦",
  Outros: "🔹",
};

const CORES_FORMA: Record<string, string> = {
  Pix: "bg-emerald-500",
  Dinheiro: "bg-green-700",
  CartaoCredito: "bg-indigo-600",
  CartaoDebito: "bg-blue-500",
  TransferenciaBancaria: "bg-amber-500",
  Outros: "bg-gray-400",
};

function formatarMoeda(v: number) {
  return `R$ ${v.toFixed(2)}`;
}

function formatarDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function RelatoriosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [formas, setFormas] = useState<FormaPagamentoResumo[]>([]);
  const [vendasRelatorio, setVendasRelatorio] = useState<RelatorioVendas | null>(null);
  const [historico, setHistorico] = useState<PagamentoDetalhe[]>([]);
  const [formaDetalhe, setFormaDetalhe] = useState<FormaPagamentoResumo | null>(null);
  const [pagamentosDetalhe, setPagamentosDetalhe] = useState<PagamentoDetalhe[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  function queryPeriodo() {
    if (periodo === "personalizado" && dataInicio && dataFim) {
      return `periodo=personalizado&inicio=${dataInicio}&fim=${dataFim}`;
    }
    return `periodo=${periodo}`;
  }

  async function carregarTudo() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setCarregando(true);
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

      const qs = queryPeriodo();
      const [resResumo, resFormas, resVendas, resHistorico] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${empresa.id}/relatorios/resumo?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/relatorios/formas-pagamento?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/relatorios/vendas?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/relatorios/pagamentos?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (moduloIndisponivel(resResumo, resFormas, resVendas, resHistorico)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }

      setResumo(await resResumo.json());
      setFormas((await resFormas.json()).formas ?? []);
      setVendasRelatorio(await resVendas.json());
      setHistorico(await resHistorico.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregarTudo alterna carregando/erro conforme busca os relatórios do período escolhido
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, dataInicio, dataFim]);

  async function abrirDetalheForma(forma: FormaPagamentoResumo) {
    setFormaDetalhe(forma);
    setPagamentosDetalhe([]);
    const token = getToken();
    if (!token || !empresaId) return;
    const res = await fetch(
      `${API_URL}/api/empresas/${empresaId}/relatorios/formas-pagamento/${forma.forma}/pagamentos?${queryPeriodo()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) setPagamentosDetalhe(await res.json());
  }

  const maiorVendaDia = Math.max(1, ...(vendasRelatorio?.serieDiaria.map((d) => d.valor) ?? [0]));

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="📊 Relatórios" />

        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { valor: "hoje", label: "Hoje" },
            { valor: "semana", label: "Esta semana" },
            { valor: "mes", label: "Este mês" },
            { valor: "personalizado", label: "Escolher período" },
          ] as { valor: Periodo; label: string }[]).map((p) => (
            <button
              key={p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                periodo === p.valor
                  ? "bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-300/25 dark:text-violet-50"
                  : "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}
          {periodo === "personalizado" && (
            <div className="flex items-center gap-2">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={inputStyle} />
              <span className="text-black/60 dark:text-white/55 text-sm">até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputStyle} />
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        {!carregando && resumo && !resumo.temMovimentacao ? (
          <div className={`${cardStyle} p-8 text-center text-black/60 dark:text-white/60`}>
            Você ainda não teve vendas ou recebimentos neste período.
          </div>
        ) : (
          <>
            {/* Resumo — as três perguntas principais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className={`${cardStyle} p-5`}>
                <div className={labelStyle}>💰 Total vendido</div>
                <div className="text-2xl font-bold mt-1">{formatarMoeda(resumo?.totalVendido ?? 0)}</div>
                <div className="text-xs text-black/60 dark:text-white/55 mt-1">
                  {resumo?.quantidadeVendas ?? 0} venda{resumo?.quantidadeVendas === 1 ? "" : "s"}
                </div>
              </div>
              <div className={`${cardStyle} p-5`}>
                <div className={labelStyle}>✅ Já recebido</div>
                <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-500">
                  {formatarMoeda(resumo?.totalRecebido ?? 0)}
                </div>
              </div>
              <div className={`${cardStyle} p-5`}>
                <div className={labelStyle}>⏳ Falta receber</div>
                <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">
                  {formatarMoeda(resumo?.faltaReceber ?? 0)}
                </div>
              </div>
            </div>

            {/* Como recebi meu dinheiro */}
            <h2 className="text-sm font-semibold mb-3">Como recebi meu dinheiro?</h2>
            {formas.length === 0 ? (
              <div className={`${cardStyle} p-6 text-center text-black/60 dark:text-white/55 mb-6`}>
                Você ainda não recebeu pagamentos neste período.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {formas.map((f) => (
                    <button
                      key={f.forma}
                      onClick={() => abrirDetalheForma(f)}
                      className={`${cardStyle} p-4 text-left hover:ring-2 hover:ring-indigo-500 transition-shadow`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {ICONE_FORMA[f.forma] ?? "🔹"} {LABEL_FORMA[f.forma] ?? f.forma}
                        </span>
                        <span className="text-xs text-black/60 dark:text-white/55">{f.percentual}%</span>
                      </div>
                      <div className="text-xl font-bold">{formatarMoeda(f.valor)}</div>
                      <div className="text-xs text-black/60 dark:text-white/55">
                        {f.quantidade} pagamento{f.quantidade === 1 ? "" : "s"}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Barra empilhada simples — sem lib de gráfico externa */}
                <div className={`${cardStyle} p-4 mb-6`}>
                  <div className="flex w-full h-4 rounded-full overflow-hidden mb-3">
                    {formas.map((f) => (
                      <div
                        key={f.forma}
                        className={CORES_FORMA[f.forma] ?? "bg-gray-400"}
                        style={{ width: `${f.percentual}%` }}
                        title={`${LABEL_FORMA[f.forma] ?? f.forma}: ${f.percentual}%`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {formas.map((f) => (
                      <div key={f.forma} className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
                        <span className={`w-2.5 h-2.5 rounded-full ${CORES_FORMA[f.forma] ?? "bg-gray-400"}`} />
                        {LABEL_FORMA[f.forma] ?? f.forma}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Minhas vendas */}
            <h2 className="text-sm font-semibold mb-3">Minhas vendas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className={`${cardStyle} p-4`}>
                <div className={labelStyle}>Valor médio</div>
                <div className="text-lg font-bold mt-1">{formatarMoeda(vendasRelatorio?.valorMedio ?? 0)}</div>
              </div>
              <div className={`${cardStyle} p-4`}>
                <div className={labelStyle}>Vendas pagas</div>
                <div className="text-lg font-bold mt-1 text-green-600 dark:text-green-500">
                  {vendasRelatorio?.vendasPagas ?? 0}
                </div>
              </div>
              <div className={`${cardStyle} p-4`}>
                <div className={labelStyle}>Pendentes</div>
                <div className="text-lg font-bold mt-1 text-amber-600 dark:text-amber-500">
                  {vendasRelatorio?.vendasPendentes ?? 0}
                </div>
              </div>
              <div className={`${cardStyle} p-4`}>
                <div className={labelStyle}>Produto campeão</div>
                <div className="text-sm font-bold mt-1 truncate">
                  {vendasRelatorio?.produtosMaisVendidos[0]?.produtoNome ?? "—"}
                </div>
              </div>
            </div>

            {/* Como estão minhas vendas */}
            {vendasRelatorio && vendasRelatorio.serieDiaria.length > 0 && (
              <div className={`${cardStyle} p-4 mb-6`}>
                <h3 className="text-sm font-semibold mb-3">Como estão minhas vendas?</h3>
                <div className="flex items-end gap-1.5 h-32">
                  {vendasRelatorio.serieDiaria.map((d) => (
                    <div key={d.data} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                      <div className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 bg-black text-white rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                        {formatarDataCurta(d.data)}: {formatarMoeda(d.valor)}
                      </div>
                      <div
                        className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                        style={{ height: `${Math.max(4, (d.valor / maiorVendaDia) * 100)}%` }}
                      />
                      <div className="text-[10px] text-black/60 dark:text-white/55">{formatarDataCurta(d.data)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vendasRelatorio && vendasRelatorio.produtosMaisVendidos.length > 0 && (
              <div className={`${cardStyle} p-4 mb-6`}>
                <h3 className="text-sm font-semibold mb-3">Produtos mais vendidos</h3>
                <div className="flex flex-col gap-2">
                  {vendasRelatorio.produtosMaisVendidos.map((p) => (
                    <div key={p.produtoNome} className="flex items-center justify-between text-sm">
                      <span>{p.produtoNome}</span>
                      <span className="text-black/60 dark:text-white/60">{p.quantidade}x — {formatarMoeda(p.totalVendido)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagamentos recebidos */}
            <h2 className="text-sm font-semibold mb-3">Pagamentos recebidos</h2>
            <div className={`${cardStyle} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-black/60 dark:text-white/60 border-b border-black/10 dark:border-white/10">
                    <th className="py-2.5 px-4 font-medium">Cliente</th>
                    <th className="py-2.5 px-4 font-medium">Valor</th>
                    <th className="py-2.5 px-4 font-medium">Recebido por</th>
                    <th className="py-2.5 px-4 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((p) => (
                    <tr key={p.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                      <td className="py-2.5 px-4">{p.clienteNome}</td>
                      <td className="py-2.5 px-4 font-medium">{formatarMoeda(p.valor)}</td>
                      <td className="py-2.5 px-4">
                        {p.formaPagamento ? LABEL_FORMA[p.formaPagamento] ?? p.formaPagamento : "Não informado"}
                      </td>
                      <td className="py-2.5 px-4">{formatarDataCurta(p.data)}</td>
                    </tr>
                  ))}
                  {historico.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 px-4 text-center text-black/60 dark:text-white/55">
                        {carregando ? "Carregando..." : "Você ainda não recebeu pagamentos neste período."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {formaDetalhe && (
        <Modal titulo={`${ICONE_FORMA[formaDetalhe.forma] ?? ""} ${LABEL_FORMA[formaDetalhe.forma] ?? formaDetalhe.forma}`} onFechar={() => setFormaDetalhe(null)}>
          <div className="flex flex-col gap-3 text-sm max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between rounded-lg bg-indigo-600/10 px-3 py-2">
              <span className="font-medium">Total recebido</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatarMoeda(formaDetalhe.valor)}</span>
            </div>
            {pagamentosDetalhe.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                <div>
                  <div className="font-medium">{p.clienteNome}</div>
                  <div className="text-xs text-black/60 dark:text-white/55">{formatarDataCurta(p.data)}</div>
                </div>
                <div className="font-medium">{formatarMoeda(p.valor)}</div>
              </div>
            ))}
            {pagamentosDetalhe.length === 0 && (
              <p className="text-center text-black/60 dark:text-white/55 py-4">Nenhum pagamento encontrado.</p>
            )}
            <div className="flex justify-end mt-1">
              <button onClick={() => setFormaDetalhe(null)} className={botaoSecundario}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
