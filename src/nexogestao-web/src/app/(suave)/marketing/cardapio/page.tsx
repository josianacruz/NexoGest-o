"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { brl } from "../../../../lib/chic";
import { artePng, baixarPng, compartilharImagem, podeCompartilharImagem } from "../../../../lib/exportarArte";
import { separarNomeEslogan } from "../../../../lib/modulos";
import ArteCardapioComida, { type ItemComida } from "../../../_suave/arte-chic/ArteCardapioComida";
import { PreviewEscalado, fotoDaBiblioteca } from "../../../_suave/arte-chic/comum";
import BibliotecaRapida from "../../../_suave/BibliotecaRapida";
import { useEmpresa } from "../../../_suave/EmpresaContext";
import { SUAVE } from "../../../_suave/tokens";

interface Produto {
  id: number;
  nome: string;
  categoria?: string | null;
  preco: number;
  ativo: boolean;
  atributos?: {
    adicionais?: { nome: string; preco: number }[] | null;
    ingredientes?: string | null;
    tamanhos?: { nome: string; preco: number }[] | null;
  } | null;
}

interface Foto {
  id: number;
  url: string;
}

const CHAVE_CONTATO = "nexo_cardapio_contato";

// (11) 99999-0000 a partir dos números digitados (com ou sem DDI 55).
function formatarZap(texto: string) {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Cardápio de comida para o feed/WhatsApp: pratos do estoque agrupados por categoria, com ingredientes, tamanhos e adicionais.
export default function CardapioComidaPage() {
  const { empresa, api } = useEmpresa();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [manuais, setManuais] = useState<ItemComida[]>([]);
  const [novo, setNovo] = useState({ nome: "", descricao: "", preco: "", categoria: "" });
  const [zap, setZap] = useState("");
  const [instagram, setInstagram] = useState("");
  const [logo, setLogo] = useState<Foto | null>(null);
  const [capa, setCapa] = useState<Foto | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const arteRef = useRef<HTMLDivElement>(null);
  const nome = useMemo(() => separarNomeEslogan(empresa?.nome ?? ""), [empresa?.nome]);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CONTATO) ?? "null");
      if (salvo) {
        setZap(salvo.zap ?? "");
        setInstagram(salvo.instagram ?? "");
      }
    } catch {
      /* sem armazenamento: começa em branco */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_CONTATO, JSON.stringify({ zap, instagram }));
    } catch {
      /* não é essencial */
    }
  }, [zap, instagram]);

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      try {
        const r = await api("/produtos");
        if (r.ok) {
          const lista: Produto[] = (await r.json()).filter((p: Produto) => p.ativo !== false);
          setProdutos(lista);
          setSelecionados(lista.map((p) => p.id));
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, [empresa?.id]);

  const itensDoEstoque: ItemComida[] = produtos
    .filter((p) => selecionados.includes(p.id))
    .map((p) => ({
      id: `p${p.id}`,
      nome: p.nome,
      categoria: p.categoria?.trim() || "Mais pedidos",
      preco: p.preco,
      descricao: p.atributos?.ingredientes?.trim() || undefined,
      tamanhos: p.atributos?.tamanhos?.length ? p.atributos.tamanhos : undefined,
      adicionais: p.atributos?.adicionais?.length ? p.atributos.adicionais : undefined,
    }));
  const itens = [...itensDoEstoque, ...manuais];

  const categoriasDoEstoque = useMemo(() => {
    const grupos: { categoria: string; itens: Produto[] }[] = [];
    for (const p of produtos) {
      const c = p.categoria?.trim() || "Mais pedidos";
      const g = grupos.find((x) => x.categoria === c);
      if (g) g.itens.push(p);
      else grupos.push({ categoria: c, itens: [p] });
    }
    return grupos;
  }, [produtos]);

  const alternar = (id: number) => setSelecionados((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const alternarGrupo = (ids: number[]) => setSelecionados((a) => (ids.every((i) => a.includes(i)) ? a.filter((x) => !ids.includes(x)) : Array.from(new Set([...a, ...ids]))));

  function adicionarManual() {
    const preco = Number(novo.preco.replace(",", "."));
    if (!novo.nome.trim() || !(preco >= 0) || novo.preco === "") return;
    setManuais((l) => [...l, { id: `m${Date.now()}`, nome: novo.nome.trim(), descricao: novo.descricao.trim() || undefined, preco, categoria: novo.categoria.trim() || "Mais pedidos" }]);
    setNovo({ nome: "", descricao: "", preco: "", categoria: "" });
  }

  async function escolherFoto(m: Parameters<typeof fotoDaBiblioteca>[1], atual: Foto | null, definir: (f: Foto | null) => void, dados?: string) {
    if (atual?.id === m.id) return definir(null);
    try {
      definir({ id: m.id, url: await fotoDaBiblioteca(api, m, dados) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar a foto.");
    }
  }

  async function baixar(compartilhar = false) {
    if (!arteRef.current) return;
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const blob = await artePng(arteRef.current, 1080);
      if (compartilhar && podeCompartilharImagem(blob, "cardapio.png")) await compartilharImagem(blob, "cardapio");
      else {
        baixarPng(blob, "cardapio");
        setAviso("Cardápio baixado. É só postar ou mandar no WhatsApp.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : "Não consegui gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  if (!empresa) return null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/marketing" className="text-sm font-semibold text-violet-800 hover:underline dark:text-violet-200">
        ← Marketing
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold tracking-tight">Cardápio</h1>
      <p className={`mb-6 text-sm ${SUAVE.textoSuave}`}>Seus pratos do estoque viram um cardápio bonito, com ingredientes, tamanhos e adicionais. Baixe a imagem e poste ou mande no WhatsApp.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          <section className={`${SUAVE.cartao} p-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Pratos no cardápio</h2>
              {produtos.length > 0 && (
                <button type="button" className="text-sm font-semibold text-violet-800 hover:underline dark:text-violet-200" onClick={() => setSelecionados(selecionados.length === produtos.length ? [] : produtos.map((p) => p.id))}>
                  {selecionados.length === produtos.length ? "Desmarcar todos" : "Marcar todos"}
                </button>
              )}
            </div>
            {carregando ? (
              <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
            ) : produtos.length === 0 ? (
              <p className={`text-sm ${SUAVE.textoSuave}`}>
                Nenhum prato cadastrado. <Link href="/produtos" className="font-semibold underline">Cadastrar no estoque</Link> ou adicione um item manual abaixo.
              </p>
            ) : (
              <div className="grid max-h-96 gap-3 overflow-y-auto">
                {categoriasDoEstoque.map((g) => {
                  const ids = g.itens.map((p) => p.id);
                  return (
                    <div key={g.categoria}>
                      <button type="button" onClick={() => alternarGrupo(ids)} className={`mb-1 text-xs font-bold uppercase tracking-wide ${SUAVE.textoSuave}`}>
                        {g.categoria} · {ids.every((i) => selecionados.includes(i)) ? "desmarcar" : "marcar"} categoria
                      </button>
                      <ul className="grid gap-1">
                        {g.itens.map((p) => (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <input type="checkbox" checked={selecionados.includes(p.id)} onChange={() => alternar(p.id)} className="h-5 w-5 accent-violet-500" />
                              <span className="min-w-0 flex-1 break-words">{p.nome}</span>
                              <span className="font-semibold">{brl(p.preco)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`${SUAVE.cartao} grid gap-3 p-5`}>
            <h2 className="font-semibold">Item avulso (opcional)</h2>
            <input aria-label="Nome do prato" className={SUAVE.campo} placeholder="Nome do prato" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <input aria-label="Descrição" className={SUAVE.campo} placeholder="Ingredientes ou frase (opcional)" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Preço" className={SUAVE.campo} inputMode="decimal" placeholder="Preço" value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value.replace(/[^\d,.]/g, "") })} />
              <input aria-label="Categoria" className={SUAVE.campo} placeholder="Categoria" value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} />
            </div>
            <button type="button" onClick={adicionarManual} disabled={!novo.nome.trim() || novo.preco === ""} className={SUAVE.botaoSecundario}>
              Adicionar ao cardápio
            </button>
            {manuais.length > 0 && (
              <ul className="grid gap-1">
                {manuais.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">
                      {m.nome} <span className={SUAVE.textoSuave}>· {brl(m.preco)}</span>
                    </span>
                    <button type="button" className="min-h-11 px-2 text-sm font-semibold text-red-700 hover:underline dark:text-red-300" onClick={() => setManuais((l) => l.filter((x) => x.id !== m.id))}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${SUAVE.cartao} grid gap-4 p-5`}>
            <h2 className="font-semibold">Capa e contato</h2>
            <div className="grid gap-2">
              <p className={SUAVE.rotulo}>Foto de capa (opcional) — toque em uma foto do prato ou envie a sua</p>
              <BibliotecaRapida selecionadaId={capa?.id ?? null} aoEscolher={(m, d) => escolherFoto(m, capa, setCapa, d)} />
            </div>
            <div className="grid gap-2">
              <p className={SUAVE.rotulo}>Logo (opcional)</p>
              <BibliotecaRapida selecionadaId={logo?.id ?? null} aoEscolher={(m, d) => escolherFoto(m, logo, setLogo, d)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="zap" className={SUAVE.rotulo}>
                  WhatsApp para pedidos
                </label>
                <input id="zap" className={SUAVE.campo} inputMode="tel" placeholder="(11) 99999-0000" value={zap} onChange={(e) => setZap(formatarZap(e.target.value))} />
              </div>
              <div>
                <label htmlFor="insta" className={SUAVE.rotulo}>
                  Instagram (opcional)
                </label>
                <input id="insta" className={SUAVE.campo} maxLength={30} placeholder="@minhalanchonete" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))} />
              </div>
            </div>
          </section>
        </div>

        <div className="grid content-start gap-4">
          <PreviewEscalado larguraArte={360}>
            <ArteCardapioComida
              ref={arteRef}
              d={{ nome: nome.nome || "Seu cardápio", slogan: nome.slogan, logoUrl: logo?.url, capaUrl: capa?.url, itens, whatsapp: zap.replace(/\D/g, "").length >= 10 ? zap : undefined, instagram: instagram.trim() || undefined }}
            />
          </PreviewEscalado>

          <div className="grid gap-2">
            <button type="button" disabled={gerando || itens.length === 0} onClick={() => baixar(false)} className={SUAVE.botaoPrimario}>
              {gerando ? "Gerando imagem…" : "Baixar cardápio em imagem"}
            </button>
            {podeCompartilhar && (
              <button type="button" disabled={gerando || itens.length === 0} onClick={() => baixar(true)} className={SUAVE.botaoSecundario}>
                Compartilhar direto no celular
              </button>
            )}
          </div>
          {erro && (
            <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
              {erro}
            </p>
          )}
          {aviso && (
            <p role="status" className={`rounded-2xl p-3 text-sm ${SUAVE.seloOk}`}>
              {aviso}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
