"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle = {
  width: "100%",
  padding: 8,
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  color: "#000",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("http://localhost:5104/api/auth/login", {
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
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 20 }}>
      <h1>NexoGestão — Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        {erro && <p style={{ color: "red" }}>{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          style={{ padding: "8px 16px", border: "1px solid #999", borderRadius: 4, background: "#eee", color: "#000" }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
