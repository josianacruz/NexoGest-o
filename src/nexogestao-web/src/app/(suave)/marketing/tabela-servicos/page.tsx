"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { brl, linkCurto, type ServicoPublico } from "../../../../lib/chic";
import { artePng, baixarPng, compartilharImagem, podeCompartilharImagem } from "../../../../lib/exportarArte";
import { separarNomeEslogan } from "../../../../lib/modulos";
import { baixarBlob, gerarPdfCardapio } from "../../../../lib/pdfCardapio";
import ArteCardapioChic from "../../../_suave/arte-chic/ArteCardapioChic";
import { PreviewEscalado, fotoDaBiblioteca, useLinksDaLoja, useQr } from "../../../_suave/arte-chic/comum";
import BibliotecaRapida from "../../../_suave/BibliotecaRapida";
import { useEmpresa } from "../../../_suave/EmpresaContext";
import { SUAVE } from "../../../_suave/tokens";

// Cardápio digital de serviços e preços: imagem para o feed/WhatsApp, PDF vertical para celular e link público.
export default function TabelaServicosPage() {
  const { empresa, api } = useEmpresa();
  const links = useLinksDaLoja();
  const [servicos, setServicos] = useState<ServicoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [mostrarDuracao, setMostrarDuracao] = useState(true);
  const [mostrarQr, setMostrarQr] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [logo, setLogo] = useState<{ id: number; url: string } | null>(null);
  const [ocupado, setOcupado] = useState<null | "imagem" | "pdf">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const arteRef = useRef<HTMLDivElement>(null);
  const qr = useQr(links.tabela || "https://nexogestao");
  const nome = useMemo(() => separarNomeEslogan(empresa?.nome ?? ""), [empresa?.nome]);

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      try {
        const r = await api("/servicos");
        if (r.ok) {
          const lista: ServicoPublico[] = await r.json();
          setServicos(lista);
          setSelecionados(lista.map((s) => s.id));
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, [empresa?.id]);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const escolhidos = servicos.filter((s) => selecionados.includes(s.id));
  const alternar = (id: number) => setSelecionados((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  // Texto que acompanha a imagem e o botão de WhatsApp: a tabela e o link para agendar.
  const mensagem = () => `Oi! Veja a nossa tabela de serviços ✨${links.tabela ? `
${links.tabela}` : ""}${links.agendar ? `

Para agendar o seu horário: ${links.agendar}` : ""}`;

  async function baixarImagem(compartilhar = false) {
    if (!arteRef.current) return;
    setOcupado("imagem");
    setErro(null);
    setAviso(null);
    try {
      const blob = await artePng(arteRef.current, 1080);
      if (compartilhar && podeCompartilharImagem(blob, "tabela-de-servicos.png")) {
        // Alguns celulares (iPhone) mandam só a foto e ignoram o texto: o texto também fica copiado, é só colar na conversa.
        try {
          await navigator.clipboard?.writeText(mensagem());
          setAviso("Mensagem com os links copiada: se ela não vier junto com a foto, é só colar na conversa.");
        } catch {
          /* sem permissão para copiar: segue sem a cópia */
        }
        await compartilharImagem(blob, "tabela-de-servicos", mensagem());
      } else {
        baixarPng(blob, "tabela-de-servicos");
        setAviso("Imagem baixada. É só postar ou mandar para as clientes.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : "Não consegui gerar a imagem.");
    } finally {
      setOcupado(null);
    }
  }

  async function baixarPdf() {
    setOcupado("pdf");
    setErro(null);
    setAviso(null);
    try {
      const blob = await gerarPdfCardapio({ nomeSalao: nome.nome || "Tabela de serviços", slogan: nome.slogan, servicos: escolhidos, link: links.agendar, instagram: instagram.trim() || null, mostrarDuracao });
      baixarBlob(blob, "tabela-de-servicos.pdf");
      setAviso("PDF baixado. Ele é vertical, feito para ler no celular.");
    } catch {
      setErro("Não consegui gerar o PDF. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  function copiarLink() {
    navigator.clipboard?.writeText(links.tabela).then(() => setAviso("Link do cardápio copiado. Cole no WhatsApp ou na bio do Instagram."));
  }

  if (!empresa) return null;

  const linkZap = links.tabela ? `https://wa.me/?text=${encodeURIComponent(mensagem())}` : "#";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/marketing" className="text-sm font-semibold text-violet-800 hover:underline dark:text-violet-200">
        ← Marketing
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold tracking-tight">Cardápio de serviços</h1>
      <p className={`mb-6 text-sm ${SUAVE.textoSuave}`}>Seus serviços e valores em formato de cardápio digital: baixe a imagem ou o PDF, ou copie o link para enviar às clientes.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          <section className={`${SUAVE.cartao} p-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Serviços no cardápio</h2>
              <button type="button" className="text-sm font-semibold text-violet-800 hover:underline dark:text-violet-200" onClick={() => setSelecionados(selecionados.length === servicos.length ? [] : servicos.map((s) => s.id))}>
                {selecionados.length === servicos.length ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>
            {carregando ? (
              <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
            ) : servicos.length === 0 ? (
              <p className={`text-sm ${SUAVE.textoSuave}`}>
                Nenhum serviço cadastrado. <Link href="/servicos" className="font-semibold underline">Cadastrar serviços</Link>
              </p>
            ) : (
              <ul className="grid max-h-80 gap-1 overflow-y-auto">
                {servicos.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <input type="checkbox" checked={selecionados.includes(s.id)} onChange={() => alternar(s.id)} className="h-5 w-5 accent-violet-500" />
                      <span className="flex-1">
                        {s.nome} <span className={SUAVE.textoSuave}>({s.duracaoMinutos} min)</span>
                      </span>
                      <span className="font-semibold">{brl(s.preco)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${SUAVE.cartao} grid gap-4 p-5`}>
            <h2 className="font-semibold">Detalhes da arte</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={mostrarDuracao} onClick={() => setMostrarDuracao((v) => !v)} className={mostrarDuracao ? SUAVE.chipAtivo : SUAVE.chip}>
                Mostrar duração
              </button>
              <button type="button" aria-pressed={mostrarQr} onClick={() => setMostrarQr((v) => !v)} className={mostrarQr ? SUAVE.chipAtivo : SUAVE.chip}>
                Mostrar QR Code
              </button>
            </div>
            <div>
              <label htmlFor="insta" className={SUAVE.rotulo}>
                Seu @ do Instagram (opcional)
              </label>
              <input id="insta" className={SUAVE.campo} maxLength={30} placeholder="@seusalao" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))} />
            </div>
            <div className="grid gap-2">
              <p className={SUAVE.rotulo}>Logo do salão (opcional) — toque em uma foto recente ou envie a sua</p>
              <BibliotecaRapida
                selecionadaId={logo?.id ?? null}
                aoEscolher={async (m, d) => {
                  if (logo?.id === m.id) return setLogo(null);
                  try {
                    setLogo({ id: m.id, url: await fotoDaBiblioteca(api, m, d) });
                  } catch (e) {
                    setErro(e instanceof Error ? e.message : "Não consegui carregar a foto.");
                  }
                }}
              />
            </div>
          </section>
        </div>

        <div className="grid content-start gap-4">
          <PreviewEscalado larguraArte={360}>
            <ArteCardapioChic
              ref={arteRef}
              d={{ nomeSalao: nome.nome || "Seu salão", slogan: nome.slogan, logoUrl: logo?.url, servicos: escolhidos, mostrarDuracao, link: linkCurto(links.agendar), qrDataUrl: mostrarQr ? qr : null, instagram: instagram.trim() || undefined }}
            />
          </PreviewEscalado>

          <div className="grid gap-2">
            <button type="button" disabled={ocupado !== null || escolhidos.length === 0} onClick={() => baixarImagem(false)} className={SUAVE.botaoPrimario}>
              {ocupado === "imagem" ? "Gerando imagem…" : "Baixar tabela em imagem"}
            </button>
            <button type="button" disabled={ocupado !== null || escolhidos.length === 0} onClick={baixarPdf} className={SUAVE.botaoSecundario}>
              {ocupado === "pdf" ? "Gerando PDF…" : "Baixar tabela em PDF"}
            </button>
            {podeCompartilhar && (
              <button type="button" disabled={ocupado !== null || escolhidos.length === 0} onClick={() => baixarImagem(true)} className={SUAVE.botaoSecundario}>
                Compartilhar direto no celular
              </button>
            )}
            <button type="button" onClick={copiarLink} disabled={!links.tabela} className={SUAVE.botaoSecundario}>
              Copiar link do cardápio
            </button>
            <a href={linkZap} target="_blank" rel="noopener noreferrer" className={SUAVE.botaoSucesso}>
              Enviar o link pelo WhatsApp
            </a>
          </div>
          <p className={`rounded-2xl p-3 text-xs ${SUAVE.seloNeutro}`}>O link do cardápio mostra <strong>todos os seus serviços ativos</strong>, mesmo os que não aceitam agendamento online, e leva a cliente para agendar. A imagem e o PDF mostram só os serviços marcados acima.</p>
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
