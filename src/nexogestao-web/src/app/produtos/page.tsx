"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import { API_URL } from "../../lib/api";

interface Produto {
  id: number;
  nome: string;
  categoria?: string;
  preco: number;
  estoque: number;
  ativo: boolean;
}

const inputStyle =
  "px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ProdutosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarEmpresaEProdutos() {
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
    if (empresas.length === 0) {
      setErro("Você ainda não tem nenhuma empresa cadastrada.");
      return;
    }
    const primeiraEmpresa = empresas[0];
    setEmpresaId(primeiraEmpresa.id);
    setEmpresaNome(primeiraEmpresa.nome);
    setComandasHabilitadas(primeiraEmpresa.comandasHabilitadas ?? true);

    const resProdutos = await fetch(
      `${API_URL}/api/empresas/${primeiraEmpresa.id}/produtos`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listaProdutos = await resProdutos.json();
    setProdutos(listaProdutos);
  }

  useEffect(() => {
    carregarEmpresaEProdutos();
  }, []);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/produtos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          categoria,
          preco: Number(preco),
          custo: Number(custo),
          estoque: Number(estoque),
          estoqueMinimo: Number(estoqueMinimo),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.mensagem ?? "Não foi possível cadastrar o produto.");
        return;
      }

      setNome("");
      setCategoria("");
      setPreco("");
      setCusto("");
      setEstoque("");
      setEstoqueMinimo("");
      await carregarEmpresaEProdutos();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold tracking-tight mb-6">Produtos</h1>

        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 shadow-sm mb-6">
          <form onSubmit={handleAdicionar} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Categoria</label>
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Preço</label>
              <input type="number" value={preco} onChange={(e) => setPreco(e.target.value)} required className={`${inputStyle} w-24`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Custo</label>
              <input type="number" value={custo} onChange={(e) => setCusto(e.target.value)} required className={`${inputStyle} w-24`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Estoque</label>
              <input type="number" value={estoque} onChange={(e) => setEstoque(e.target.value)} required className={`${inputStyle} w-24`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Estoque mín.</label>
              <input type="number" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} required className={`${inputStyle} w-24`} />
            </div>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? "Adicionando..." : "Adicionar"}
            </button>
          </form>
          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        </div>

        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2 px-4 font-medium">Nome</th>
                <th className="py-2 px-4 font-medium">Categoria</th>
                <th className="py-2 px-4 font-medium">Preço</th>
                <th className="py-2 px-4 font-medium">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 px-4">{p.nome}</td>
                  <td className="py-2 px-4">{p.categoria}</td>
                  <td className="py-2 px-4">R$ {p.preco.toFixed(2)}</td>
                  <td className="py-2 px-4">{p.estoque}</td>
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    Nenhum produto cadastrado.
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
