"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Produto {
  id: number;
  nome: string;
  categoria?: string;
  preco: number;
  estoque: number;
  ativo: boolean;
}

const inputStyle = {
  padding: 6,
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  color: "#000",
  marginRight: 8,
};

export default function ProdutosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
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

    const resEmpresas = await fetch("http://localhost:5104/api/empresas/minhas", {
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

    const resProdutos = await fetch(
      `http://localhost:5104/api/empresas/${primeiraEmpresa.id}/produtos`,
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
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    const res = await fetch(`http://localhost:5104/api/empresas/${empresaId}/produtos`, {
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
      setErro("Não foi possível cadastrar o produto.");
      return;
    }

    setNome("");
    setCategoria("");
    setPreco("");
    setCusto("");
    setEstoque("");
    setEstoqueMinimo("");
    await carregarEmpresaEProdutos();
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>Produtos {empresaNome && `— ${empresaNome}`}</h1>

      <form onSubmit={handleAdicionar} style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required style={inputStyle} />
        <input placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle} />
        <input placeholder="Preço" type="number" value={preco} onChange={(e) => setPreco(e.target.value)} required style={{ ...inputStyle, width: 90 }} />
        <input placeholder="Custo" type="number" value={custo} onChange={(e) => setCusto(e.target.value)} required style={{ ...inputStyle, width: 90 }} />
        <input placeholder="Estoque" type="number" value={estoque} onChange={(e) => setEstoque(e.target.value)} required style={{ ...inputStyle, width: 90 }} />
        <input placeholder="Estoque mín." type="number" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} required style={{ ...inputStyle, width: 100 }} />
        <button type="submit" style={{ padding: "6px 12px", border: "1px solid #999", borderRadius: 4, background: "#eee", color: "#000" }}>
          Adicionar
        </button>
      </form>

      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Nome</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Categoria</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Preço</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Estoque</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.categoria}</td>
              <td>R$ {p.preco}</td>
              <td>{p.estoque}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
