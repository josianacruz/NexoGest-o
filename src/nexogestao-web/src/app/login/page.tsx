"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      if (!res.ok) {
        throw new Error("Email ou senha inválidos.");
      }
      const data = await res.json();
      localStorage.setItem("nexo_token", data.token);
      router.push("/clientes");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight mb-1">NexoGestão</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mb-6">Entre para continuar</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              required
              className="px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
              >
                {mostrarSenha ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="mt-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
