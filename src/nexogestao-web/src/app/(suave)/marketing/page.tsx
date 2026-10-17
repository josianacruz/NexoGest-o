"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";
import { temModulo } from "../../../lib/modulos";
import { escolherEmpresa } from "../../../lib/empresaAtiva";

export default function MarketingPage() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [temProdutos, setTemProdutos] = useState(true);
  const [temServicos, setTemServicos] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      const res = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await res.json();
      if (empresas.length > 0) {
        setEmpresaNome(escolherEmpresa(empresas).nome);
        setComandasHabilitadas(escolherEmpresa(empresas).comandasHabilitadas ?? true);
        setTemProdutos(temModulo(escolherEmpresa(empresas).modulos ?? [], "Produtos"));
        setTemServicos(temModulo(escolherEmpresa(empresas).modulos ?? [], "Servicos"));
      }
    })();
  }, [router]);

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Marketing" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/marketing/promocao"
            className={`${cardStyle} p-6 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all`}
          >
            <div className="text-3xl mb-2">🏷️</div>
            <h2 className="font-semibold mb-1">Criar Promoção</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              Monte uma arte de promoção com preço, foto e frase de destaque.
            </p>
          </Link>

          {temProdutos ? (
            <Link
              href="/marketing/cardapio"
              className={`${cardStyle} p-6 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all`}
            >
              <div className="text-3xl mb-2">📋</div>
              <h2 className="font-semibold mb-1">Criar Cardápio</h2>
              <p className="text-sm text-black/60 dark:text-white/60">
                Gere uma imagem de cardápio a partir dos seus produtos cadastrados.
              </p>
            </Link>
          ) : null}

          {temServicos && (
            <>
              <Link
                href="/marketing/tabela-servicos"
                className={`${cardStyle} p-6 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all`}
              >
                <div className="text-3xl mb-2">📋</div>
                <h2 className="font-semibold mb-1">Cardápio de serviços</h2>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Seus serviços e valores em imagem, PDF ou link para enviar às clientes.
                </p>
              </Link>
              <Link
                href="/marketing/story-servico"
                className={`${cardStyle} p-6 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all`}
              >
                <div className="text-3xl mb-2">✨</div>
                <h2 className="font-semibold mb-1">Story de um serviço</h2>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Escolha o serviço, coloque um preço especial e baixe o Story pronto (1080 x 1920).
                </p>
              </Link>
              <Link
                href="/marketing/horario-disponivel"
                className={`${cardStyle} p-6 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all`}
              >
                <div className="text-3xl mb-2">📅</div>
                <h2 className="font-semibold mb-1">Divulgar horário disponível</h2>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Avise que vagou um horário, com link/QR pro cliente agendar direto.
                </p>
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
