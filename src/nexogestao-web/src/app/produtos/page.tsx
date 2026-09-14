"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Modal from "../_components/Modal";
import PageHeader from "../_components/PageHeader";
import SearchInput from "../_components/SearchInput";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle, badgeEstoque } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";
import { separarNomeEslogan } from "../../lib/modulos";

interface Produto {
  id: number;
  nome: string;
  categoria?: string;
  preco: number;
  custo: number;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
  fotoUrl?: string | null;
  linkStoryToken?: string | null;
  linkStoryAtivo: boolean;
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

const formVazio = { nome: "", categoria: "", preco: "", custo: "", estoque: "", estoqueMinimo: "", fotoUrl: "" };

export default function ProdutosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstoque, setFiltroEstoque] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<"novo" | "editar" | null>(null);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState(formVazio);
  const [storyProduto, setStoryProduto] = useState<Produto | null>(null);
  const [storyFoto, setStoryFoto] = useState<string | null>(null);
  const [storyToken, setStoryToken] = useState<string | null>(null);
  const [storyPreparandoLink, setStoryPreparandoLink] = useState(false);
  const [storySalvandoFoto, setStorySalvandoFoto] = useState(false);
  const [storyBaixando, setStoryBaixando] = useState(false);
  const [storyLinkCopiado, setStoryLinkCopiado] = useState(false);
  const storyPreviewRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarEmpresaEProdutos() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) {
        setErro("Você ainda não tem nenhuma empresa cadastrada.");
        return;
      }
      const primeiraEmpresa = empresas[0];
      setEmpresaId(primeiraEmpresa.id);
      setEmpresaNome(primeiraEmpresa.nome);
      setComandasHabilitadas(primeiraEmpresa.comandasHabilitadas ?? true);

      const resProdutos = await fetch(
        `${API_URL}/api/empresas/${primeiraEmpresa.id}/produtos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (moduloIndisponivel(resProdutos)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }
      const listaProdutos = await resProdutos.json();
      setProdutos(listaProdutos);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEmpresaEProdutos();
  }, []);

  function abrirNovo() {
    setErro(null);
    setForm(formVazio);
    setModalAberto("novo");
  }

  function abrirEdicao(p: Produto) {
    setErro(null);
    setProdutoEditando(p);
    setForm({
      nome: p.nome,
      categoria: p.categoria ?? "",
      preco: String(p.preco),
      custo: String(p.custo),
      estoque: String(p.estoque),
      estoqueMinimo: String(p.estoqueMinimo),
      fotoUrl: p.fotoUrl ?? "",
    });
    setModalAberto("editar");
  }

  function fecharModal() {
    setModalAberto(null);
    setProdutoEditando(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !empresaId) return;
    const token = getToken();
    if (!token) return;

    const editando = modalAberto === "editar" && produtoEditando;
    const url = editando
      ? `${API_URL}/api/empresas/${empresaId}/produtos/${produtoEditando!.id}`
      : `${API_URL}/api/empresas/${empresaId}/produtos`;

    setSalvando(true);
    try {
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: form.nome,
          categoria: form.categoria,
          preco: Number(form.preco),
          custo: Number(form.custo),
          estoque: Number(form.estoque),
          estoqueMinimo: Number(form.estoqueMinimo),
          fotoUrl: form.fotoUrl || null,
        }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar o produto."));
        return;
      }

      fecharModal();
      await carregarEmpresaEProdutos();
    } finally {
      setSalvando(false);
    }
  }

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setForm((f) => ({ ...f, fotoUrl: leitor.result as string }));
    leitor.readAsDataURL(arquivo);
  }

  async function alternarLinkStory(produto: Produto, ativo: boolean) {
    if (!empresaId) return;
    const token = getToken();
    if (!token) return;
    await fetch(`${API_URL}/api/empresas/${empresaId}/produtos/${produto.id}/link-story`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ativo }),
    });
    setStoryProduto((atual) => (atual && atual.id === produto.id ? { ...atual, linkStoryAtivo: ativo } : atual));
    await carregarEmpresaEProdutos();
  }

  // Fluxo único e direto: clicar em "Criar Story" já gera o link (se ainda não
  // existir) e abre a arte pronta pra baixar — sem passos extras pra decidir.
  async function abrirCriarStory(produto: Produto) {
    setErro(null);
    setStoryProduto(produto);
    setStoryFoto(produto.fotoUrl ?? null);
    setStoryToken(produto.linkStoryToken ?? null);
    setStoryLinkCopiado(false);

    if (!produto.linkStoryToken && empresaId) {
      setStoryPreparandoLink(true);
      const token = getToken();
      try {
        const res = await fetch(`${API_URL}/api/empresas/${empresaId}/produtos/${produto.id}/link-story`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStoryToken(data.linkStoryToken);
        }
      } finally {
        setStoryPreparandoLink(false);
      }
      carregarEmpresaEProdutos();
    }
  }

  function fecharStory() {
    setStoryProduto(null);
  }

  function onStoryFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !storyProduto || !empresaId) return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      const dataUrl = leitor.result as string;
      setStoryFoto(dataUrl);
      setStorySalvandoFoto(true);
      const token = getToken();
      try {
        await fetch(`${API_URL}/api/empresas/${empresaId}/produtos/${storyProduto.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            nome: storyProduto.nome,
            categoria: storyProduto.categoria,
            preco: storyProduto.preco,
            custo: storyProduto.custo,
            estoque: storyProduto.estoque,
            estoqueMinimo: storyProduto.estoqueMinimo,
            fotoUrl: dataUrl,
          }),
        });
        await carregarEmpresaEProdutos();
      } finally {
        setStorySalvandoFoto(false);
      }
    };
    leitor.readAsDataURL(arquivo);
  }

  async function baixarStory() {
    if (!storyPreviewRef.current || storyBaixando) return;
    setStoryBaixando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(storyPreviewRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `story-${storyProduto?.nome ?? "produto"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setStoryBaixando(false);
    }
  }

  function copiarStoryLinkAtual() {
    if (!storyToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/interesse/${storyToken}`);
    setStoryLinkCopiado(true);
    setTimeout(() => setStoryLinkCopiado(false), 2000);
  }

  const categorias = Array.from(
    new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))
  ).sort();

  const produtosFiltrados = produtos.filter((p) => {
    const termo = busca.trim().toLowerCase();
    if (termo && !p.nome.toLowerCase().includes(termo)) return false;
    if (filtroCategoria && p.categoria !== filtroCategoria) return false;
    if (filtroEstoque === "sem" && p.estoque > 0) return false;
    if (filtroEstoque === "baixo" && !(p.estoque > 0 && p.estoque <= p.estoqueMinimo)) return false;
    if (filtroEstoque === "ok" && p.estoque <= p.estoqueMinimo) return false;
    return true;
  });

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader
          titulo="Produtos"
          acao={
            <button onClick={abrirNovo} className={botaoPrimario}>
              + Novo produto
            </button>
          }
        />

        {produtos.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome..." className="max-w-xs flex-1" />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className={`${inputStyle} w-40`}
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroEstoque}
              onChange={(e) => setFiltroEstoque(e.target.value)}
              className={`${inputStyle} w-44`}
            >
              <option value="">Qualquer estoque</option>
              <option value="sem">Sem estoque</option>
              <option value="baixo">Estoque baixo</option>
              <option value="ok">Em estoque</option>
            </select>
          </div>
        )}

        {erro && !modalAberto && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <div className={`${cardStyle} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2.5 px-4 font-medium">Nome</th>
                <th className="py-2.5 px-4 font-medium">Categoria</th>
                <th className="py-2.5 px-4 font-medium">Preço</th>
                <th className="py-2.5 px-4 font-medium">Estoque</th>
                <th className="py-2.5 px-4 font-medium">Story</th>
                <th className="py-2.5 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map((p) => {
                const badge = badgeEstoque(p.estoque, p.estoqueMinimo);
                return (
                  <tr key={p.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2.5 px-4">{p.nome}</td>
                    <td className="py-2.5 px-4">{p.categoria}</td>
                    <td className="py-2.5 px-4">R$ {p.preco.toFixed(2)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={p.estoque < 0 ? "text-red-600 font-medium" : ""}>{p.estoque}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.classe}`}>
                          {badge.texto}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => abrirCriarStory(p)} className={`${botaoTexto} whitespace-nowrap`}>
                        📸 Criar Story
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button onClick={() => abrirEdicao(p)} className={botaoTexto}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {produtosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando
                      ? "Carregando..."
                      : produtos.length === 0
                      ? "Nenhum produto cadastrado."
                      : "Nenhum produto encontrado pra esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {modalAberto && (
        <Modal
          titulo={modalAberto === "novo" ? "Novo produto" : `Editar ${produtoEditando?.nome}`}
          onFechar={fecharModal}
        >
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                autoFocus
                className={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Foto (opcional, usada na Story)</label>
              <div className="flex items-center gap-3">
                {form.fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.fotoUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-black/10 dark:border-white/10" />
                )}
                <input type="file" accept="image/*" onChange={onFotoChange} className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Categoria</label>
              <input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className={inputStyle}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Preço</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Custo</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.custo}
                  onChange={(e) => setForm({ ...form, custo: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Estoque</label>
                <input
                  type="number"
                  value={form.estoque}
                  onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Estoque mín.</label>
                <input
                  type="number"
                  value={form.estoqueMinimo}
                  onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <button type="button" onClick={fecharModal} className="h-10 px-3 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className={botaoPrimario}>
                {salvando ? "Salvando..." : "Salvar produto"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {storyProduto && (
        <Modal titulo="Criar Story" onFechar={fecharStory}>
          <div className="flex flex-col items-center gap-3">
            <div
              ref={storyPreviewRef}
              className="w-full max-w-[220px] aspect-[9/16] rounded-xl overflow-hidden relative flex flex-col justify-end text-center px-5 py-6"
              style={{ background: "linear-gradient(160deg,#1e1b3a,#0f0d1f)", color: "#fff" }}
            >
              {storyFoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={storyFoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(15,13,31,0.95) 100%)" }}
                  />
                </>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-6xl">💎</span>
              )}
              <div className="relative z-10 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide opacity-80">{separarNomeEslogan(empresaNome).nome}</span>
                <span className="text-lg font-bold leading-tight">{storyProduto.nome}</span>
                <span className="text-2xl font-extrabold text-indigo-300">R$ {storyProduto.preco.toFixed(2)}</span>
                <span className="text-xs font-medium opacity-90 mt-1">Gostou? 💎 Toque no link para garantir o seu</span>
              </div>
            </div>

            <label className="text-sm font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer">
              {storySalvandoFoto ? "Salvando foto..." : storyFoto ? "Trocar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" onChange={onStoryFotoChange} className="hidden" disabled={storySalvandoFoto} />
            </label>

            <ol className="w-full text-sm text-black/70 dark:text-white/70 list-decimal list-inside flex flex-col gap-0.5 bg-black/[0.03] dark:bg-white/5 rounded-lg px-4 py-3 mt-1">
              <li>Baixe a imagem</li>
              <li>Publique no seu Story</li>
              <li>Adicione o link copiado</li>
            </ol>

            <div className="flex flex-col gap-1 w-full mt-1">
              <button onClick={baixarStory} disabled={storyBaixando} className={`${botaoPrimario} w-full`}>
                {storyBaixando ? "Gerando imagem..." : "Baixar imagem"}
              </button>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <button
                onClick={copiarStoryLinkAtual}
                disabled={storyPreparandoLink || !storyToken}
                className={`${botaoSecundario} w-full`}
              >
                {storyPreparandoLink ? "Preparando link..." : storyLinkCopiado ? "Link copiado!" : "Copiar link"}
              </button>
              <span className="text-xs text-black/40 dark:text-white/40 text-center">
                Cole este link no adesivo de link do Instagram.
              </span>
            </div>

            <button
              onClick={() => alternarLinkStory(storyProduto, !storyProduto.linkStoryAtivo)}
              className="text-xs text-black/40 dark:text-white/40 underline"
            >
              {storyProduto.linkStoryAtivo ? "Desativar este link" : "Ativar este link de novo"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
