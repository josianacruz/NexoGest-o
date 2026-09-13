"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";
import { MODULOS_MENU, temModulo } from "../../lib/modulos";

export default function Nav({
  empresaNome,
  comandasHabilitadas = true,
}: {
  empresaNome?: string;
  comandasHabilitadas?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [quantidadeVencidas, setQuantidadeVencidas] = useState(0);
  // Enquanto os módulos ainda não carregaram, não mostra nenhum — mostrar
  // tudo de início deixava módulos desabilitados visíveis por um instante
  // (e presos até o próximo fetch, se a requisição demorasse).
  const [modulos, setModulos] = useState<string[] | null>(null);

  const links = (modulos ?? [])
    .map((chave) => MODULOS_MENU.find((m) => m.chave === chave))
    .filter((m): m is (typeof MODULOS_MENU)[number] => !!m)
    .filter((m) => m.chave !== "Comandas" || comandasHabilitadas);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (!token) return;

    (async () => {
      try {
        const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resEmpresas.ok) return;
        const empresas = await resEmpresas.json();
        if (empresas.length === 0) return;

        setModulos(empresas[0].modulos ?? []);

        if (!temModulo(empresas[0].modulos ?? [], "Cobrancas")) return;

        const resResumo = await fetch(
          `${API_URL}/api/empresas/${empresas[0].id}/contas-receber/resumo`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resResumo.ok) return;
        const resumo = await resResumo.json();
        setQuantidadeVencidas(resumo.quantidadeVencidas ?? 0);
      } catch {
        // Aviso de cobrança é só um extra — falha silenciosa não deve travar a navegação.
      }
    })();
  }, []);

  function sair() {
    localStorage.removeItem("nexo_token");
    router.push("/login");
  }

  return (
    <nav className="border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <span className="font-semibold tracking-tight shrink-0">NexoGestão</span>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {links.map((link) => {
              const ativo = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative shrink-0 h-9 px-3 inline-flex items-center rounded-lg text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-indigo-600 text-white"
                      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {link.label}
                  {link.href === "/cobrancas" && quantidadeVencidas > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                      {quantidadeVencidas}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          {empresaNome && (
            <span className="hidden sm:inline text-black/50 dark:text-white/50 truncate max-w-[140px]">
              {empresaNome}
            </span>
          )}
          <button
            onClick={sair}
            className="h-9 px-3 inline-flex items-center rounded-lg text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 font-medium"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
