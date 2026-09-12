"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import { API_URL } from "../../lib/api";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface Cliente {
  id: number;
  nome: string;
}

interface ItemCarrinho {
  produtoId: number;
  nome: string;
  precoUnitario: number;
  quantidade: number;
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
  data: string;
}

const inputStyle =
  "px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

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
  const [erro, setErro] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
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

      setProdutos(await resProdutos.json());
      setVendas(await resVendas.json());
      setClientes(await resClientes.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

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

  const precisaDeCliente = faltante > 0 && (formaPagamento === "Dinheiro" || formaPagamento === "Fiado");

  async function finalizarVenda() {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId || carrinho.length === 0) return;

    if (precisaDeCliente && !clienteSelecionado) {
      setErro("Selecione um cliente para registrar o valor que ficou faltando como fiado.");
      return;
    }

    setSalvando(true);
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

      setCarrinho([]);
      setValorRecebido("");
      setParcelas("1");
      setClienteSelecionado("");
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

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold tracking-tight mb-6">Vendas</h1>

        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 shadow-sm mb-6">
          <h2 className="text-sm font-medium text-black/60 dark:text-white/60 mb-3">Adicionar produto</h2>
          <div className="flex flex-wrap gap-3 items-end mb-4">
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
            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className={`${inputStyle} w-20`}
            />
            <button onClick={adicionarAoCarrinho} className="px-4 py-2 rounded-md bg-black/5 dark:bg-white/10 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/20">
              Adicionar
            </button>
          </div>

          {carrinho.length > 0 && (
            <table className="w-full text-sm mb-3">
              <tbody>
                {carrinho.map((item, i) => (
                  <tr key={i} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2">{item.nome}</td>
                    <td className="py-2">{item.quantidade}x</td>
                    <td className="py-2">R$ {(item.precoUnitario * item.quantidade).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => removerDoCarrinho(i)} className="text-red-600 hover:underline">
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="font-semibold mb-4">Total: R$ {totalCarrinho.toFixed(2)}</p>

          <div className="flex flex-wrap gap-3 items-center mb-3">
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

            {formaPagamento === "Crédito" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-black/60 dark:text-white/60">Parcelas</label>
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
                <label className="text-xs font-medium text-black/60 dark:text-white/60">
                  {formaPagamento === "Fiado" ? "Valor pago agora" : "Valor recebido"}
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

            {(formaPagamento === "Fiado" || (formaPagamento === "Dinheiro" && faltante > 0)) && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-black/60 dark:text-white/60">Cliente</label>
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
            )}

            <button
              onClick={finalizarVenda}
              disabled={carrinho.length === 0 || salvando || (precisaDeCliente && !clienteSelecionado)}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? "Salvando..." : "Finalizar venda"}
            </button>
          </div>

          {trocoCalculado !== null && (
            <p className="text-sm font-medium text-green-600">Troco: R$ {trocoCalculado.toFixed(2)}</p>
          )}
          {faltante > 0 && (formaPagamento === "Dinheiro" || formaPagamento === "Fiado") && (
            <p className="text-sm font-medium text-amber-600">
              {clienteSelecionado
                ? `Fica devendo: R$ ${faltante.toFixed(2)}`
                : `Falta R$ ${faltante.toFixed(2)} — selecione um cliente pra registrar como fiado`}
            </p>
          )}

          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        </div>

        <h2 className="text-sm font-medium text-black/60 dark:text-white/60 mb-3">Histórico de vendas</h2>
        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2 px-4 font-medium">Data</th>
                <th className="py-2 px-4 font-medium">Total</th>
                <th className="py-2 px-4 font-medium">Pagamento</th>
                <th className="py-2 px-4 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 px-4">{new Date(v.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-4">R$ {v.total.toFixed(2)}</td>
                  <td className="py-2 px-4">
                    {v.formaPagamento}
                    {v.parcelas && v.parcelas > 1 ? ` ${v.parcelas}x` : ""}
                  </td>
                  <td className="py-2 px-4">
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
                          className={`${inputStyle} w-20 !py-1`}
                        />
                        <button
                          onClick={() => registrarPagamentoFiado(v.id)}
                          disabled={salvando}
                          className="text-indigo-600 hover:underline text-xs font-medium disabled:opacity-40"
                        >
                          registrar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando ? "Carregando..." : "Nenhuma venda registrada."}
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
