"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const inputStyle = {
  padding: 6,
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  color: "#000",
  marginRight: 8,
};

const botaoStyle = {
  padding: "6px 12px",
  border: "1px solid #999",
  borderRadius: 4,
  background: "#eee",
  color: "#000",
};

export default function ComandasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [numeroNovaComanda, setNumeroNovaComanda] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState<Record<number, string>>({});
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState<Record<number, string>>({});
  const [formaPagamento, setFormaPagamento] = useState<Record<number, string>>({});
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

    const [resProdutos, resComandas] = await Promise.all([
      fetch(`http://localhost:5104/api/empresas/${empresa.id}/produtos`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`http://localhost:5104/api/empresas/${empresa.id}/comandas`, {
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
    setErro(null);
    const token = getToken();
    if (!token || !empresaId || !numeroNovaComanda) return;

    const res = await fetch(`http://localhost:5104/api/empresas/${empresaId}/comandas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ numero: Number(numeroNovaComanda) }),
    });

    if (!res.ok) {
      setErro("Não foi possível abrir a comanda.");
      return;
    }

    setNumeroNovaComanda("");
    await carregarTudo();
  }

  async function adicionarItem(comandaId: number) {
    setErro(null);
    const token = getToken();
    const produtoId = produtoSelecionado[comandaId];
    if (!token || !empresaId || !produtoId) return;

    const res = await fetch(
      `http://localhost:5104/api/empresas/${empresaId}/comandas/${comandaId}/itens`,
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
      setErro("Não foi possível adicionar o item.");
      return;
    }

    setProdutoSelecionado({ ...produtoSelecionado, [comandaId]: "" });
    setQuantidadeSelecionada({ ...quantidadeSelecionada, [comandaId]: "1" });
    await carregarTudo();
  }

  async function fecharComanda(comandaId: number) {
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    const res = await fetch(
      `http://localhost:5104/api/empresas/${empresaId}/comandas/${comandaId}/fechar`,
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
      setErro("Não foi possível fechar a comanda.");
      return;
    }

    await carregarTudo();
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1>Comandas {empresaNome && `— ${empresaNome}`}</h1>

      <h3>Abrir nova comanda</h3>
      <div style={{ marginBottom: 24 }}>
        <input
          placeholder="Número"
          type="number"
          min="1"
          value={numeroNovaComanda}
          onChange={(e) => setNumeroNovaComanda(e.target.value)}
          style={{ ...inputStyle, width: 90 }}
        />
        <button onClick={abrirComanda} style={botaoStyle}>
          Abrir comanda
        </button>
      </div>

      {erro && <p style={{ color: "red" }}>{erro}</p>}

      {comandas.length === 0 && <p>Nenhuma comanda aberta.</p>}

      {comandas.map((comanda) => {
        const total = comanda.itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);

        return (
          <div
            key={comanda.id}
            style={{ border: "1px solid #ccc", borderRadius: 6, padding: 16, marginBottom: 16 }}
          >
            <h3>Comanda {comanda.numero}</h3>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <tbody>
                {comanda.itens.map((item, i) => (
                  <tr key={i}>
                    <td>{item.nome}</td>
                    <td>{item.quantidade}x</td>
                    <td>R$ {(item.preco * item.quantidade).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <strong>Total: R$ {total.toFixed(2)}</strong>
            </p>

            <div style={{ marginBottom: 8 }}>
              <select
                value={produtoSelecionado[comanda.id] ?? ""}
                onChange={(e) =>
                  setProdutoSelecionado({ ...produtoSelecionado, [comanda.id]: e.target.value })
                }
                style={inputStyle}
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
                style={{ ...inputStyle, width: 60 }}
              />
              <button onClick={() => adicionarItem(comanda.id)} style={botaoStyle}>
                Adicionar item
              </button>
            </div>

            <div>
              <select
                value={formaPagamento[comanda.id] ?? "PIX"}
                onChange={(e) =>
                  setFormaPagamento({ ...formaPagamento, [comanda.id]: e.target.value })
                }
                style={inputStyle}
              >
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
              </select>
              <button
                onClick={() => fecharComanda(comanda.id)}
                disabled={comanda.itens.length === 0}
                style={botaoStyle}
              >
                Fechar comanda
              </button>
            </div>
          </div>
        );
      })}
    </main>
  );
}
