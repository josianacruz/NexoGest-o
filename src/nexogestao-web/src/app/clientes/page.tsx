"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
}

const inputStyle = {
  padding: 6,
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  color: "#000",
  marginRight: 8,
};

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarEmpresaEClientes() {
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

    const resClientes = await fetch(
      `http://localhost:5104/api/empresas/${primeiraEmpresa.id}/clientes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listaClientes = await resClientes.json();
    setClientes(listaClientes);
  }

  useEffect(() => {
    carregarEmpresaEClientes();
  }, []);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    const res = await fetch(`http://localhost:5104/api/empresas/${empresaId}/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nome, telefone, email }),
    });

    if (!res.ok) {
      setErro("Não foi possível cadastrar o cliente.");
      return;
    }

    setNome("");
    setTelefone("");
    setEmail("");
    await carregarEmpresaEClientes();
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>Clientes {empresaNome && `— ${empresaNome}`}</h1>

      <form onSubmit={handleAdicionar} style={{ marginBottom: 24 }}>
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          placeholder="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <button
          type="submit"
          style={{ padding: "6px 12px", border: "1px solid #999", borderRadius: 4, background: "#eee", color: "#000" }}
        >
          Adicionar
        </button>
      </form>

      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Nome</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Telefone</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td>{c.nome}</td>
              <td>{c.telefone}</td>
              <td>{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}