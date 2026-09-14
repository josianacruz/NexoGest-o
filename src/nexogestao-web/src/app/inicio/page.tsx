"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "../_components/Nav";
import { cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";
import { temModulo } from "../../lib/modulos";
import { obterNomeDoUsuario } from "../../lib/auth";

export default function InicioPage() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [modulos, setModulos] = useState<string[]>([]);
  const [interessesNovos, setInteressesNovos] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setNomeUsuario(obterNomeDoUsuario());
    (async () => {
      const res = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await res.json();
      if (empresas.length === 0) return;
      const empresa = empresas[0];
      setEmpresaNome(empresa.nome);
      setComandasHabilitadas(empresa.comandasHabilitadas ?? true);
      const mods: string[] = empresa.modulos ?? [];
      setModulos(mods);

      if (temModulo(mods, "Interesses")) {
        const r = await fetch(`${API_URL}/api/empresas/${empresa.id}/interesses?status=Novo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setInteressesNovos((await r.json()).length ?? 0);
      }

      if (temModulo(mods, "Cobrancas")) {
        const r = await fetch(`${API_URL}/api/empresas/${empresa.id}/contas-receber/resumo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setAReceber((await r.json()).aReceber ?? 0);
      }
    })();
  }, [router]);

  const temInteresses = temModulo(modulos, "Interesses");
  const temVendas = temModulo(modulos, "Vendas");
  const temCobrancas = temModulo(modulos, "Cobrancas");
  const temProdutos = temModulo(modulos, "Produtos");

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-2xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Oi{nomeUsuario ? `, ${nomeUsuario}` : ""}! 👋</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mb-6">O que você quer fazer agora?</p>

        <div className="flex flex-col gap-3">
          {temInteresses && (
            <Link
              href="/interesses"
              className={`${cardStyle} p-5 flex items-center justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors ${
                interessesNovos > 0 ? "border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/30" : ""
              }`}
            >
              <div>
                <div className="text-base font-semibold">💎 Interesses</div>
                <div className="text-sm text-black/50 dark:text-white/50">
                  {interessesNovos > 0
                    ? `${interessesNovos} pessoa${interessesNovos > 1 ? "s" : ""} nova${interessesNovos > 1 ? "s" : ""} esperando resposta`
                    : "Ver quem já demonstrou interesse"}
                </div>
              </div>
              {interessesNovos > 0 && (
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-indigo-600 text-white text-sm font-bold">
                  {interessesNovos}
                </span>
              )}
            </Link>
          )}

          {temVendas && (
            <Link
              href="/vendas?nova=1"
              className={`${cardStyle} p-5 flex items-center justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors`}
            >
              <div>
                <div className="text-base font-semibold">💰 Nova venda</div>
                <div className="text-sm text-black/50 dark:text-white/50">Vender direto, sem passar pelo Story</div>
              </div>
            </Link>
          )}

          {temProdutos && (
            <Link
              href="/produtos"
              className={`${cardStyle} p-5 flex items-center justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors`}
            >
              <div>
                <div className="text-base font-semibold">📸 Criar Story</div>
                <div className="text-sm text-black/50 dark:text-white/50">Divulgar uma peça pra vender</div>
              </div>
            </Link>
          )}

          {temCobrancas && aReceber > 0 && (
            <Link
              href="/cobrancas"
              className={`${cardStyle} p-5 flex items-center justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors`}
            >
              <div>
                <div className="text-base font-semibold">🧾 Cobranças</div>
                <div className="text-sm text-black/50 dark:text-white/50">Tem R$ {aReceber.toFixed(2)} pra receber</div>
              </div>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
