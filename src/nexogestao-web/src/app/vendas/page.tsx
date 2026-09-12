"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const inputStyle = {
  padding: 6,
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  color: "#000",
  marginRight: 8,
};

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
      setErro("Não foi possível registrar a venda.");
      return;
    }

    setCarrinho([]);
    await carregarTudo();
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>Vendas {empresaNome && `— ${empresaNome}`}</h1>

      <h3>Adicionar produto</h3>
      <div style={{ marginBottom: 16 }}>
        <select
          value={produtoSelecionado}
          onChange={(e) => setProdutoSelecionado(e.target.value)}
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
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          style={{ ...inputStyle, width: 60 }}
        />
        <button
          onClick={adicionarAoCarrinho}
          style={{ padding: "6px 12px", border: "1px solid #999", borderRadius: 4, background: "#eee", color: "#000" }}
        >
          Adicionar
        </button>
      </div>

      <h3>Carrinho</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
        <tbody>
          {carrinho.map((item, i) => (
            <tr key={i}>
              <td>{item.nome}</td>
              <td>{item.quantidade}x</td>
              <td>R$ {(item.precoUnitario * item.quantidade).toFixed(2)}</td>
              <td>
                <button onClick={() => removerDoCarrinho(i)} style={{ color: "red" }}>
                  remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Total: R$ {totalCarrinho.toFixed(2)}</strong>
      </p>

      <select
        value={formaPagamento}
        onChange={(e) => setFormaPagamento(e.target.value)}
        style={inputStyle}
      >
        <option value="PIX">PIX</option>
        <option value="Dinheiro">Dinheiro</option>
        <option value="Débito">Débito</option>
        <option value="Crédito">Crédito</option>
      </select>
      <button
        onClick={finalizarVenda}
        disabled={carrinho.length === 0}
        style={{ padding: "6px 12px", border: "1px solid #999", borderRadius: 4, background: "#eee", color: "#000" }}
      >
        Finalizar venda
      </button>

      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <h3 style={{ marginTop: 32 }}>Histórico de vendas</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Data</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Total</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Pagamento</th>
          </tr>
        </thead>
        <tbody>
          {vendas.map((v) => (
            <tr key={v.id}>
              <td>{new Date(v.data).toLocaleString("pt-BR")}</td>
              <td>R$ {v.total.toFixed(2)}</td>
              <td>{v.formaPagamento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}