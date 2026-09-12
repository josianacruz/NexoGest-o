"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";

interface Produto {
  id: number;
  nome: string;
  preco: number;
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
  data: string;
}

const inputStyle =
  "px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function VendasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [erro, setErro] = useState<string | null>(null);
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

    const resEmpresas = await fetch("http://localhost:5104/api/empresas/minhas", {
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

    const [resProdutos, resVendas] = await Promise.all([
      fetch(`http://localhost:5104/api/empresas/${empresa.id}/produtos`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`http://localhost:5104/api/empresas/${empresa.id}/vendas`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    setProdutos(await resProdutos.json());
    setVendas(await resVendas.json());
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

  async function finalizarVenda() {
    setErro(null);
    const token = getToken();
    if (!token || !empresaId || carrinho.length === 0) return;

    const res = await fetch(`http://localhost:5104/api/empresas/${empresaId}/vendas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        formaPagamento,
        itens: carrinho.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErro(data?.mensagem ?? "Não foi possível registrar a venda.");
      return;
    }

    setCarrinho([]);
    await carregarTudo();
  }

  return (
    <>
      <Nav empresaNome={empresaNome} />
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

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className={inputStyle}
            >
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Débito">Débito</option>
              <option value="Crédito">Crédito</option>
            </select>
            <button
              onClick={finalizarVenda}
              disabled={carrinho.length === 0}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Finalizar venda
            </button>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 px-4">{new Date(v.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-4">R$ {v.total.toFixed(2)}</td>
                  <td className="py-2 px-4">{v.formaPagamento}</td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    Nenhuma venda registrada.
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
