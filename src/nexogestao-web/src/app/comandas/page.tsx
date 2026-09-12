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

interface ItemComanda {
  produtoId: number;
  nome: string;
  quantidade: number;
  preco: number;
}

interface Comanda {
  id: number;
  numero: number;
  itens: ItemComanda[];
}

const inputStyle =
  "px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

const botaoSecundario =
  "px-4 py-2 rounded-md bg-black/5 dark:bg-white/10 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/20";

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function ComandasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Record<number, string>>({});
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState<Record<number, string>>({});
  const [formaPagamento, setFormaPagamento] = useState<Record<number, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
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

    const [resProdutos, resComandas] = await Promise.all([
      fetch(`${API_URL}/api/empresas/${empresa.id}/produtos`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_URL}/api/empresas/${empresa.id}/comandas`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    setProdutos(await resProdutos.json());
    setComandas(await resComandas.json());
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  async function abrirComanda() {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/comandas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível abrir a comanda."));
        return;
      }

      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarItem(comandaId: number) {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    const produtoId = produtoSelecionado[comandaId];
    if (!token || !empresaId || !produtoId) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaId}/itens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            produtoId: Number(produtoId),
            quantidade: Number(quantidadeSelecionada[comandaId] ?? "1"),
          }),
        }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível adicionar o item."));
        return;
      }

      setProdutoSelecionado({ ...produtoSelecionado, [comandaId]: "" });
      setQuantidadeSelecionada({ ...quantidadeSelecionada, [comandaId]: "1" });
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function fecharComanda(comandaId: number) {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaId}/fechar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            formaPagamento: formaPagamento[comandaId] ?? "PIX",
          }),
        }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível fechar a comanda."));
        return;
      }

      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold tracking-tight mb-6">Comandas</h1>

        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 shadow-sm mb-6">
          <button onClick={abrirComanda} disabled={salvando} className={`${botaoSecundario} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {salvando ? "Abrindo..." : "+ Abrir nova comanda"}
          </button>
        </div>

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        {comandas.length === 0 && (
          <p className="text-black/40 dark:text-white/40 text-sm">Nenhuma comanda aberta.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {comandas.map((comanda) => {
            const total = comanda.itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);

            return (
              <div
                key={comanda.id}
                className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-3"
              >
                <h3 className="font-semibold">Comanda {comanda.numero}</h3>

                {comanda.itens.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody>
                      {comanda.itens.map((item, i) => (
                        <tr key={i}>
                          <td className="py-0.5">{item.nome}</td>
                          <td className="py-0.5">{item.quantidade}x</td>
                          <td className="py-0.5 text-right">R$ {(item.preco * item.quantidade).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="font-semibold text-sm">Total: R$ {total.toFixed(2)}</p>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={produtoSelecionado[comanda.id] ?? ""}
                    onChange={(e) =>
                      setProdutoSelecionado({ ...produtoSelecionado, [comanda.id]: e.target.value })
                    }
                    className={`${inputStyle} flex-1 min-w-0`}
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
                    value={quantidadeSelecionada[comanda.id] ?? "1"}
                    onChange={(e) =>
                      setQuantidadeSelecionada({ ...quantidadeSelecionada, [comanda.id]: e.target.value })
                    }
                    className={`${inputStyle} w-16`}
                  />
                  <button
                    onClick={() => adicionarItem(comanda.id)}
                    disabled={salvando}
                    className={`${botaoSecundario} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Adicionar
                  </button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <select
                    value={formaPagamento[comanda.id] ?? "PIX"}
                    onChange={(e) =>
                      setFormaPagamento({ ...formaPagamento, [comanda.id]: e.target.value })
                    }
                    className={inputStyle}
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Débito">Débito</option>
                    <option value="Crédito">Crédito</option>
                  </select>
                  <button
                    onClick={() => fecharComanda(comanda.id)}
                    disabled={comanda.itens.length === 0 || salvando}
                    className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {salvando ? "Salvando..." : "Fechar comanda"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
