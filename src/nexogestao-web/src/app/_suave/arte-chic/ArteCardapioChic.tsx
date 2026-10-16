"use client";

import { forwardRef } from "react";
import { CHIC, brl, familiaCorpo, familiaTitulo, fonteCorpo, fonteTitulo, tamanhoNomeSalao, type ServicoPublico } from "../../../lib/chic";

export interface DadosCardapioChic {
  nomeSalao: string;
  slogan?: string | null;
  logoUrl?: string | null;
  servicos: Pick<ServicoPublico, "id" | "nome" | "duracaoMinutos" | "preco">[];
  mostrarDuracao: boolean;
  link: string; // sem https://
  qrDataUrl?: string | null;
  instagram?: string;
}

// Tabela de serviços para o feed/WhatsApp: 360 px de largura (exportada em 3x = 1080 px), altura conforme a lista.
const ArteCardapioChic = forwardRef<HTMLDivElement, { d: DadosCardapioChic }>(function ArteCardapioChic({ d }, ref) {
  const arroba = d.instagram ? (d.instagram.startsWith("@") ? d.instagram : `@${d.instagram}`) : null;
  return (
    <div
      ref={ref}
      data-arte
      className={`${fonteTitulo.variable} ${fonteCorpo.variable} relative overflow-hidden`}
      style={{
        width: 360,
        padding: "38px 30px 32px",
        fontFamily: familiaCorpo,
        color: CHIC.chumbo,
        background: `radial-gradient(120% 40% at 50% 0%, ${CHIC.fundoRosado} 0%, ${CHIC.fundo} 70%)`,
      }}
    >
      <div style={{ position: "absolute", inset: 12, border: `1px solid ${CHIC.douradoLinha}`, borderRadius: 22, pointerEvents: "none" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
        {d.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logoUrl} alt="" style={{ width: 58, height: 58, borderRadius: 999, objectFit: "cover", border: `1px solid ${CHIC.douradoLinha}` }} />
        )}
        <div style={{ fontFamily: familiaTitulo, fontSize: tamanhoNomeSalao(d.nomeSalao, 19), letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}>{d.nomeSalao}</div>
        {d.slogan && <div style={{ fontFamily: familiaTitulo, fontStyle: "italic", fontSize: 12.5, color: CHIC.cinza }}>{d.slogan}</div>}
        <div style={{ width: 34, height: 1, background: CHIC.douradoLinha, marginTop: 2 }} />
        <div style={{ fontSize: 10.5, letterSpacing: "0.28em", textTransform: "uppercase", color: CHIC.douradoTexto, fontWeight: 600 }}>Tabela de serviços</div>
      </div>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 13 }}>
        {d.servicos.length === 0 && <div style={{ textAlign: "center", fontSize: 13, color: CHIC.cinza, padding: "24px 0" }}>Selecione serviços para montar a tabela.</div>}
        {d.servicos.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ flex: "0 1 auto", minWidth: 0 }}>
              <div style={{ fontFamily: familiaTitulo, fontSize: 16, fontWeight: 500, lineHeight: 1.2, overflowWrap: "anywhere" }}>{s.nome}</div>
              {d.mostrarDuracao && <div style={{ fontSize: 11, color: CHIC.cinza, marginTop: 2 }}>{s.duracaoMinutos} min</div>}
            </div>
            <div style={{ flex: "1 1 14px", minWidth: 14, borderBottom: `1.5px dotted ${CHIC.douradoLinha}`, alignSelf: "flex-start", marginTop: 13 }} />
            <div style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 600, color: CHIC.douradoTexto, whiteSpace: "nowrap" }}>{brl(s.preco)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${CHIC.quartzo}`, display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
        {d.qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.qrDataUrl} alt="" style={{ width: 58, height: 58, background: "#fff", padding: 4, borderRadius: 8, border: `1px solid ${CHIC.quartzo}` }} />
        )}
        <div style={{ textAlign: d.qrDataUrl ? "left" : "center", fontSize: 11.5, lineHeight: 1.45, color: CHIC.cinza }}>
          <div>Agende pelo celular</div>
          <div style={{ color: CHIC.chumbo, fontWeight: 600, overflowWrap: "anywhere" }}>{d.link}</div>
          {arroba && <div>{arroba}</div>}
        </div>
      </div>
    </div>
  );
});

export default ArteCardapioChic;
