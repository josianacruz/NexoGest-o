"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "../_components/ThemeToggle";
import { separarNomeEslogan } from "../../lib/modulos";
import { EmpresaProvider, useEmpresa, type Avisos } from "./EmpresaContext";
import { SUAVE } from "./tokens";

interface Item {
  chave: string | null; // módulo exigido (null = sempre aparece)
  rotulo: string;
  href: string;
  icone: string;
  aviso?: keyof Avisos; // número vermelho/lilás ao lado do item
}

// Os 12 botões do cabeçalho antigo, agrupados por o que a pessoa quer fazer.
const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Hoje",
    itens: [
      { chave: null, rotulo: "Início", href: "/inicio", icone: "🏠" },
      { chave: "Agenda", rotulo: "Agenda", href: "/agenda", icone: "📅" },
      { chave: "Agenda", rotulo: "Avisos", href: "/notificacoes", icone: "🔔", aviso: "naoLidas" },
      { chave: "Clientes", rotulo: "Clientes", href: "/clientes", icone: "👥" },
    ],
  },
  {
    titulo: "Vender",
    itens: [
      { chave: "Vendas", rotulo: "Vendas", href: "/vendas", icone: "🛍️" },
      { chave: "Comandas", rotulo: "Comandas", href: "/comandas", icone: "🧾" },
      { chave: "Cobrancas", rotulo: "Cobranças", href: "/cobrancas", icone: "💰", aviso: "vencidas" },
      { chave: "Interesses", rotulo: "Interesses", href: "/interesses", icone: "💬", aviso: "interessesNovos" },
      { chave: "Produtos", rotulo: "Produtos", href: "/produtos", icone: "📦" },
    ],
  },
  {
    titulo: "Divulgar",
    itens: [
      { chave: "Marketing", rotulo: "Marketing", href: "/marketing", icone: "📣" },
      { chave: "Afiliados", rotulo: "Afiliados", href: "/afiliados", icone: "🎥" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { chave: "Servicos", rotulo: "Serviços", href: "/servicos", icone: "✂️" },
      { chave: "Financeiro", rotulo: "Relatórios", href: "/relatorios", icone: "📊" },
      { chave: null, rotulo: "Configurações", href: "/configuracoes", icone: "⚙️" },
    ],
  },
];

function Menu({ recolhido, aoNavegar }: { recolhido: boolean; aoNavegar?: () => void }) {
  const pathname = usePathname();
  const { empresa, avisos } = useEmpresa();
  const modulos = empresa?.modulos ?? [];

  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 pb-4">
      {GRUPOS.map((g) => {
        const itens = g.itens.filter((i) => i.chave === null || (modulos.includes(i.chave) && (i.chave !== "Comandas" || empresa?.comandasHabilitadas)));
        if (itens.length === 0) return null;
        return (
          <div key={g.titulo}>
            {!recolhido && <p className={SUAVE.grupoMenu}>{g.titulo}</p>}
            {recolhido && <div className="my-2 h-px bg-slate-200 dark:bg-slate-700" />}
            <ul className="space-y-1">
              {itens.map((i) => {
                const ativo = pathname === i.href;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={aoNavegar}
                      title={recolhido ? i.rotulo : undefined}
                      aria-current={ativo ? "page" : undefined}
                      className={`${ativo ? SUAVE.itemMenuAtivo : SUAVE.itemMenu} relative ${recolhido ? "justify-center px-0" : ""}`}
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {i.icone}
                      </span>
                      {!recolhido && <span className="flex-1">{i.rotulo}</span>}
                      {i.aviso && avisos[i.aviso] > 0 && (
                        <span className={`${recolhido ? "absolute right-2 top-1" : ""} grid min-w-5 place-items-center rounded-full bg-rose-200 px-1.5 text-[11px] font-bold leading-5 text-rose-950 dark:bg-rose-400/30 dark:text-rose-50`} aria-label={`${avisos[i.aviso]} novos`}>
                          {avisos[i.aviso]}
                        </span>
                      )}
                      {recolhido && <span className="sr-only">{i.rotulo}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Estrutura({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { empresa, carregando, erro } = useEmpresa();
  const [recolhido, setRecolhido] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem("nexo_menu_recolhido") === "1");
    } catch {
      /* sem localStorage: começa aberto */
    }
  }, []);

  function alternarMenu() {
    setRecolhido((v) => {
      try {
        localStorage.setItem("nexo_menu_recolhido", v ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }

  function sair() {
    localStorage.removeItem("nexo_token");
    router.push("/login");
  }

  const nome = empresa ? separarNomeEslogan(empresa.nome) : null;

  return (
    <div className={`flex min-h-screen ${SUAVE.pagina}`}>
      {/* Menu lateral fixo (computador) */}
      <aside className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col transition-[width] duration-200 ${recolhido ? "w-[76px]" : "w-64"} ${SUAVE.lateral}`}>
        <div className={`flex items-center gap-2 px-4 py-4 ${recolhido ? "justify-center" : "justify-between"}`}>
          {!recolhido && <span className="text-lg font-bold tracking-tight">NexoGestão</span>}
          <button
            type="button"
            onClick={alternarMenu}
            aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {recolhido ? "»" : "«"}
          </button>
        </div>
        <Menu recolhido={recolhido} />
      </aside>

      {/* Menu em gaveta (celular) */}
      {gavetaAberta && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar o menu" className="absolute inset-0 bg-slate-900/40" onClick={() => setGavetaAberta(false)} />
          <div className={`relative flex h-full w-72 max-w-[85%] flex-col shadow-xl ${SUAVE.lateral} bg-white dark:bg-slate-800`}>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-lg font-bold tracking-tight">NexoGestão</span>
              <button type="button" onClick={() => setGavetaAberta(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                ✕
              </button>
            </div>
            <Menu recolhido={false} aoNavegar={() => setGavetaAberta(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-slate-50/85 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85 sm:px-6">
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir o menu"
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-lg shadow-sm dark:bg-slate-800 md:hidden"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{nome?.nome ?? "NexoGestão"}</p>
            {nome?.slogan && <p className={`truncate text-xs ${SUAVE.textoFraco}`}>{nome.slogan}</p>}
          </div>
          <ThemeToggle suave />
          <button type="button" onClick={sair} className={`${SUAVE.botaoSecundario} !px-4 !py-2`}>
            Sair
          </button>
        </header>

        {/* Cada tela traz o próprio <main> (largura e margens). */}
        <div className="w-full flex-1">
          {carregando ? <main className={`mx-auto max-w-5xl px-4 py-6 ${SUAVE.textoSuave}`}>Carregando…</main> : erro ? <main className="mx-auto max-w-5xl px-4 py-6 text-rose-700 dark:text-rose-300">{erro}</main> : children}
        </div>
      </div>
    </div>
  );
}

export default function ShellSuave({ children }: { children: React.ReactNode }) {
  return (
    <EmpresaProvider>
      <Estrutura>{children}</Estrutura>
    </EmpresaProvider>
  );
}
