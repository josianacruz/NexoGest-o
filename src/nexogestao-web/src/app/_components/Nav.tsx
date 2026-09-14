"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";
import { MODULOS_MENU, temModulo } from "../../lib/modulos";

// Ids de empresa configuradas pra ficar sempre no modo claro (pedido pontual
// de identidade visual). Fica por Id — nome é dado editável do usuário e não
// deve decidir comportamento do sistema.
const EMPRESAS_TEMA_CLARO = [3];

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
  const [naoLidas, setNaoLidas] = useState(0);
  const [interessesNovos, setInteressesNovos] = useState(0);
  // Enquanto os módulos ainda não carregaram, não mostra nenhum — mostrar
  // tudo de início deixava módulos desabilitados visíveis por um instante
  // (e presos até o próximo fetch, se a requisição demorasse).
  const [modulos, setModulos] = useState<string[] | null>(null);

  // Ordem sempre a de MODULOS_MENU (pensada pro fluxo mais comum primeiro),
  // não a ordem em que o backend devolve — só filtra o que está habilitado.
  const links = MODULOS_MENU.filter(
    (m) => (modulos ?? []).includes(m.chave) && (m.chave !== "Comandas" || comandasHabilitadas)
  );

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

        // Modo claro travado só pra essa empresa (por Id, nunca por nome —
        // o nome é dado editável do usuário) — não mexe no tema de mais
        // ninguém, que continua seguindo a preferência do aparelho.
        const claroForcado = EMPRESAS_TEMA_CLARO.includes(empresas[0].id);
        localStorage.setItem("nexo_tema_claro_forcado", claroForcado ? "1" : "0");
        if (claroForcado) document.documentElement.classList.remove("dark");

        if (temModulo(empresas[0].modulos ?? [], "Agenda")) {
          const resNotificacoes = await fetch(
            `${API_URL}/api/empresas/${empresas[0].id}/notificacoes/nao-lidas`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (resNotificacoes.ok) {
            const dadosNotificacoes = await resNotificacoes.json();
            setNaoLidas(dadosNotificacoes.quantidade ?? 0);
          }
        }

        if (temModulo(empresas[0].modulos ?? [], "Interesses")) {
          const resInteresses = await fetch(
            `${API_URL}/api/empresas/${empresas[0].id}/interesses?status=Novo`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (resInteresses.ok) setInteressesNovos((await resInteresses.json()).length ?? 0);
        }

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
      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0">
          <span className="font-semibold tracking-tight shrink-0">NexoGestão</span>
          <div className="flex flex-wrap gap-1">
            <Link
              href="/inicio"
              className={`shrink-0 h-9 px-3 inline-flex items-center rounded-lg text-sm font-medium transition-colors ${
                pathname === "/inicio"
                  ? "bg-indigo-600 text-white"
                  : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              Início
            </Link>
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
                  {link.href === "/interesses" && interessesNovos > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      {interessesNovos}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          {modulos !== null && temModulo(modulos, "Agenda") && (
            <Link href="/notificacoes" className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-lg" title="Notificações">
              🔔
              {naoLidas > 0 && (
                <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {naoLidas}
                </span>
              )}
            </Link>
          )}
          {empresaNome && (
            <span className="flex items-baseline gap-1.5 truncate max-w-[220px]">
              <span className="font-medium text-black/70 dark:text-white/70 truncate">{empresaNome.split(" | ")[0]}</span>
              {empresaNome.includes(" | ") && (
                <span className="text-black/40 dark:text-white/40 text-xs truncate">{empresaNome.split(" | ")[1]}</span>
              )}
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
