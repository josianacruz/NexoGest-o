"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const linksBase = [
  { href: "/clientes", label: "Clientes" },
  { href: "/produtos", label: "Produtos" },
  { href: "/vendas", label: "Vendas" },
];

export default function Nav({
  empresaNome,
  comandasHabilitadas = true,
}: {
  empresaNome?: string;
  comandasHabilitadas?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const links = comandasHabilitadas
    ? [...linksBase, { href: "/comandas", label: "Comandas" }]
    : linksBase;

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
                  className={`shrink-0 h-9 px-3 inline-flex items-center rounded-lg text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-indigo-600 text-white"
                      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {link.label}
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
