"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface Produto {
  id: number;
  nome: string;
  categoria?: string;
  preco: number;
}

interface ItemCardapio {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  categoria: string;
}

export default function CriarCardapioPage() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [itensManuais, setItensManuais] = useState<ItemCardapio[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
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

      const resProdutos = await fetch(`${API_URL}/api/empresas/${empresas[0].id}/produtos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProdutos(await resProdutos.json());
    })();
  }, [router]);

  function alternarProduto(id: number) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  function adicionarManual() {
    if (!novoNome.trim() || !novoPreco) return;
    setItensManuais([
      ...itensManuais,
      {
        id: `manual-${Date.now()}`,
        nome: novoNome.trim(),
        descricao: novaDescricao.trim() || undefined,
        preco: Number(novoPreco),
        categoria: novaCategoria.trim() || "Outros",
      },
    ]);
    setNovoNome("");
    setNovaDescricao("");
    setNovoPreco("");
    setNovaCategoria("");
  }

  function removerManual(id: string) {
    setItensManuais(itensManuais.filter((i) => i.id !== id));
  }

  const itensDoCatalogo: ItemCardapio[] = produtos
    .filter((p) => selecionados.includes(p.id))
    .map((p) => ({ id: `produto-${p.id}`, nome: p.nome, preco: p.preco, categoria: p.categoria || "Outros" }));

  const todosItens = [...itensDoCatalogo, ...itensManuais];

  const porCategoria = todosItens.reduce<Record<string, ItemCardapio[]>>((acc, item) => {
    (acc[item.categoria] ??= []).push(item);
    return acc;
  }, {});

  async function baixarCardapio() {
    if (!previewRef.current) return;
    setBaixando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "cardapio.png";
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
        <PageHeader titulo="Criar Cardápio" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="flex flex-col gap-4">
            <div className={`${cardStyle} p-5`}>
              <h2 className="text-sm font-semibold mb-3">Produtos cadastrados</h2>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {produtos.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.includes(p.id)}
                      onChange={() => alternarProduto(p.id)}
                      className="accent-indigo-600"
                    />
                    <span className="flex-1">{p.nome}</span>
                    <span className="text-black/50 dark:text-white/50">R$ {p.preco.toFixed(2)}</span>
                  </label>
                ))}
                {produtos.length === 0 && (
                  <p className="text-sm text-black/40 dark:text-white/40 py-2">Nenhum produto cadastrado.</p>
                )}
              </div>
            </div>

            <div className={`${cardStyle} p-5`}>
              <h2 className="text-sm font-semibold mb-3">Adicionar item manual</h2>
              <div className="flex flex-col gap-2">
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome do item"
                  className={inputStyle}
                />
                <input
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className={inputStyle}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={novoPreco}
                    onChange={(e) => setNovoPreco(e.target.value)}
                    placeholder="Preço"
                    className={`${inputStyle} flex-1`}
                  />
                  <input
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    placeholder="Categoria"
                    className={`${inputStyle} flex-1`}
                  />
                </div>
                <button onClick={adicionarManual} disabled={!novoNome.trim() || !novoPreco} className={botaoSecundario}>
                  + Adicionar item
                </button>
              </div>

              {itensManuais.length > 0 && (
                <div className="flex flex-col gap-1 mt-3">
                  {itensManuais.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{item.nome}</span>
                      <button onClick={() => removerManual(item.id)} className={botaoTexto}>
                        remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={baixarCardapio}
              disabled={baixando || todosItens.length === 0}
              className={botaoPrimario}
            >
              {baixando ? "Gerando..." : "Baixar cardápio"}
            </button>
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center">
            <div
              ref={previewRef}
              className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-black text-white rounded-xl p-6 flex flex-col gap-4"
            >
              <h1 className="text-xl font-bold text-center">{empresaNome || "Cardápio"}</h1>

              {Object.keys(porCategoria).length === 0 && (
                <p className="text-sm text-center opacity-60 py-8">Selecione produtos para montar o cardápio.</p>
              )}

              {Object.entries(porCategoria).map(([categoria, itens]) => (
                <div key={categoria}>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-300 mb-1.5 border-b border-white/20 pb-1">
                    {categoria}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {itens.map((item) => (
                      <div key={item.id} className="flex justify-between items-start gap-2 text-sm">
                        <div>
                          <div className="font-medium">{item.nome}</div>
                          {item.descricao && <div className="text-xs opacity-60">{item.descricao}</div>}
                        </div>
                        <div className="font-semibold whitespace-nowrap">R$ {item.preco.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-black/40 dark:text-white/40 mt-2">Pré-visualização do cardápio</p>
          </div>
        </div>
      </main>
    </>
  );
}
