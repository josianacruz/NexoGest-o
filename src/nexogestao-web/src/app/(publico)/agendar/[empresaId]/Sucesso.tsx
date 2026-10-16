"use client";

import { useRef, useState } from "react";
import { brl } from "../../../../lib/chic";
import { artePng, baixarPng, compartilharImagem, podeCompartilharImagem } from "../../../../lib/exportarArte";
import ArteConfirmacaoChic from "../../../_suave/arte-chic/ArteConfirmacaoChic";
import { PreviewEscalado } from "../../../_suave/arte-chic/comum";
import { E } from "../../_estilo";
import { baixarTabelaPdf, dataDaChave, diaLongo, type Loja } from "../../_dados";

export interface Reserva {
  servico: string;
  preco: number;
  dia: string; // yyyy-mm-dd
  hora: string; // HH:mm
  nome: string;
}

// Tela de sucesso: resumo, botão do WhatsApp do salão (mensagem pronta), card para o Story e tabela de preços em PDF.
export default function Sucesso({ loja, reserva, empresaId, aoNovo }: { loja: Loja; reserva: Reserva; empresaId: number; aoNovo: () => void }) {
  const [mostrarCard, setMostrarCard] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const d = dataDaChave(reserva.dia);
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  const diaMes = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const dataCurta = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const mensagem = `Olá! Aqui é a ${reserva.nome}. Acabei de agendar ${reserva.servico} para ${diaSemana.toLowerCase()}, ${dataCurta}, às ${reserva.hora}. Posso contar com vocês? 💖`;
  const linkZap = loja.whatsapp ? `https://wa.me/${loja.whatsapp}?text=${encodeURIComponent(mensagem)}` : null;
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function gerarCard(modo: "baixar" | "compartilhar") {
    if (!cardRef.current) return;
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const blob = await artePng(cardRef.current, 1080); // 360 x 640 na tela → 1080 x 1920 no arquivo
      if (modo === "compartilhar" && podeCompartilharImagem(blob, "meu-horario.png")) await compartilharImagem(blob, "meu-horario");
      else {
        baixarPng(blob, "meu-horario");
        setAviso("Imagem salva! Agora é só postar no seu Story e marcar o salão. 💖");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : "Não consegui gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  async function pdf() {
    setBaixandoPdf(true);
    setErro(null);
    try {
      await baixarTabelaPdf(empresaId, loja, `${window.location.origin}/agendar/${empresaId}`);
    } catch {
      setErro("Não consegui gerar o PDF agora. Tente de novo.");
    } finally {
      setBaixandoPdf(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className={`${E.cartao} p-6 text-center`}>
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#F2C9CD] text-2xl" aria-hidden="true">
          ✓
        </div>
        <h1 className={`${E.titulo} text-2xl font-semibold`}>Horário confirmado!</h1>
        <p className={`mt-1 ${E.suave}`}>{reserva.nome.split(" ")[0]}, está tudo certo com a sua reserva.</p>
        <dl className="mt-5 grid gap-1 text-left">
          <div className="flex justify-between gap-3 border-t border-[#EADFD6] py-2">
            <dt className={E.suave}>Serviço</dt>
            <dd className="text-right font-semibold">{reserva.servico}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#EADFD6] py-2">
            <dt className={E.suave}>Quando</dt>
            <dd className="text-right font-semibold">
              {diaLongo(reserva.dia)}, {reserva.hora}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#EADFD6] py-2">
            <dt className={E.suave}>Valor</dt>
            <dd className={`text-right font-semibold ${E.dourado}`}>{brl(reserva.preco)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#EADFD6] py-2">
            <dt className={E.suave}>Local</dt>
            <dd className="text-right font-semibold">{loja.nome}</dd>
          </div>
        </dl>
      </div>

      {linkZap && (
        <a href={linkZap} target="_blank" rel="noopener noreferrer" className={E.botaoVerde}>
          Confirmar no WhatsApp do salão
        </a>
      )}

      <button type="button" onClick={() => setMostrarCard((v) => !v)} aria-expanded={mostrarCard} className={E.botao}>
        {mostrarCard ? "Esconder o card do Story" : "Criar card para o Story ✨"}
      </button>

      {mostrarCard && (
        <section aria-label="Card para o Story" className="grid gap-3">
          <div className="mx-auto w-full max-w-[360px]">
            <PreviewEscalado larguraArte={360}>
              <ArteConfirmacaoChic ref={cardRef} d={{ nomeCliente: reserva.nome, servico: reserva.servico, diaSemana, diaMes, hora: reserva.hora, nomeSalao: loja.nome }} />
            </PreviewEscalado>
          </div>
          <button type="button" onClick={() => gerarCard("baixar")} disabled={gerando} className={E.botaoEscuro}>
            {gerando ? "Gerando imagem…" : "Baixar imagem (1080 x 1920)"}
          </button>
          {podeCompartilhar && (
            <button type="button" onClick={() => gerarCard("compartilhar")} disabled={gerando} className={E.botaoContorno}>
              Compartilhar no Instagram / WhatsApp
            </button>
          )}
          <p className={`text-center text-xs ${E.suave}`}>Deixei um espaço embaixo para você colar o adesivo de @ do salão.</p>
        </section>
      )}

      <button type="button" onClick={pdf} disabled={baixandoPdf} className={E.botaoContorno}>
        {baixandoPdf ? "Gerando PDF…" : "Baixar tabela de preços (PDF)"}
      </button>

      {erro && (
        <p role="alert" className={E.erro}>
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className={E.ok}>
          {aviso}
        </p>
      )}

      <button type="button" onClick={aoNovo} className={`min-h-12 text-center text-sm font-semibold ${E.suave} underline underline-offset-4`}>
        Fazer outro agendamento
      </button>
    </div>
  );
}
