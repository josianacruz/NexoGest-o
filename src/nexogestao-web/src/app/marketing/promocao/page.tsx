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

interface Paleta {
  background: string;
  surface: string;
  accent: string;
  text: string;
  mutedText: string;
}

// Paleta usada quando não há foto (ou a extração falha) — elegante, na linha
// visual roxa do NexoGestão, sem virar o antigo card roxo genérico.
const PALETA_PADRAO: Paleta = {
  background: "#1e1b3a",
  surface: "#2f2a54",
  accent: "#a78bfa",
  text: "#ffffff",
  mutedText: "rgba(255,255,255,0.65)",
};

const frasesSugeridas = ["Só hoje!", "Oferta especial!", "Promoção!", "Aproveite!"];

function hexParaRgb(hex: string) {
  const h = hex.replace("#", "");
  const norm = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(norm, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbParaHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function misturarCores(hexA: string, hexB: string, t: number) {
  const a = hexParaRgb(hexA);
  const b = hexParaRgb(hexB);
  return rgbParaHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// Fórmula de luminância relativa (WCAG) pra decidir se um texto em cima dessa
// cor deve ser claro ou escuro, garantindo contraste legível.
function corDeContraste(hex: string) {
  const { r, g, b } = hexParaRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminancia = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  return luminancia > 0.5 ? "#000000" : "#ffffff";
}

function formatarPrecoBr(valor: string) {
  const n = Number(valor);
  if (!valor || Number.isNaN(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
  const [paleta, setPaleta] = useState<Paleta>(PALETA_PADRAO);
  const previewRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLImageElement>(null);
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
    if (!arquivo) {
      setFoto(null);
      setPaleta(PALETA_PADRAO);
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setFoto(leitor.result as string);
    leitor.readAsDataURL(arquivo);
  }

  // Roda no navegador assim que a foto termina de carregar — extrai as cores
  // predominantes da própria imagem e monta a paleta da arte automaticamente.
  async function extrairPaletaDaFoto() {
    if (!fotoRef.current) return;
    try {
      const { getSwatchesSync } = await import("colorthief");
      const swatches = getSwatchesSync(fotoRef.current, { colorCount: 8 });

      const escura = swatches.DarkMuted?.color ?? swatches.DarkVibrant?.color ?? swatches.Muted?.color;
      const vibrante =
        swatches.Vibrant?.color ?? swatches.LightVibrant?.color ?? swatches.DarkVibrant?.color ?? escura;

      if (!escura || !vibrante) {
        setPaleta(PALETA_PADRAO);
        return;
      }

      const background = escura.hex();
      const accent = vibrante.hex();
      const text = escura.textColor;

      setPaleta({
        background,
        surface: misturarCores(background, accent, 0.25),
        accent,
        text,
        mutedText: text === "#ffffff" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
      });
    } catch {
      // Se a extração falhar por qualquer motivo, mantém a arte com a paleta padrão.
      setPaleta(PALETA_PADRAO);
    }
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
              className={`w-full max-w-sm ${dimensoes} overflow-hidden relative flex flex-col`}
              style={
                foto
                  ? { background: paleta.background }
                  : { backgroundImage: `linear-gradient(160deg, ${paleta.surface}, ${paleta.background})` }
              }
            >
              {/* Foto ocupa ~60% da arte — o resto é sempre reservado pras informações,
                  então o texto nunca fica espremido no rodapé. */}
              {foto && (
                <div className="relative shrink-0 overflow-hidden" style={{ height: "60%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={fotoRef}
                    src={foto}
                    alt=""
                    crossOrigin="anonymous"
                    onLoad={extrairPaletaDaFoto}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Transição suave entre a foto e o fundo da arte, pra foto parecer parte da composição */}
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(to bottom, transparent 45%, ${paleta.background} 100%)` }}
                  />
                </div>
              )}

              <span
                className="absolute top-4 left-4 text-xs font-semibold tracking-wide"
                style={{ color: paleta.text }}
              >
                {empresaNome}
              </span>

              {/* Bloco de informações: ocupa o espaço restante e centraliza o
                  conteúdo verticalmente, então funciona com ou sem descrição/preço
                  antigo e com nomes de produto de uma ou duas linhas. */}
              <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-6 py-5">
                {frase && (
                  <span
                    className="inline-block w-fit text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 mb-1"
                    style={{ background: paleta.accent, color: corDeContraste(paleta.accent) }}
                  >
                    {frase}
                  </span>
                )}
                <h2 className="text-2xl font-bold leading-tight" style={{ color: paleta.text }}>
                  {nomeProduto || "Nome do produto"}
                </h2>
                {descricao && (
                  <p className="text-sm" style={{ color: paleta.mutedText }}>
                    {descricao}
                  </p>
                )}
                <div className="flex items-baseline gap-2 mt-1">
                  {precoNormal &&
                    precoPromo &&
                    Number(precoNormal) > Number(precoPromo) &&
                    formatarPrecoBr(precoNormal) && (
                      <span className="text-sm line-through" style={{ color: paleta.mutedText }}>
                        {formatarPrecoBr(precoNormal)}
                      </span>
                    )}
                  <span className="text-3xl font-extrabold" style={{ color: paleta.accent }}>
                    {formatarPrecoBr(precoPromo) ?? "R$ 0,00"}
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
