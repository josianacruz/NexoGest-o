"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

const frasesSugeridas = ["Só hoje!", "Oferta especial!", "Promoção!", "Aproveite!"];

export default function CriarPromocaoPage() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [nomeProduto, setNomeProduto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoNormal, setPrecoNormal] = useState("");
  const [precoPromo, setPrecoPromo] = useState("");
  const [frase, setFrase] = useState("Só hoje!");
  const [foto, setFoto] = useState<string | null>(null);
  const [formato, setFormato] = useState<"quadrado" | "story">("quadrado");
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

  function selecionarProduto(id: string) {
    setProdutoSelecionado(id);
    const produto = produtos.find((p) => p.id === Number(id));
    if (produto) {
      setNomeProduto(produto.nome);
      setPrecoNormal(String(produto.preco));
    }
  }

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setFoto(leitor.result as string);
    leitor.readAsDataURL(arquivo);
  }

  async function baixarImagem() {
    if (!previewRef.current) return;
    setBaixando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `promocao-${nomeProduto || "arte"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setBaixando(false);
    }
  }

  const dimensoes = formato === "quadrado" ? "aspect-square" : "aspect-[9/16]";

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Criar Promoção" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className={`${cardStyle} p-5 flex flex-col gap-3`}>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Produto cadastrado (opcional)</label>
              <select
                value={produtoSelecionado}
                onChange={(e) => selecionarProduto(e.target.value)}
                className={inputStyle}
              >
                <option value="">Digitar manualmente</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Nome do produto</label>
              <input
                value={nomeProduto}
                onChange={(e) => setNomeProduto(e.target.value)}
                placeholder="Ex: X-Bacon"
                className={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pão, carne, bacon e queijo"
                className={inputStyle}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Preço normal (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={precoNormal}
                  onChange={(e) => setPrecoNormal(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Preço promocional</label>
                <input
                  type="number"
                  step="0.01"
                  value={precoPromo}
                  onChange={(e) => setPrecoPromo(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Frase promocional</label>
              <input
                value={frase}
                onChange={(e) => setFrase(e.target.value)}
                list="frases-sugeridas"
                className={inputStyle}
              />
              <datalist id="frases-sugeridas">
                {frasesSugeridas.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Foto (opcional)</label>
              <input type="file" accept="image/*" onChange={onFotoChange} className="text-sm" />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Formato</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormato("quadrado")}
                  className={formato === "quadrado" ? botaoPrimario : botaoSecundario}
                >
                  Post quadrado
                </button>
                <button
                  type="button"
                  onClick={() => setFormato("story")}
                  className={formato === "story" ? botaoPrimario : botaoSecundario}
                >
                  Story/Status
                </button>
              </div>
            </div>

            <button
              onClick={baixarImagem}
              disabled={baixando || !nomeProduto || !precoPromo}
              className={`${botaoPrimario} mt-2`}
            >
              {baixando ? "Gerando..." : "Baixar imagem"}
            </button>
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center">
            <div
              ref={previewRef}
              className={`w-full max-w-sm ${dimensoes} bg-gradient-to-br from-indigo-700 to-indigo-950 text-white rounded-xl overflow-hidden flex flex-col p-6 relative`}
            >
              <span className="text-xs font-semibold tracking-wide opacity-80">{empresaNome}</span>

              {foto && (
                <div className="flex-1 min-h-0 mt-3 rounded-lg overflow-hidden bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="mt-auto pt-4 flex flex-col gap-1">
                {frase && (
                  <span className="inline-block w-fit bg-white text-indigo-700 text-xs font-bold px-2 py-1 rounded mb-1">
                    {frase}
                  </span>
                )}
                <h2 className="text-2xl font-bold leading-tight">{nomeProduto || "Nome do produto"}</h2>
                {descricao && <p className="text-sm opacity-80">{descricao}</p>}
                <div className="flex items-baseline gap-2 mt-2">
                  {precoNormal && precoPromo && Number(precoNormal) > Number(precoPromo) && (
                    <span className="text-sm line-through opacity-60">
                      R$ {Number(precoNormal).toFixed(2)}
                    </span>
                  )}
                  <span className="text-3xl font-extrabold">
                    {precoPromo ? `R$ ${Number(precoPromo).toFixed(2)}` : "R$ 0,00"}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-black/40 dark:text-white/40 mt-2">Pré-visualização da arte</p>
          </div>
        </div>
      </main>
    </>
  );
}
