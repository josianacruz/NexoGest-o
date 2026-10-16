"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { brl, type ServicoPublico } from "../../../../lib/chic";
import { normalizarTelefone } from "../../../../lib/whatsapp";
import VitrineStories from "../../../_suave/VitrineStories";
import { E } from "../../_estilo";
import {
  baixarTabelaPdf,
  buscarPagina,
  carregarHorarios,
  confirmarAgendamento,
  esquecerHorarios,
  horariosEmCache,
  paginaEmCache,
  preBuscarHorarios,
  diaLongo,
  diaSemanaCurto,
  proximosDias,
  type Loja,
} from "../../_dados";
import Sucesso, { type Reserva } from "./Sucesso";

type Passo = 1 | 2 | 3;
const CHAVE_CLIENTE = "nexo_cliente_publico"; // nome e celular ficam só neste aparelho, para a próxima reserva ser mais rápida

// Agendamento público em 3 passos: serviço → dia e horário → nome e WhatsApp. Feito para o polegar.
export default function AgendarPage() {
  const params = useParams();
  const empresaId = Number(params.empresaId);

  const [loja, setLoja] = useState<Loja | null>(null);
  const [servicos, setServicos] = useState<ServicoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroInicial, setErroInicial] = useState<string | null>(null);

  const [passo, setPasso] = useState<Passo>(1);
  const [servico, setServico] = useState<ServicoPublico | null>(null);
  const dias = useMemo(() => proximosDias(14), []);
  const [dia, setDia] = useState(dias[0]);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [erroHorarios, setErroHorarios] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const topo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!empresaId) return;
    // 1) o que ficou guardado neste aparelho aparece NA HORA; 2) o servidor confirma em segundo plano.
    const guardada = paginaEmCache(empresaId);
    if (guardada) {
      setLoja(guardada.loja);
      setServicos(guardada.servicos);
      setCarregando(false);
    }
    buscarPagina(empresaId)
      .then((p) => {
        setLoja(p.loja);
        setServicos(p.servicos);
        setErroInicial(p.servicos.length === 0 ? "Nenhum serviço está disponível para agendamento online no momento." : null);
      })
      .catch((e: Error & { status?: number }) => {
        // Sem internet com algo guardado: segue com o guardado. Loja que desligou o agendamento: mostra o aviso.
        if (!guardada || e.status === 404) {
          setLoja(null);
          setErroInicial(e.message || "Não foi possível carregar a página.");
        }
      })
      .finally(() => setCarregando(false));
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CLIENTE) ?? "null");
      if (salvo?.nome) setNome(String(salvo.nome).slice(0, 80));
      if (salvo?.celular) setCelular(String(salvo.celular).slice(0, 20));
    } catch {
      /* sem armazenamento: a pessoa digita */
    }
  }, [empresaId]);

  // Horários do dia escolhido. Se já foram vistos há pouco (ou pré-buscados), aparecem na hora, sem esperar a rede.
  useEffect(() => {
    if (!servico || passo !== 2) return;
    setErroHorarios(null);
    const guardado = horariosEmCache(empresaId, servico.id, dia);
    if (guardado) setHorarios(guardado);
    else setHorarios(null);
    let vivo = true;
    carregarHorarios(empresaId, servico.id, dia)
      .then((h) => {
        if (!vivo) return;
        setHorarios(h);
        // adianta os dois dias seguintes enquanto a pessoa olha este (só quando o navegador está ocioso)
        const i = dias.indexOf(dia);
        const adiantar = () => dias.slice(i + 1, i + 3).forEach((d) => preBuscarHorarios(empresaId, servico.id, d));
        if ("requestIdleCallback" in window) (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(adiantar);
        else setTimeout(adiantar, 400);
      })
      .catch((e) => vivo && setErroHorarios(e instanceof Error ? e.message : "Não foi possível buscar os horários."));
    return () => {
      vivo = false;
    };
  }, [servico, dia, passo, empresaId, dias]);

  function irPara(p: Passo) {
    setPasso(p);
    setErro(null);
    requestAnimationFrame(() => topo.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!servico || !hora || enviando) return;
    if (nome.trim().length < 2) return setErro("Escreva seu nome.");
    if (!normalizarTelefone(celular)) return setErro("Confira o WhatsApp: use o DDD e o número, por exemplo (11) 91234-5678.");
    setErro(null);
    setEnviando(true);
    try {
      const r = await confirmarAgendamento(empresaId, { servicoId: servico.id, data: dia, hora, nomeCliente: nome.trim(), celular: celular.trim() });
      if (r.status === 409) {
        esquecerHorarios(empresaId, servico.id, dia);
        setHora(null);
        setErro(r.mensagem);
        irPara(2);
        return;
      }
      if (!r.ok) return setErro(r.mensagem);
      try {
        localStorage.setItem(CHAVE_CLIENTE, JSON.stringify({ nome: nome.trim(), celular: celular.trim() }));
      } catch {
        /* ignora */
      }
      setReserva({ servico: servico.nome, preco: servico.preco, dia, hora, nome: nome.trim() });
    } finally {
      setEnviando(false);
    }
  }

  async function pdf() {
    if (!loja || baixandoPdf) return;
    setBaixandoPdf(true);
    try {
      await baixarTabelaPdf(empresaId, loja, `${window.location.origin}/agendar/${empresaId}`);
    } catch {
      setErro("Não consegui gerar o PDF agora. Tente de novo.");
    } finally {
      setBaixandoPdf(false);
    }
  }

  if (carregando) {
    return <main className="mx-auto max-w-md px-5 py-16 text-center text-[#66666E]">Carregando…</main>;
  }

  if (erroInicial || !loja) {
    return (
      <main className="mx-auto max-w-md px-5 py-12">
        <VitrineStories empresaId={empresaId} />
        <p className={E.erro}>{erroInicial ?? "Não foi possível carregar a página."}</p>
      </main>
    );
  }

  if (reserva) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pb-10 pt-8">
        <Sucesso loja={loja} reserva={reserva} empresaId={empresaId} aoNovo={() => { setReserva(null); setHora(null); setServico(null); irPara(1); }} />
      </main>
    );
  }

  const rotulosPassos = ["Serviço", "Horário", "Seus dados"];

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8" ref={topo}>
      <header className="mb-6 text-center">
        <h1 className={`${E.titulo} text-[26px] font-semibold leading-tight tracking-[0.06em]`}>{loja.nome}</h1>
        {loja.slogan && <p className={`${E.titulo} mt-1 text-[15px] italic ${E.suave}`}>{loja.slogan}</p>}
        <div className="mx-auto mt-3 h-px w-10 bg-[#C9A96E]" />
      </header>

      <VitrineStories empresaId={empresaId} mostrarNome={false} classeBotao={E.botao} />

      {/* progresso */}
      <ol className="mb-6 flex items-center justify-center gap-2" aria-label="Passos do agendamento">
        {rotulosPassos.map((r, i) => {
          const n = (i + 1) as Passo;
          const feito = n < passo;
          const ativo = n === passo;
          return (
            <li key={r} className="flex items-center gap-2" aria-current={ativo ? "step" : undefined}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${ativo ? "bg-[#2F3036] text-[#FAF7F4]" : feito ? "bg-[#E8B4BA] text-[#2F3036]" : "bg-white text-[#66666E] ring-1 ring-[#E6D9CE]"}`}>{feito ? "✓" : n}</span>
              <span className={`text-sm ${ativo ? "font-semibold" : E.suave}`}>{r}</span>
              {n < 3 && <span className="h-px w-4 bg-[#DCCDBF]" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {erro && (
        <p role="alert" className={`${E.erro} mb-4`}>
          {erro}
        </p>
      )}

      {/* PASSO 1: serviço */}
      {passo === 1 && (
        <section aria-label="Escolha o serviço">
          <h2 className={`${E.titulo} mb-3 text-xl font-semibold`}>Qual serviço você quer?</h2>
          <ul className="grid gap-3">
            {servicos.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onPointerDown={() => preBuscarHorarios(empresaId, s.id, dia)}
                  onClick={() => {
                    setServico(s);
                    setHora(null);
                    irPara(2);
                  }}
                  className={`${E.cartao} flex w-full items-center justify-between gap-3 p-4 text-left transition active:scale-[0.99] hover:border-[#C9A96E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A2F]`}
                >
                  <span className="min-w-0">
                    <span className={`${E.titulo} block text-lg font-medium leading-snug`}>{s.nome}</span>
                    <span className={`text-sm ${E.suave}`}>{s.duracaoMinutos} min</span>
                  </span>
                  <span className={`shrink-0 text-lg font-semibold ${E.dourado}`}>{brl(s.preco)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={pdf} disabled={baixandoPdf} className={`${E.botaoContorno} mt-5`}>
            {baixandoPdf ? "Gerando PDF…" : "Baixar tabela de preços (PDF)"}
          </button>
        </section>
      )}

      {/* PASSO 2: dia e horário */}
      {passo === 2 && servico && (
        <section aria-label="Escolha o dia e o horário">
          <ResumoServico servico={servico} aoTrocar={() => irPara(1)} />
          <h2 className={`${E.titulo} mb-3 mt-5 text-xl font-semibold`}>Quando fica bom para você?</h2>

          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-2" role="radiogroup" aria-label="Dia">
            {dias.map((d, i) => (
              <button key={d} type="button" role="radio" aria-checked={dia === d} onClick={() => { setDia(d); setHora(null); }} className={`${dia === d ? E.chipAtivo : E.chip} w-[68px] py-2`}>
                <span className="text-xs uppercase tracking-wide">{i === 0 ? "hoje" : diaSemanaCurto(d)}</span>
                <span className={`${E.titulo} text-xl font-semibold leading-none`}>{Number(d.slice(8))}</span>
              </button>
            ))}
          </div>
          <p className={`mt-1 text-sm ${E.suave}`}>{diaLongo(dia)}</p>

          <div className="mt-4" aria-live="polite">
            {erroHorarios ? (
              <p className={E.erro}>{erroHorarios}</p>
            ) : horarios === null ? (
              <ul className="grid grid-cols-3 gap-3" aria-busy="true" aria-label="Buscando horários">
                {Array.from({ length: 9 }, (_, i) => (
                  <li key={i} className="h-14 animate-pulse rounded-2xl bg-[#EFE5DC]" />
                ))}
              </ul>
            ) : horarios.length === 0 ? (
              <p className={`${E.cartao} p-5 text-center ${E.suave}`}>Sem horários neste dia. Toque em outro dia acima.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {horarios.map((h) => (
                  <li key={h}>
                    <button
                      type="button"
                      onClick={() => {
                        setHora(h);
                        irPara(3);
                      }}
                      className={`${E.hora} w-full`}
                    >
                      {h}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* PASSO 3: dados */}
      {passo === 3 && servico && hora && (
        <form onSubmit={confirmar} aria-label="Seus dados">
          <ResumoServico servico={servico} quando={`${diaLongo(dia)} às ${hora}`} aoTrocar={() => irPara(2)} />
          <h2 className={`${E.titulo} mb-3 mt-5 text-xl font-semibold`}>Para quem é o horário?</h2>
          <div className="grid gap-4">
            <div>
              <label htmlFor="nome" className={E.rotulo}>
                Seu nome
              </label>
              <input id="nome" className={E.campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" autoCapitalize="words" maxLength={80} required />
            </div>
            <div>
              <label htmlFor="celular" className={E.rotulo}>
                Seu WhatsApp (com DDD)
              </label>
              <input id="celular" className={E.campo} type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={celular} onChange={(e) => setCelular(e.target.value)} maxLength={20} required />
              <p className={`mt-1.5 text-xs ${E.suave}`}>Usamos só para falar sobre o seu horário.</p>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#FAF7F4] via-[#FAF7F4] to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
            <div className="mx-auto max-w-md">
              <button type="submit" disabled={enviando} className={E.botao}>
                {enviando ? "Confirmando…" : "Confirmar meu horário"}
              </button>
            </div>
          </div>
        </form>
      )}

      {passo > 1 && (
        <button type="button" onClick={() => irPara((passo - 1) as Passo)} className={`mt-6 min-h-12 w-full text-center text-sm font-semibold ${E.suave} underline-offset-4 hover:underline`}>
          ← Voltar
        </button>
      )}
    </main>
  );
}

function ResumoServico({ servico, quando, aoTrocar }: { servico: ServicoPublico; quando?: string; aoTrocar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F2C9CD]/60 px-4 py-3">
      <div className="min-w-0">
        <p className={`${E.titulo} truncate text-base font-semibold`}>{servico.nome}</p>
        <p className={`text-sm ${E.suave}`}>
          {quando ? `${quando} · ` : ""}
          {servico.duracaoMinutos} min · {brl(servico.preco)}
        </p>
      </div>
      <button type="button" onClick={aoTrocar} className="min-h-12 shrink-0 px-2 text-sm font-semibold text-[#8A6A2F] underline underline-offset-4">
        Trocar
      </button>
    </div>
  );
}
