"use client";

import { forwardRef } from "react";
import { CHIC, familiaCorpo, familiaTitulo, fonteCorpo, fonteTitulo, tamanhoNomeSalao } from "../../../lib/chic";

export interface DadosConfirmacao {
  nomeCliente: string; // só o primeiro nome aparece
  servico: string;
  diaSemana: string; // "Sexta-feira"
  diaMes: string; // "18 de outubro"
  hora: string; // "14:30"
  nomeSalao: string;
}

// Card do Story (360 x 640, exportado em 1080 x 1920) para a cliente postar a confirmação.
// Deixa um espaço livre na parte de baixo para ela colar o adesivo de @ do salão no Instagram.
const ArteConfirmacaoChic = forwardRef<HTMLDivElement, { d: DadosConfirmacao }>(function ArteConfirmacaoChic({ d }, ref) {
  const primeiroNome = d.nomeCliente.trim().split(/\s+/)[0] ?? "";
  const tam = d.servico.length > 40 ? 22 : d.servico.length > 24 ? 27 : 32;
  return (
    <div
      ref={ref}
      data-arte
      className={`${fonteTitulo.variable} ${fonteCorpo.variable} relative flex flex-col items-center overflow-hidden text-center`}
      style={{
        width: 360,
        height: 640,
        padding: "44px 32px 34px",
        fontFamily: familiaCorpo,
        color: CHIC.chumbo,
        background: `radial-gradient(120% 55% at 50% 0%, ${CHIC.fundoRosado} 0%, ${CHIC.fundo} 64%)`,
      }}
    >
      <div style={{ position: "absolute", inset: 12, border: `1px solid ${CHIC.douradoLinha}`, borderRadius: 22, pointerEvents: "none" }} />

      <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: CHIC.douradoTexto, fontWeight: 600 }}>Agendamento confirmado</div>
      <div style={{ width: 34, height: 1, background: CHIC.douradoLinha, margin: "12px 0 18px" }} />

      <div style={{ fontFamily: familiaTitulo, fontStyle: "italic", fontSize: 21, color: CHIC.cinza }}>{primeiroNome ? `${primeiroNome}, seu momento está reservado` : "Seu momento está reservado"}</div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, width: "100%" }}>
        <div style={{ fontFamily: familiaTitulo, fontSize: tam, lineHeight: 1.1, fontWeight: 600, overflowWrap: "anywhere" }}>{d.servico}</div>
        <div style={{ background: CHIC.quartzo, borderRadius: 24, padding: "16px 28px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: CHIC.chumbo, fontWeight: 600 }}>{d.diaSemana}</div>
          <div style={{ fontFamily: familiaTitulo, fontSize: 22, color: CHIC.chumbo }}>{d.diaMes}</div>
          <div style={{ fontFamily: familiaTitulo, fontSize: 44, lineHeight: 1.1, color: CHIC.douradoTexto, fontWeight: 600 }}>{d.hora}</div>
        </div>
        <div style={{ fontFamily: familiaTitulo, fontSize: tamanhoNomeSalao(d.nomeSalao, 15), letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}>{d.nomeSalao}</div>
      </div>

      {/* espaço para o adesivo de @ do Instagram */}
      <div style={{ width: "100%", height: 74, border: `1.5px dashed ${CHIC.douradoLinha}`, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", color: CHIC.cinza, fontSize: 12, letterSpacing: "0.04em" }}>
        marque aqui o @ do salão ✨
      </div>
    </div>
  );
});

export default ArteConfirmacaoChic;
