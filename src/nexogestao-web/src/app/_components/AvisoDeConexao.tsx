"use client";

import { useEffect, useState } from "react";
import { EVENTO_REDE, mensagemDeRede, type TipoFalhaDeRede } from "../../lib/api";

// Faixa que aparece no topo quando o celular perde a internet ou o servidor não responde, e some sozinha quando volta.
// Não bloqueia nada: só avisa que o que foi digitado continua na tela.
export default function AvisoDeConexao({ estilo = "suave" }: { estilo?: "suave" | "chic" }) {
  const [falha, setFalha] = useState<TipoFalhaDeRede | null>(null);

  useEffect(() => {
    const aoMudar = (e: Event) => {
      const d = (e as CustomEvent<{ ok: boolean; tipo?: TipoFalhaDeRede }>).detail;
      setFalha(d.ok ? null : (d.tipo ?? "sem-conexao"));
    };
    const caiu = () => setFalha("sem-conexao");
    const voltou = () => setFalha(null);
    window.addEventListener(EVENTO_REDE, aoMudar);
    window.addEventListener("offline", caiu);
    window.addEventListener("online", voltou);
    if (!navigator.onLine) caiu();
    return () => {
      window.removeEventListener(EVENTO_REDE, aoMudar);
      window.removeEventListener("offline", caiu);
      window.removeEventListener("online", voltou);
    };
  }, []);

  if (!falha) return null;
  const cor = estilo === "chic" ? "bg-[#FBE9EB] text-[#7A2631] border-[#E7B9BF]" : "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-400/20 dark:text-amber-50 dark:border-amber-400/40";
  return (
    <div role="status" aria-live="polite" className={`sticky top-0 z-[60] border-b px-4 py-2 text-center text-sm font-medium ${cor}`}>
      {mensagemDeRede(falha)}
    </div>
  );
}
