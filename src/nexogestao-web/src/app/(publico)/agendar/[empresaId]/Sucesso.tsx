"use client";

import { useEffect, useRef, useState } from "react";
import { brl } from "../../../../lib/chic";
import { artePng, baixarPng, compartilharImagem, podeCompartilharImagem } from "../../../../lib/exportarArte";
import { E } from "../../_estilo";
import { dataDaChave, diaLongo, type Loja } from "../../_dados";
import ArteComprovante from "./ArteComprovante";

export interface Reserva {
  servico: string;
  preco: number; // o que a cliente paga (já com a promoção, se houver)
  precoNormal?: number; // preenchido só quando havia promoção
  dia: string; // yyyy-mm-dd
  hora: string; // HH:mm
  nome: string;
}

// Confirmação: resumo, botão do WhatsApp do salão e, SÓ se a cliente quiser, o comprovante em imagem para os Stories.
// A arte não existe na tela até o toque: é montada fora da vista, "fotografada" e descartada.
export default function Sucesso({ loja, reserva, aoNovo }: { loja: Loja; reserva: Reserva; aoNovo: () => void }) {
  const [montar, setMontar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const d = dataDaChave(reserva.dia);
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  const diaMes = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const dataCurta = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const mensagem = `Olá! Aqui é a ${reserva.nome}. Acabei de agendar ${reserva.servico} para ${diaSemana.toLowerCase()}, ${dataCurta}, às ${reserva.hora}. Posso contar com vocês? 💖`;
  const linkZap = loja.whatsapp ? `https://wa.me/${loja.whatsapp}?text=${encodeURIComponent(mensagem)}` : null;

  useEffect(() => {
    if (!montar) return;
    let vivo = true;
    (async () => {
      try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!cardRef.current) throw new Error("Não consegui montar a imagem. Tente de novo.");
        const blob = await artePng(cardRef.current, 1080); // 360 x 640 na tela → 1080 x 1920 no arquivo
        if (!vivo) return;
        if (podeCompartilharImagem(blob, "meu-comprovante.png")) await compartilharImagem(blob, "meu-comprovante");
        else {
          baixarPng(blob, "meu-comprovante");
          setAviso("Imagem salva! Agora é só postar no seu Story. 💖");
        }
      } catch (e) {
        if (vivo && !(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : "Não consegui gerar a imagem.");
      } finally {
        if (vivo) setMontar(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [montar]);

  const temPromo = reserva.precoNormal !== undefined && reserva.precoNormal > reserva.preco;

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
            <dd className={`text-right font-semibold ${E.dourado}`}>
              {temPromo && <span className={`mr-2 text-sm font-normal line-through ${E.suave}`}>{brl(reserva.precoNormal as number)}</span>}
              {brl(reserva.preco)}
            </dd>
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

      <button type="button" onClick={() => { setErro(null); setAviso(null); setMontar(true); }} disabled={montar} className={E.botaoContorno}>
        {montar ? "Gerando imagem…" : "Baixar meu comprovante em imagem para os Stories"}
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

      {montar && (
        <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          <ArteComprovante ref={cardRef} d={{ nomeCliente: reserva.nome, servico: reserva.servico, diaSemana, diaMes, hora: reserva.hora, nomeSalao: loja.nome }} />
        </div>
      )}
    </div>
  );
}
