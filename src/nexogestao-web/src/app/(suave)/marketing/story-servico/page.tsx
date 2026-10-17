"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { brl, linkCurto, type ServicoPublico } from "../../../../lib/chic";
import { artePng, baixarPng, compartilharImagem, podeCompartilharImagem } from "../../../../lib/exportarArte";
import { separarNomeEslogan } from "../../../../lib/modulos";
import ArteStoryChic from "../../../_suave/arte-chic/ArteStoryChic";
import { PreviewEscalado, fotoDaBiblioteca, useLinksDaLoja, useQr } from "../../../_suave/arte-chic/comum";
import BibliotecaRapida from "../../../_suave/BibliotecaRapida";
import { useEmpresa } from "../../../_suave/EmpresaContext";
import { SUAVE } from "../../../_suave/tokens";

const CHAMADAS = ["Promoção da semana", "Novidade", "Agenda aberta", "Últimas vagas"];
const ACOES = ["Agende pelo link", "Chame no WhatsApp", "Reserve seu horário"];
const DURACOES = [3, 7, 14, 30];

interface PromocaoNoPainel {
  id: number;
  servicoNome: string;
  precoNormal: number;
  precoPromocional: number;
  titulo: string;
  fimEm: string;
  noAr: boolean;
}

// Promoção e Story de um serviço: escolhe o serviço, põe o preço promocional e (1) baixa o Story 1080 x 1920 pronto e/ou
// (2) publica a promoção no link de agendamento, onde a cliente vê o preço especial e agenda direto.
export default function StoryServicoPage() {
  const { empresa, api } = useEmpresa();
  const links = useLinksDaLoja();
  const [servicos, setServicos] = useState<(ServicoPublico & { permiteAutoagendamento?: boolean })[]>([]);
  const [promocoes, setPromocoes] = useState<PromocaoNoPainel[]>([]);
  const [dias, setDias] = useState(7);
  const [publicando, setPublicando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [chamada, setChamada] = useState(CHAMADAS[0]);
  const [acao, setAcao] = useState(ACOES[0]);
  const [descricao, setDescricao] = useState("");
  const [promo, setPromo] = useState("");
  const [instagram, setInstagram] = useState("");
  const [logo, setLogo] = useState<{ id: number; url: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const arteRef = useRef<HTMLDivElement>(null);
  const qr = useQr(links.agendar || "https://nexogestao");

  useEffect(() => {
    if (!empresa) return;
    (async () => {
      try {
        const r = await api("/servicos");
        if (r.ok) {
          const lista: (ServicoPublico & { ativo?: boolean })[] = (await r.json()).filter((s: { ativo?: boolean }) => s.ativo !== false);
          setServicos(lista);
          setServicoId(lista[0]?.id ?? null);
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, [empresa?.id]);

  async function carregarPromocoes() {
    try {
      const r = await api("/promocoes");
      if (r.ok) setPromocoes((await r.json()).filter((p: PromocaoNoPainel) => p.noAr));
    } catch {
      /* a lista é só informativa */
    }
  }

  useEffect(() => {
    if (empresa) carregarPromocoes();
  }, [empresa?.id]);

  async function publicar() {
    if (!servico || !promoValida || promoMaiorQueNormal || publicando) return;
    setPublicando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await api("/promocoes", { method: "POST", body: JSON.stringify({ servicoId: servico.id, precoPromocional: precoPromo, dias, titulo: chamada, descricao: descricao.trim() || null }) });
      const d = await r.json().catch(() => null);
      if (r.status === 403) setErro("Só a dona da loja pode publicar promoções.");
      else if (!r.ok) setErro(d?.mensagem ?? "Não consegui publicar a promoção.");
      else {
        setAviso(`Promoção no ar por ${dias} dias. As clientes já veem no link de agendamento.`);
        await carregarPromocoes();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui publicar a promoção.");
    } finally {
      setPublicando(false);
    }
  }

  async function encerrar(id: number) {
    setErro(null);
    setAviso(null);
    const r = await api(`/promocoes/${id}/encerrar`, { method: "PUT" });
    if (r.ok) {
      setAviso("Promoção encerrada. Ela saiu do link de agendamento.");
      await carregarPromocoes();
    } else setErro(r.status === 403 ? "Só a dona da loja pode encerrar promoções." : "Não consegui encerrar a promoção.");
  }

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const precoPromo = promo.trim() ? Number(promo.replace(",", ".")) : null;
  const promoValida = precoPromo !== null && Number.isFinite(precoPromo) && precoPromo >= 0;
  const promoMaiorQueNormal = promoValida && servico ? (precoPromo as number) >= servico.preco : false;
  const nome = useMemo(() => separarNomeEslogan(empresa?.nome ?? ""), [empresa?.nome]);

  async function gerar(modo: "baixar" | "compartilhar") {
    if (!arteRef.current || !servico) return;
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const blob = await artePng(arteRef.current, 1080);
      const arquivo = `story-${servico.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "servico"}`;
      if (modo === "compartilhar" && podeCompartilharImagem(blob, `${arquivo}.png`)) {
        const texto = `${servico.nome}${promoValida && !promoMaiorQueNormal ? ` por ${brl(precoPromo as number)}` : ""}

Para agendar o seu horário: ${links.agendar}`;
        await compartilharImagem(blob, arquivo, texto);
      } else {
        baixarPng(blob, arquivo);
        setAviso("Imagem baixada (1080 x 1920). Agora é só postar no Story.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : "Não consegui gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  function copiar() {
    navigator.clipboard?.writeText(links.agendar).then(() => setAviso("Link de agendamento copiado."));
  }

  if (!empresa) return null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/marketing" className="text-sm font-semibold text-violet-800 hover:underline dark:text-violet-200">
        ← Marketing
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold tracking-tight">Promoção e Story de um serviço</h1>
      <p className={`mb-6 text-sm ${SUAVE.textoSuave}`}>Escolha o serviço e o preço especial. Baixe o Story pronto (1080 x 1920) e publique a promoção no link de agendamento para as clientes verem e agendarem.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          <section className={`${SUAVE.cartao} grid gap-4 p-5`}>
            <div>
              <label htmlFor="servico" className={SUAVE.rotulo}>
                Serviço
              </label>
              {carregando ? (
                <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
              ) : servicos.length === 0 ? (
                <p className={`text-sm ${SUAVE.textoSuave}`}>
                  Você ainda não tem serviços cadastrados. <Link href="/servicos" className="font-semibold underline">Cadastrar serviços</Link>
                </p>
              ) : (
                <select id="servico" className={SUAVE.campo} value={servicoId ?? ""} onChange={(e) => setServicoId(Number(e.target.value))}>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} — {brl(s.preco)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="promo" className={SUAVE.rotulo}>
                Preço promocional (opcional)
              </label>
              <input id="promo" className={SUAVE.campo} inputMode="decimal" placeholder={servico ? `Ex.: ${(servico.preco * 0.8).toFixed(2).replace(".", ",")}` : "R$"} value={promo} onChange={(e) => setPromo(e.target.value.replace(/[^\d,.]/g, ""))} />
              {servico && promoMaiorQueNormal && <p className={`mt-1 text-xs ${SUAVE.textoSuave}`}>O preço especial é igual ou maior que o normal ({brl(servico.preco)}); a arte vai mostrar só o valor especial.</p>}
              {servico && promoValida && !promoMaiorQueNormal && <p className={`mt-1 text-xs ${SUAVE.textoSuave}`}>Desconto de {Math.round((1 - (precoPromo as number) / servico.preco) * 100)}% sobre {brl(servico.preco)}.</p>}
            </div>

            <div>
              <p className={SUAVE.rotulo}>Chamada no topo</p>
              <div className="flex flex-wrap gap-2">
                {CHAMADAS.map((c) => (
                  <button key={c} type="button" aria-pressed={chamada === c} onClick={() => setChamada(c)} className={chamada === c ? SUAVE.chipAtivo : SUAVE.chip}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={SUAVE.rotulo}>Chamada para ação</p>
              <div className="flex flex-wrap gap-2">
                {ACOES.map((c) => (
                  <button key={c} type="button" aria-pressed={acao === c} onClick={() => setAcao(c)} className={acao === c ? SUAVE.chipAtivo : SUAVE.chip}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="desc" className={SUAVE.rotulo}>
                  Frase curta (opcional)
                </label>
                <input id="desc" className={SUAVE.campo} maxLength={80} placeholder="Ex.: válido até sexta-feira" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div>
                <label htmlFor="insta" className={SUAVE.rotulo}>
                  Seu @ do Instagram (opcional)
                </label>
                <input id="insta" className={SUAVE.campo} maxLength={30} placeholder="@seusalao" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))} />
              </div>
            </div>
          </section>

          <section className={`${SUAVE.cartao} grid gap-3 p-5`}>
            <h2 className="font-semibold">Publicar no meu link de agendamento</h2>
            <p className={`text-sm ${SUAVE.textoSuave}`}>A promoção aparece em destaque na página da cliente e o agendamento já sai com o preço especial. Termina sozinha ao fim do prazo.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Duração da promoção">
              {DURACOES.map((n) => (
                <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)} className={dias === n ? SUAVE.chipAtivo : SUAVE.chip}>
                  {n} dias
                </button>
              ))}
            </div>
            {servico && servico.permiteAutoagendamento === false && <p className={`rounded-2xl p-3 text-sm ${SUAVE.seloAviso}`}>Esse serviço não aceita agendamento pelo link. Ligue “As clientes podem agendar pelo link” no cadastro do serviço para publicar a promoção.</p>}
            <button type="button" onClick={publicar} disabled={publicando || !servico || !promoValida || promoMaiorQueNormal || servico.permiteAutoagendamento === false} className={SUAVE.botaoPrimario}>
              {publicando ? "Publicando…" : "Publicar promoção no link"}
            </button>
            {!promoValida && <p className={`text-xs ${SUAVE.textoFraco}`}>Preencha o preço promocional acima para poder publicar.</p>}

            {promocoes.length > 0 && (
              <div className="mt-2 grid gap-2">
                <p className={SUAVE.rotulo}>Promoções no ar</p>
                <ul className="grid gap-2">
                  {promocoes.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/40">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="break-words font-semibold">{p.servicoNome}</p>
                        <p className={SUAVE.textoSuave}>
                          <span className="line-through">{brl(p.precoNormal)}</span> <strong>{brl(p.precoPromocional)}</strong> · até {new Date(p.fimEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                      <button type="button" onClick={() => encerrar(p.id)} className={SUAVE.botaoSecundario}>
                        Encerrar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={`${SUAVE.cartao} grid gap-2 p-5`}>
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
          </section>
        </div>

        <div className="grid content-start gap-4">
          <PreviewEscalado larguraArte={360}>
            <ArteStoryChic
              ref={arteRef}
              d={{
                nomeSalao: nome.nome || "Seu salão",
                slogan: nome.slogan,
                logoUrl: logo?.url,
                chamadaTopo: chamada,
                servicoNome: servico?.nome ?? "Escolha um serviço",
                descricao: descricao.trim() || undefined,
                // Preço especial igual ou maior que o normal: mostra só o valor especial (sem "de … por …").
                precoNormal: promoMaiorQueNormal ? null : (servico?.preco ?? null),
                precoPromo: promoValida ? precoPromo : null,
                duracaoMinutos: servico?.duracaoMinutos ?? null,
                chamadaAcao: acao,
                link: linkCurto(links.agendar),
                qrDataUrl: qr,
                instagram: instagram.trim() || undefined,
              }}
            />
          </PreviewEscalado>

          <div className="grid gap-2">
            <button type="button" disabled={gerando || !servico} onClick={() => gerar("baixar")} className={SUAVE.botaoPrimario}>
              {gerando ? "Gerando…" : "Baixar Story (1080 x 1920)"}
            </button>
            {podeCompartilhar && (
              <button type="button" disabled={gerando || !servico} onClick={() => gerar("compartilhar")} className={SUAVE.botaoSecundario}>
                Compartilhar direto no celular
              </button>
            )}
            <button type="button" onClick={copiar} disabled={!links.agendar} className={SUAVE.botaoSecundario}>
              Copiar link de agendamento
            </button>
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
