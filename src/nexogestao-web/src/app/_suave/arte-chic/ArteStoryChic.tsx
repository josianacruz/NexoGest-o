"use client";

import { forwardRef } from "react";
import { CHIC, brl, familiaCorpo, familiaTitulo, fonteCorpo, fonteTitulo, tamanhoNomeSalao } from "../../../lib/chic";

export interface DadosStoryChic {
  nomeSalao: string;
  slogan?: string | null;
  logoUrl?: string | null;
  chamadaTopo: string; // ex.: "Promoção da semana"
  servicoNome: string;
  descricao?: string;
  precoNormal?: number | null;
  precoPromo?: number | null; // se vier, mostra "de … por …"
  duracaoMinutos?: number | null;
  chamadaAcao: string; // ex.: "Agende pelo link"
  link: string; // já sem https://
  qrDataUrl?: string | null;
  instagram?: string;
}

// Story do Instagram em 360 x 640 (proporção 9:16). Exportado em 3x = 1080 x 1920.
// É uma "arte": mantém as próprias cores e fontes e não segue o modo claro/escuro da tela (data-arte).
const ArteStoryChic = forwardRef<HTMLDivElement, { d: DadosStoryChic }>(function ArteStoryChic({ d }, ref) {
  const desconto = d.precoPromo != null && d.precoNormal && d.precoNormal > d.precoPromo ? Math.round((1 - d.precoPromo / d.precoNormal) * 100) : null;
  const nomeTam = d.servicoNome.length > 44 ? 24 : d.servicoNome.length > 26 ? 30 : 38;
  const arroba = d.instagram ? (d.instagram.startsWith("@") ? d.instagram : `@${d.instagram}`) : null;

  return (
    <div
      ref={ref}
      data-arte
      className={`${fonteTitulo.variable} ${fonteCorpo.variable} relative flex flex-col items-center overflow-hidden text-center`}
      style={{
        width: 360,
        height: 640,
        padding: "34px 30px 30px",
        fontFamily: familiaCorpo,
        color: CHIC.chumbo,
        background: `radial-gradient(120% 55% at 50% 0%, ${CHIC.fundoRosado} 0%, ${CHIC.fundo} 62%)`,
      }}
    >
      {/* moldura dourada fina */}
      <div style={{ position: "absolute", inset: 12, border: `1px solid ${CHIC.douradoLinha}`, borderRadius: 22, pointerEvents: "none" }} />

      {/* marca do salão */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {d.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logoUrl} alt="" style={{ width: 62, height: 62, borderRadius: 999, objectFit: "cover", border: `1px solid ${CHIC.douradoLinha}` }} />
        )}
        <div style={{ fontFamily: familiaTitulo, fontSize: tamanhoNomeSalao(d.nomeSalao, 14), letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}>{d.nomeSalao}</div>
        {d.slogan && <div style={{ fontFamily: familiaTitulo, fontStyle: "italic", fontSize: 12, color: CHIC.cinza }}>{d.slogan}</div>}
        <div style={{ width: 34, height: 1, background: CHIC.douradoLinha, marginTop: 2 }} />
      </div>

      {/* destaque */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, width: "100%" }}>
        <div style={{ background: CHIC.quartzo, color: CHIC.chumbo, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, padding: "6px 14px", borderRadius: 999 }}>
          {d.chamadaTopo}
        </div>
        <div style={{ fontFamily: familiaTitulo, fontSize: nomeTam, lineHeight: 1.08, fontWeight: 600, overflowWrap: "anywhere" }}>{d.servicoNome}</div>
        {d.descricao && <div style={{ fontSize: 13.5, lineHeight: 1.4, color: CHIC.cinza, maxWidth: 270 }}>{d.descricao}</div>}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginTop: 6 }}>
          {d.precoPromo != null ? (
            <>
              {d.precoNormal != null && <div style={{ fontSize: 14, color: CHIC.cinza, textDecoration: "line-through" }}>de {brl(d.precoNormal)}</div>}
              <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: CHIC.douradoTexto, fontWeight: 600 }}>por apenas</div>
              <div style={{ fontFamily: familiaTitulo, fontSize: 50, lineHeight: 1.05, color: CHIC.douradoTexto, fontWeight: 600 }}>{brl(d.precoPromo)}</div>
              {desconto != null && desconto > 0 && (
                <div style={{ marginTop: 6, background: CHIC.quartzoForte, color: CHIC.chumbo, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>{desconto}% OFF</div>
              )}
            </>
          ) : (
            d.precoNormal != null && <div style={{ fontFamily: familiaTitulo, fontSize: 46, lineHeight: 1.05, color: CHIC.douradoTexto, fontWeight: 600 }}>{brl(d.precoNormal)}</div>
          )}
          {d.duracaoMinutos ? <div style={{ fontSize: 12, color: CHIC.cinza, marginTop: 6 }}>⏱ {d.duracaoMinutos} min</div> : null}
        </div>
      </div>

      {/* chamada para ação */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ background: CHIC.chumbo, color: CHIC.fundo, fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", padding: "11px 26px", borderRadius: 999 }}>{d.chamadaAcao}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", justifyContent: "center" }}>
          {d.qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.qrDataUrl} alt="" style={{ width: 62, height: 62, background: "#fff", padding: 4, borderRadius: 8, border: `1px solid ${CHIC.quartzo}` }} />
          )}
          <div style={{ textAlign: d.qrDataUrl ? "left" : "center", fontSize: 11.5, lineHeight: 1.45, color: CHIC.cinza }}>
            <div style={{ color: CHIC.chumbo, fontWeight: 600, overflowWrap: "anywhere" }}>{d.link}</div>
            {arroba && <div>{arroba}</div>}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ArteStoryChic;
