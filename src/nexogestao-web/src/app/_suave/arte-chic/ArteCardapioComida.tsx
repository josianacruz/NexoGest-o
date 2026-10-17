"use client";

import { forwardRef } from "react";
import { brl, familiaCorpo, familiaTitulo, fonteCorpo, fonteTitulo, tamanhoNomeSalao } from "../../../lib/chic";

// Cores do cardápio de comida: papel creme, marrom-café no texto, tomate nos preços e mostarda nos filetes.
// Todos os textos têm contraste mínimo de 4,5:1 sobre o creme.
export const COMIDA = {
  papel: "#FBF4E8",
  papelEscuro: "#F3E6D0",
  cafe: "#3B2A20", // texto principal
  cafeClaro: "#6A574A", // texto secundário
  tomate: "#B23A24", // preços e títulos de categoria
  tomateEscuro: "#8F2C1A",
  mostarda: "#D5A24B", // filetes e ornamentos
  creme: "#FFF9EE",
} as const;

export interface OpcaoComida {
  nome: string;
  preco: number;
}

export interface ItemComida {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao?: string; // ingredientes ou frase livre
  tamanhos?: OpcaoComida[];
  adicionais?: OpcaoComida[];
}

export interface DadosCardapioComida {
  nome: string;
  slogan?: string | null;
  logoUrl?: string | null;
  capaUrl?: string | null;
  itens: ItemComida[];
  whatsapp?: string; // já formatado, ex.: (11) 99999-0000
  instagram?: string;
}

function porCategoria(itens: ItemComida[]) {
  const grupos: { categoria: string; itens: ItemComida[] }[] = [];
  for (const item of itens) {
    const g = grupos.find((x) => x.categoria === item.categoria);
    if (g) g.itens.push(item);
    else grupos.push({ categoria: item.categoria, itens: [item] });
  }
  return grupos;
}

function Ornamento() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} aria-hidden>
      <span style={{ width: 28, height: 1, background: COMIDA.mostarda }} />
      <span style={{ color: COMIDA.mostarda, fontSize: 11, lineHeight: 1 }}>✦</span>
      <span style={{ width: 28, height: 1, background: COMIDA.mostarda }} />
    </div>
  );
}

// Cardápio para o feed/WhatsApp: 360 px de largura (exportado em 3x = 1080 px), altura conforme a lista.
const ArteCardapioComida = forwardRef<HTMLDivElement, { d: DadosCardapioComida }>(function ArteCardapioComida({ d }, ref) {
  const grupos = porCategoria(d.itens);
  const arroba = d.instagram ? (d.instagram.startsWith("@") ? d.instagram : `@${d.instagram}`) : null;
  const temRodape = !!(d.whatsapp || arroba);

  return (
    <div
      ref={ref}
      data-arte
      className={`${fonteTitulo.variable} ${fonteCorpo.variable} relative overflow-hidden`}
      style={{ width: 360, fontFamily: familiaCorpo, color: COMIDA.cafe, background: COMIDA.papel }}
    >
      {/* Capa: foto do prato (opcional) ou faixa de cor com ornamento */}
      <div style={{ position: "relative", height: d.capaUrl ? 170 : 74, background: `linear-gradient(135deg, ${COMIDA.tomate} 0%, ${COMIDA.tomateEscuro} 100%)` }}>
        {d.capaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.capaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: d.capaUrl ? "linear-gradient(180deg, rgba(59,42,32,0) 55%, rgba(59,42,32,0.35) 100%)" : "none" }} />
        <svg viewBox="0 0 360 22" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 22, display: "block" }} aria-hidden>
          <path d="M0 22 L0 12 Q 90 -4 180 12 T 360 12 L360 22 Z" fill={COMIDA.papel} />
        </svg>
      </div>

      <div style={{ position: "relative", marginTop: d.logoUrl ? -34 : -4, padding: "0 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textAlign: "center" }}>
        {d.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logoUrl} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: "cover", border: `3px solid ${COMIDA.papel}`, boxShadow: `0 0 0 1px ${COMIDA.mostarda}` }} />
        )}
        <div style={{ fontFamily: familiaTitulo, fontSize: tamanhoNomeSalao(d.nome, 24), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.2, overflowWrap: "anywhere" }}>{d.nome}</div>
        {d.slogan && <div style={{ fontFamily: familiaTitulo, fontStyle: "italic", fontSize: 13, color: COMIDA.cafeClaro }}>{d.slogan}</div>}
        <Ornamento />
        <div style={{ fontSize: 11, letterSpacing: "0.34em", textTransform: "uppercase", fontWeight: 600, color: COMIDA.tomate, paddingLeft: "0.34em" }}>Cardápio</div>
      </div>

      <div style={{ padding: "20px 28px 26px", display: "flex", flexDirection: "column", gap: 24 }}>
        {grupos.length === 0 && <div style={{ textAlign: "center", fontSize: 13, color: COMIDA.cafeClaro, padding: "24px 0" }}>Marque os pratos para montar o cardápio.</div>}

        {grupos.map((g) => (
          <section key={g.categoria}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ flex: 1, height: 1, background: COMIDA.mostarda }} />
              <h3 style={{ margin: 0, fontFamily: familiaTitulo, fontStyle: "italic", fontWeight: 600, fontSize: 19, color: COMIDA.tomate, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere" }}>{g.categoria}</h3>
              <span style={{ flex: 1, height: 1, background: COMIDA.mostarda }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {g.itens.map((item) => (
                <div key={item.id}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ flex: "0 1 auto", minWidth: 0, fontFamily: familiaTitulo, fontSize: 16, fontWeight: 600, lineHeight: 1.25, overflowWrap: "anywhere" }}>{item.nome}</div>
                    <div style={{ flex: "1 1 14px", minWidth: 14, borderBottom: `1.5px dotted ${COMIDA.mostarda}`, alignSelf: "flex-start", marginTop: 12 }} />
                    {!item.tamanhos?.length && <div style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 700, color: COMIDA.tomate, whiteSpace: "nowrap" }}>{brl(item.preco)}</div>}
                  </div>
                  {item.descricao && <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.4, fontStyle: "italic", color: COMIDA.cafeClaro, overflowWrap: "anywhere" }}>{item.descricao}</div>}
                  {!!item.tamanhos?.length && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.tamanhos.map((t) => (
                        <span key={t.nome} style={{ display: "inline-flex", gap: 6, alignItems: "baseline", padding: "3px 9px", borderRadius: 999, background: COMIDA.papelEscuro, fontSize: 11.5, color: COMIDA.cafe }}>
                          {t.nome}
                          <strong style={{ color: COMIDA.tomate, fontWeight: 700 }}>{brl(t.preco)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {!!item.adicionais?.length && (
                    <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.45, color: COMIDA.cafeClaro }}>
                      <span style={{ fontWeight: 600, color: COMIDA.cafe }}>Turbine: </span>
                      {item.adicionais.map((a) => `${a.nome} +${brl(a.preco)}`).join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {temRodape ? (
        <div style={{ background: `linear-gradient(135deg, ${COMIDA.tomate} 0%, ${COMIDA.tomateEscuro} 100%)`, color: COMIDA.creme, padding: "16px 28px 18px", textAlign: "center", display: "flex", flexDirection: "column", gap: 3 }}>
          {d.whatsapp && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 500, paddingLeft: "0.3em" }}>Peça pelo WhatsApp</div>
              <div style={{ fontFamily: familiaTitulo, fontSize: 21, fontWeight: 700, letterSpacing: "0.02em" }}>{d.whatsapp}</div>
            </>
          )}
          {arroba && <div style={{ fontSize: 12.5, opacity: 0.95 }}>{arroba}</div>}
        </div>
      ) : (
        <div style={{ height: 8, background: COMIDA.tomate }} />
      )}
    </div>
  );
});

export default ArteCardapioComida;
