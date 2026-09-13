"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { botaoPrimario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
}

export default function TabelaServicosPage() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [baixando, setBaixando] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) return;
      setEmpresaNome(empresas[0].nome);
      setComandasHabilitadas(empresas[0].comandasHabilitadas ?? true);

      const resServicos = await fetch(`${API_URL}/api/empresas/${empresas[0].id}/servicos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lista = await resServicos.json();
      setServicos(lista);
      setSelecionados(lista.map((s: Servico) => s.id));
    })();
  }, [router]);

  function alternarServico(id: number) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  const itensSelecionados = servicos.filter((s) => selecionados.includes(s.id));

  async function baixarTabela() {
    if (!previewRef.current) return;
    setBaixando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "tabela-servicos.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Tabela de serviços e valores" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className={`${cardStyle} p-5`}>
              <h2 className="text-sm font-semibold mb-3">Serviços cadastrados</h2>
              <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                {servicos.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.includes(s.id)}
                      onChange={() => alternarServico(s.id)}
                      className="accent-indigo-600"
                    />
                    <span className="flex-1">
                      {s.nome} <span className="text-black/40 dark:text-white/40">({s.duracaoMinutos} min)</span>
                    </span>
                    <span className="text-black/50 dark:text-white/50">R$ {s.preco.toFixed(2)}</span>
                  </label>
                ))}
                {servicos.length === 0 && (
                  <p className="text-sm text-black/40 dark:text-white/40 py-2">Nenhum serviço cadastrado.</p>
                )}
              </div>
            </div>

            <button onClick={baixarTabela} disabled={baixando || itensSelecionados.length === 0} className={botaoPrimario}>
              {baixando ? "Gerando..." : "Baixar tabela"}
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div
              ref={previewRef}
              className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-black text-white rounded-xl p-6 flex flex-col gap-3"
            >
              <h1 className="text-xl font-bold text-center">{empresaNome || "Serviços"}</h1>

              {itensSelecionados.length === 0 && (
                <p className="text-sm text-center opacity-60 py-8">Selecione serviços para montar a tabela.</p>
              )}

              <div className="flex flex-col gap-1.5">
                {itensSelecionados.map((s) => (
                  <div key={s.id} className="flex justify-between items-baseline gap-2 text-sm border-b border-white/10 pb-1.5">
                    <div>
                      <div className="font-medium">{s.nome}</div>
                      <div className="text-xs opacity-60">{s.duracaoMinutos} min</div>
                    </div>
                    <div className="font-semibold whitespace-nowrap">R$ {s.preco.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-black/40 dark:text-white/40 mt-2">Pré-visualização da tabela</p>
          </div>
        </div>
      </main>
    </>
  );
}
