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
      <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">NexoGestão</span>
          <div className="flex gap-1">
            {links.map((link) => {
              const ativo = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
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
        <div className="flex items-center gap-3 text-sm">
          {empresaNome && <span className="text-black/50 dark:text-white/50">{empresaNome}</span>}
          <button
            onClick={sair}
            className="px-3 py-1.5 rounded-md text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
