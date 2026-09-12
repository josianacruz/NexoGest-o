"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import { API_URL } from "../../lib/api";

interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  saldoDevedor?: number | null;
}

const inputStyle =
  "px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
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

    const resClientes = await fetch(
      `${API_URL}/api/empresas/${primeiraEmpresa.id}/clientes`,
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
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome, telefone, email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.mensagem ?? "Não foi possível cadastrar o cliente.");
        return;
      }

      setNome("");
      setTelefone("");
      setEmail("");
      await carregarEmpresaEClientes();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold tracking-tight mb-6">Clientes</h1>

        <div className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 shadow-sm mb-6">
          <form onSubmit={handleAdicionar} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Telefone</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-black/60 dark:text-white/60">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} />
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
                <th className="py-2 px-4 font-medium">Telefone</th>
                <th className="py-2 px-4 font-medium">Email</th>
                <th className="py-2 px-4 font-medium">Deve (fiado)</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 px-4">{c.nome}</td>
                  <td className="py-2 px-4">{c.telefone}</td>
                  <td className="py-2 px-4">{c.email}</td>
                  <td className="py-2 px-4">
                    {c.saldoDevedor ? (
                      <span className="text-amber-600 font-medium">R$ {c.saldoDevedor.toFixed(2)}</span>
                    ) : (
                      <span className="text-black/30 dark:text-white/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    Nenhum cliente cadastrado.
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
