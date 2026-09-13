"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Modal from "../_components/Modal";
import PageHeader from "../_components/PageHeader";
import SearchInput from "../_components/SearchInput";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface Cliente {
  id: number;
  nome: string;
  telefone?: string | null;
}

interface ItemCarrinho {
  produtoId: number;
  nome: string;
  precoUnitario: number;
  quantidade: number;
}

interface ItemVenda {
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
}

interface Venda {
  id: number;
  total: number;
  formaPagamento: string;
  valorRecebido?: number | null;
  troco?: number | null;
  parcelas?: number | null;
  saldoDevedor?: number | null;
  clienteNome?: string | null;
  itens: ItemVenda[];
  data: string;
}

interface ItemSemEstoque {
  produtoId: number;
  produtoNome: string;
  quantidade: number;
}

type PeriodoSemEstoque = "dia" | "semana" | "mes";

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function VendasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [valorRecebido, setValorRecebido] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [dataVencimento, setDataVencimento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [avisoEstoque, setAvisoEstoque] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("");
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);
  const [itensSemEstoque, setItensSemEstoque] = useState<ItemSemEstoque[]>([]);
  const [periodoSemEstoque, setPeriodoSemEstoque] = useState<PeriodoSemEstoque>("dia");
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarTudo() {
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

      const [resProdutos, resVendas, resClientes] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${empresa.id}/produtos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/vendas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/clientes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (moduloIndisponivel(resVendas)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }

      setProdutos(await resProdutos.json());
      setVendas(await resVendas.json());
      setClientes(await resClientes.json());
      await carregarSemEstoque(empresa.id, periodoSemEstoque);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarSemEstoque(idEmpresa: number, periodo: PeriodoSemEstoque) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(
      `${API_URL}/api/empresas/${idEmpresa}/vendas/sem-estoque?periodo=${periodo}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) setItensSemEstoque(await res.json());
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (empresaId) carregarSemEstoque(empresaId, periodoSemEstoque);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSemEstoque]);

  function adicionarAoCarrinho() {
    const produto = produtos.find((p) => p.id === Number(produtoSelecionado));
    if (!produto) return;

    setCarrinho([
      ...carrinho,
      {
        produtoId: produto.id,
        nome: produto.nome,
        precoUnitario: produto.preco,
        quantidade: Number(quantidade),
      },
    ]);
    setProdutoSelecionado("");
    setQuantidade("1");
  }

  function removerDoCarrinho(index: number) {
    setCarrinho(carrinho.filter((_, i) => i !== index));
  }

  const totalCarrinho = carrinho.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );

  const valorPago = Number(valorRecebido || "0");

  // Quanto falta pagar, quando a forma de pagamento permite pagamento parcial
  // (Dinheiro com troco insuficiente, ou Fiado) — o restante vira dívida do cliente.
  const faltante =
    formaPagamento === "Dinheiro" || formaPagamento === "Fiado"
      ? totalCarrinho - valorPago
      : 0;

  const trocoCalculado =
    formaPagamento === "Dinheiro" && valorRecebido && faltante <= 0
      ? valorPago - totalCarrinho
      : null;

  const precisaDeCliente =
    formaPagamento === "Fiado" || (faltante > 0 && formaPagamento === "Dinheiro");

  const clienteFiadoSelecionado = clientes.find((c) => c.id === Number(clienteSelecionado));
  const fiadoSemTelefone = formaPagamento === "Fiado" && !!clienteFiadoSelecionado && !clienteFiadoSelecionado.telefone;

  async function finalizarVenda() {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId || carrinho.length === 0) return;

    if (precisaDeCliente && !clienteSelecionado) {
      setErro(
        formaPagamento === "Fiado"
          ? "Selecione o cliente que está comprando fiado."
          : "Selecione um cliente para registrar o valor que ficou faltando como fiado."
      );
      return;
    }

    if (formaPagamento === "Fiado" && !dataVencimento) {
      setErro("Informe a data de vencimento da venda fiado.");
      return;
    }

    setSalvando(true);
    setAvisoEstoque(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/vendas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          formaPagamento,
          clienteId: clienteSelecionado ? Number(clienteSelecionado) : null,
          valorRecebido:
            formaPagamento === "Dinheiro" || formaPagamento === "Fiado"
              ? valorPago
              : null,
          parcelas: formaPagamento === "Crédito" ? Number(parcelas || "1") : null,
          dataVencimento: formaPagamento === "Fiado" ? dataVencimento : null,
          itens: carrinho.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
          })),
        }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível registrar a venda."));
        return;
      }

      const data = await res.json().catch(() => null);
      if (data?.estoqueNegativo?.length > 0) {
        setAvisoEstoque(
          `Atenção: estoque ficou negativo para ${data.estoqueNegativo.join(", ")}.`
        );
      }

      setCarrinho([]);
      setValorRecebido("");
      setParcelas("1");
      setClienteSelecionado("");
      setDataVencimento("");
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function registrarPagamentoFiado(vendaId: number) {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    const valor = Number(valorPagamento[vendaId] || "0");
    if (!token || !empresaId || valor <= 0) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/vendas/${vendaId}/pagamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ valor }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível registrar o pagamento."));
        return;
      }

      setValorPagamento({ ...valorPagamento, [vendaId]: "" });
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  const formasPagamento = Array.from(new Set(vendas.map((v) => v.formaPagamento))).sort();

  const vendasFiltradas = vendas.filter((v) => {
    const termo = busca.trim().toLowerCase();
    if (termo && !(v.clienteNome ?? "").toLowerCase().includes(termo)) return false;
    if (filtroPagamento && v.formaPagamento !== filtroPagamento) return false;
    return true;
  });

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Vendas" />

        <div className={`${cardStyle} p-5 mb-6`}>
          <h2 className="text-sm font-semibold mb-4">Nova venda</h2>

          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className={labelStyle}>Produto</label>
              <select
                value={produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value)}
                className={inputStyle}
              >
                <option value="">Selecione um produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — R$ {p.preco}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Qtd.</label>
              <input
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className={`${inputStyle} w-20`}
              />
            </div>
            <button onClick={adicionarAoCarrinho} disabled={!produtoSelecionado} className={botaoSecundario}>
              + Adicionar
            </button>
          </div>

          {carrinho.length > 0 && (
            <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-black/50 dark:text-white/50 bg-black/[0.02] dark:bg-white/[0.03]">
                    <th className="py-2 px-3 font-medium">Produto</th>
                    <th className="py-2 px-3 font-medium">Qtd.</th>
                    <th className="py-2 px-3 font-medium">Preço</th>
                    <th className="py-2 px-3 font-medium">Subtotal</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {carrinho.map((item, i) => (
                    <tr key={i} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2 px-3">{item.nome}</td>
                      <td className="py-2 px-3">{item.quantidade}</td>
                      <td className="py-2 px-3">R$ {item.precoUnitario.toFixed(2)}</td>
                      <td className="py-2 px-3 font-medium">R$ {(item.precoUnitario * item.quantidade).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => removerDoCarrinho(i)} className="text-red-600 hover:underline text-xs font-medium">
                          remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-indigo-600/10 px-4 py-3 mb-4">
            <span className="text-sm font-medium text-black/70 dark:text-white/70">Total da venda</span>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">R$ {totalCarrinho.toFixed(2)}</span>
          </div>

          <div className="flex flex-wrap gap-3 items-end mb-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Cliente</label>
              <select
                value={clienteSelecionado}
                onChange={(e) => setClienteSelecionado(e.target.value)}
                className={`${inputStyle} min-w-[160px]`}
              >
                <option value="">Consumidor não identificado</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className={inputStyle}
              >
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
                <option value="Fiado">Fiado</option>
              </select>
            </div>

            {formaPagamento === "Crédito" && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className={`${inputStyle} w-20`}
                />
              </div>
            )}

            {(formaPagamento === "Dinheiro" || formaPagamento === "Fiado") && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>
                  {formaPagamento === "Fiado" ? "Valor pago agora (opcional)" : "Valor recebido"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  className={`${inputStyle} w-32`}
                />
              </div>
            )}

            {formaPagamento === "Fiado" && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Data de vencimento</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className={`${inputStyle} w-40 ${dataVencimento ? "pr-7" : ""}`}
                  />
                  {dataVencimento && (
                    <button
                      type="button"
                      onClick={() => setDataVencimento("")}
                      aria-label="Limpar data"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={finalizarVenda}
              disabled={
                carrinho.length === 0 ||
                salvando ||
                (precisaDeCliente && !clienteSelecionado) ||
                (formaPagamento === "Fiado" && !dataVencimento)
              }
              className={`${botaoPrimario} ml-auto`}
            >
              {salvando ? "Salvando..." : "Finalizar venda"}
            </button>
          </div>

          {formaPagamento === "Fiado" && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 mb-3 text-sm">
              <p className="font-semibold text-red-700 dark:text-red-400 mb-1">🔴 Venda fiado</p>
              <div className="grid grid-cols-3 gap-2 text-black/70 dark:text-white/70">
                <div>
                  <div className={labelStyle}>Cliente</div>
                  <div>{clienteFiadoSelecionado?.nome ?? "—"}</div>
                </div>
                <div>
                  <div className={labelStyle}>Valor</div>
                  <div>R$ {(totalCarrinho - valorPago).toFixed(2)}</div>
                </div>
                <div>
                  <div className={labelStyle}>Vencimento</div>
                  <div>
                    {dataVencimento
                      ? new Date(dataVencimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                </div>
              </div>
              {fiadoSemTelefone && (
                <p className="text-amber-600 dark:text-amber-500 mt-2">
                  Este cliente não tem telefone cadastrado — não será possível cobrar pelo WhatsApp.
                </p>
              )}
            </div>
          )}

          {trocoCalculado !== null && (
            <p className="text-sm font-medium text-green-600">Troco: R$ {trocoCalculado.toFixed(2)}</p>
          )}
          {faltante > 0 && formaPagamento === "Dinheiro" && (
            <p className="text-sm font-medium text-amber-600">
              {clienteSelecionado
                ? `Fica devendo: R$ ${faltante.toFixed(2)}`
                : `Falta R$ ${faltante.toFixed(2)} — selecione um cliente pra registrar como fiado`}
            </p>
          )}

          {avisoEstoque && <p className="text-sm font-medium text-amber-600 mt-3">{avisoEstoque}</p>}
          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        </div>

        {itensSemEstoque.length > 0 && (
          <div className={`${cardStyle} p-5 mb-6`}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <h2 className="text-sm font-semibold">Vendas sem estoque suficiente</h2>
              <div className="flex gap-1">
                {(["dia", "semana", "mes"] as PeriodoSemEstoque[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodoSemEstoque(p)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                      periodoSemEstoque === p
                        ? "bg-indigo-600 text-white"
                        : "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/20"
                    }`}
                  >
                    {p === "dia" ? "Hoje" : p === "semana" ? "7 dias" : "30 dias"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-black/50 dark:text-white/50 bg-black/[0.02] dark:bg-white/[0.03]">
                    <th className="py-2 px-3 font-medium">Produto</th>
                    <th className="py-2 px-3 font-medium">Quantidade vendida sem estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {itensSemEstoque.map((i) => (
                    <tr key={i.produtoId} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2 px-3">{i.produtoNome}</td>
                      <td className="py-2 px-3 text-amber-600 dark:text-amber-500 font-medium">{i.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold mb-3">Histórico de vendas</h2>

        {vendas.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome do cliente..." className="max-w-xs flex-1" />
            <select
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
              className={`${inputStyle} w-44`}
            >
              <option value="">Qualquer pagamento</option>
              {formasPagamento.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={`${cardStyle} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2.5 px-4 font-medium">Data</th>
                <th className="py-2.5 px-4 font-medium">Cliente</th>
                <th className="py-2.5 px-4 font-medium">Total</th>
                <th className="py-2.5 px-4 font-medium">Pagamento</th>
                <th className="py-2.5 px-4 font-medium">Detalhe</th>
                <th className="py-2.5 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.map((v) => (
                <tr key={v.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 px-4">{new Date(v.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-4">
                    {v.clienteNome ?? <span className="text-black/30 dark:text-white/30">—</span>}
                  </td>
                  <td className="py-2.5 px-4">R$ {v.total.toFixed(2)}</td>
                  <td className="py-2.5 px-4">
                    {v.formaPagamento}
                    {v.parcelas && v.parcelas > 1 ? ` ${v.parcelas}x` : ""}
                  </td>
                  <td className="py-2.5 px-4">
                    {v.troco != null && v.troco > 0 && <span>Troco: R$ {v.troco.toFixed(2)}</span>}
                    {v.saldoDevedor != null && v.saldoDevedor > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600">
                          {v.clienteNome ?? "cliente"} deve R$ {v.saldoDevedor.toFixed(2)}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="pagar"
                          value={valorPagamento[v.id] ?? ""}
                          onChange={(e) => setValorPagamento({ ...valorPagamento, [v.id]: e.target.value })}
                          className={`${inputStyle} h-8 w-20`}
                        />
                        <button
                          onClick={() => registrarPagamentoFiado(v.id)}
                          disabled={salvando}
                          className={botaoTexto}
                        >
                          registrar
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button onClick={() => setVendaDetalhe(v)} className={botaoTexto}>
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {vendasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando
                      ? "Carregando..."
                      : vendas.length === 0
                      ? "Nenhuma venda registrada."
                      : "Nenhuma venda encontrada pra esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {vendaDetalhe && (
        <Modal titulo={`Venda #${vendaDetalhe.id}`} onFechar={() => setVendaDetalhe(null)}>
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={labelStyle}>Data/hora</div>
                <div>{new Date(vendaDetalhe.data).toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className={labelStyle}>Cliente</div>
                <div>{vendaDetalhe.clienteNome ?? "Consumidor não identificado"}</div>
              </div>
              <div>
                <div className={labelStyle}>Pagamento</div>
                <div>
                  {vendaDetalhe.formaPagamento}
                  {vendaDetalhe.parcelas && vendaDetalhe.parcelas > 1 ? ` ${vendaDetalhe.parcelas}x` : ""}
                </div>
              </div>
              <div>
                <div className={labelStyle}>Total</div>
                <div className="font-semibold">R$ {vendaDetalhe.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden mt-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-black/50 dark:text-white/50 bg-black/[0.02] dark:bg-white/[0.03]">
                    <th className="py-2 px-3 font-medium">Produto</th>
                    <th className="py-2 px-3 font-medium">Qtd.</th>
                    <th className="py-2 px-3 font-medium">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {vendaDetalhe.itens.map((item, i) => {
                    const produto = produtos.find((p) => p.id === item.produtoId);
                    return (
                      <tr key={i} className="border-t border-black/5 dark:border-white/5">
                        <td className="py-2 px-3">{produto?.nome ?? `Produto #${item.produtoId}`}</td>
                        <td className="py-2 px-3">{item.quantidade}</td>
                        <td className="py-2 px-3">R$ {item.precoUnitario.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {vendaDetalhe.troco != null && vendaDetalhe.troco > 0 && (
              <p className="text-green-600 font-medium">Troco: R$ {vendaDetalhe.troco.toFixed(2)}</p>
            )}
            {vendaDetalhe.saldoDevedor != null && vendaDetalhe.saldoDevedor > 0 && (
              <p className="text-amber-600 font-medium">Saldo devedor: R$ {vendaDetalhe.saldoDevedor.toFixed(2)}</p>
            )}

            <div className="flex justify-end mt-1">
              <button onClick={() => setVendaDetalhe(null)} className={botaoSecundario}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
