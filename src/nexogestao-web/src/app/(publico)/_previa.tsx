import { ImageResponse } from "next/og";
import type { Metadata } from "next";
import { API_URL } from "../../lib/api";
import { separarNomeEslogan } from "../../lib/modulos";

// Prévia do link no WhatsApp, Instagram e afins: quando alguém envia /tabela/<loja> ou /agendar/<loja>, o aplicativo
// busca estas informações e mostra um cartão com a imagem, o título e o texto, que a pessoa toca para abrir.
// Funciona igual quando o link é enviado do celular ou do computador (WhatsApp Web), porque a imagem vem do link.

export interface DadosDaPrevia {
  nome: string;
  slogan: string | null;
  servicos: { id?: number; nome: string; preco: number }[];
  promocoes: { servicoId: number; titulo: string; precoPromocional: number; precoNormal: number }[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const TAMANHO_PREVIA = { width: 1200, height: 630 };

// Busca no servidor (guardada por 5 minutos). Se a API estiver acordando ou fora do ar, devolve null e a prévia sai genérica.
export async function buscarDadosDaPrevia(empresaId: string, completa: boolean): Promise<DadosDaPrevia | null> {
  try {
    const res = await fetch(`${API_URL}/api/publico/empresas/${encodeURIComponent(empresaId)}/agenda/pagina${completa ? "?completa=true" : ""}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const n = separarNomeEslogan(String(d.nome ?? ""));
    return { nome: n.nome, slogan: n.slogan, servicos: d.servicos ?? [], promocoes: d.promocoes ?? [] };
  } catch {
    return null;
  }
}

export function metadadosDaPrevia(dados: DadosDaPrevia | null, tipo: "tabela" | "agendar"): Metadata {
  const nome = dados?.nome ?? "Seu salão";
  const titulo = tipo === "tabela" ? `${nome} · Tabela de serviços` : `${nome} · Agende seu horário`;
  const descricao = tipo === "tabela" ? "Veja os serviços e os valores e agende o seu horário pelo celular." : "Veja os serviços e os valores e já agende o seu horário em poucos toques.";
  return { title: titulo, description: descricao, openGraph: { title: titulo, description: descricao, type: "website", locale: "pt_BR" } };
}

const ROSA = "#F2C9CD";
const CREME = "#FAF7F4";
const CHUMBO = "#2F3036";
const CINZA = "#66666E";
const DOURADO = "#8A6A2F";
const LINHA = "#C9A96E";

function Moldura({ nome, slogan, selo, children }: { nome: string; slogan: string | null; selo: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: `linear-gradient(135deg, ${ROSA} 0%, ${CREME} 55%)`, padding: 28, color: CHUMBO }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: `2px solid ${LINHA}`, borderRadius: 32, padding: "34px 52px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: nome.length > 22 ? 46 : 58, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", lineHeight: 1.1 }}>{nome}</div>
          {slogan && <div style={{ fontSize: 26, fontStyle: "italic", color: CINZA, marginTop: 6 }}>{slogan}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
            <div style={{ width: 54, height: 2, background: LINHA }} />
            <div style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: DOURADO, fontWeight: 700 }}>{selo}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 8 }}>{children}</div>
      </div>
    </div>
  );
}

export function imagemTabela(dados: DadosDaPrevia | null) {
  const nome = dados?.nome ?? "Tabela de serviços";
  const lista = (dados?.servicos ?? []).slice(0, 5);
  const resto = Math.max(0, (dados?.servicos.length ?? 0) - lista.length);
  return new ImageResponse(
    (
      <Moldura nome={nome} slogan={dados?.slogan ?? null} selo="Tabela de serviços">
        {lista.length === 0 ? (
          <div style={{ fontSize: 34, color: CINZA }}>Toque para ver os serviços e os valores</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lista.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ fontSize: 34, fontWeight: 600, maxWidth: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.nome}</div>
                <div style={{ flex: 1, margin: "0 14px", borderBottom: `3px dashed ${LINHA}`, height: 18 }} />
                <div style={{ fontSize: 34, fontWeight: 700, color: DOURADO }}>{brl(s.preco)}</div>
              </div>
            ))}
            {resto > 0 && <div style={{ fontSize: 24, color: CINZA }}>{`e mais ${resto} ${resto === 1 ? "serviço" : "serviços"}`}</div>}
          </div>
        )}
      </Moldura>
    ),
    TAMANHO_PREVIA
  );
}

function ListaDeServicos({ servicos, max }: { servicos: { nome: string; preco: number }[]; max: number }) {
  const lista = servicos.slice(0, max);
  const resto = Math.max(0, servicos.length - lista.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {lista.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline" }}>
          <div style={{ fontSize: 34, fontWeight: 600, maxWidth: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.nome}</div>
          <div style={{ flex: 1, margin: "0 14px", borderBottom: `3px dashed ${LINHA}`, height: 18 }} />
          <div style={{ fontSize: 34, fontWeight: 700, color: DOURADO }}>{brl(s.preco)}</div>
        </div>
      ))}
      {resto > 0 && <div style={{ fontSize: 24, color: CINZA }}>{`e mais ${resto} ${resto === 1 ? "serviço" : "serviços"}`}</div>}
    </div>
  );
}

// Prévia do link de AGENDAMENTO: já mostra os serviços e os valores (e a promoção, se houver) e chama para agendar.
export function imagemAgendar(dados: DadosDaPrevia | null) {
  const nome = dados?.nome ?? "Agende seu horário";
  const promo = dados?.promocoes?.[0];
  const servicos = dados?.servicos ?? [];
  const nomeDaPromo = promo ? servicos.find((x) => x.id === promo.servicoId)?.nome : undefined;
  return new ImageResponse(
    (
      <Moldura nome={nome} slogan={dados?.slogan ?? null} selo="Agende seu horário">
        {promo ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
                <div style={{ fontSize: 22, letterSpacing: 5, textTransform: "uppercase", color: DOURADO, fontWeight: 700 }}>{promo.titulo}</div>
                <div style={{ fontSize: 40, fontWeight: 600, marginTop: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{nomeDaPromo ?? "Serviço em promoção"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={{ fontSize: 28, color: CINZA, textDecoration: "line-through" }}>{brl(promo.precoNormal)}</div>
                <div style={{ fontSize: 60, fontWeight: 700 }}>{brl(promo.precoPromocional)}</div>
              </div>
            </div>
            <ListaDeServicos servicos={servicos.filter((x) => x.id !== promo.servicoId)} max={2} />
          </div>
        ) : servicos.length === 0 ? (
          <div style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.15 }}>Escolha o serviço, o dia e o horário</div>
        ) : (
          <ListaDeServicos servicos={servicos} max={4} />
        )}
        <div style={{ display: "flex", marginTop: 18, fontSize: 26, color: CINZA }}>Toque para escolher o horário e agendar</div>
      </Moldura>
    ),
    TAMANHO_PREVIA
  );
}
