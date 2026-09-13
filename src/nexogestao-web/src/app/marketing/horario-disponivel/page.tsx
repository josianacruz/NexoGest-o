"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

function formatarDataBr(data: string) {
  if (!data) return "";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

interface Molde {
  id: string;
  nome: string;
  thumb: string; // gradiente usado na miniatura (e como base do fundo da arte)
}

const MOLDES: Molde[] = [
  { id: "elegante", nome: "Elegante", thumb: "linear-gradient(160deg,#1a1a1a,#2b2620)" },
  { id: "minimalista", nome: "Minimalista", thumb: "linear-gradient(160deg,#fafafa,#ececec)" },
  { id: "luxo", nome: "Luxo", thumb: "linear-gradient(160deg,#0b0b0b,#1f1a10)" },
  { id: "moderno", nome: "Moderno", thumb: "linear-gradient(135deg,#4f46e5,#0ea5e9)" },
  { id: "delicado", nome: "Delicado", thumb: "linear-gradient(160deg,#ffe4ef,#fbc2d4)" },
  { id: "glam", nome: "Glam", thumb: "linear-gradient(150deg,#3b0764,#831843)" },
  { id: "neon", nome: "Neon", thumb: "linear-gradient(160deg,#050014,#0a0a1a)" },
  { id: "clean", nome: "Clean", thumb: "linear-gradient(160deg,#ffffff,#eef6f6)" },
  { id: "urgencia", nome: "Última Vaga", thumb: "linear-gradient(135deg,#dc2626,#f97316)" },
  { id: "beauty", nome: "Beauty", thumb: "linear-gradient(160deg,#fff1e6,#f6d9c4)" },
];

interface ArteProps {
  moldeId: string;
  empresaNome: string;
  mostrarNome: boolean;
  dataFormatada: string;
  hora: string;
  frase: string;
}

// Cada molde tem composição, tipografia e formas próprias — não é só troca de cor.
function Arte({ moldeId, empresaNome, mostrarNome, dataFormatada, hora, frase }: ArteProps) {
  const nome = mostrarNome ? empresaNome : "";

  switch (moldeId) {
    case "elegante":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 py-8 gap-3" style={{ background: "linear-gradient(160deg,#1a1a1a,#2b2620)", color: "#f2e9d8" }}>
          {nome && <span className="text-[11px] tracking-[0.35em] uppercase opacity-80">{nome}</span>}
          <div className="w-10 h-px bg-[#c9a35c]" />
          <span className="italic text-lg" style={{ fontFamily: "Georgia, serif" }}>Vagou um horário</span>
          <span className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#c9a35c" }}>{dataFormatada}</span>
          <span className="text-5xl font-bold tracking-wide">{hora}</span>
          {frase && <p className="text-sm opacity-80 mt-1">{frase}</p>}
          <div className="w-10 h-px bg-[#c9a35c] mt-1" />
          <span className="text-xs uppercase tracking-[0.25em] border border-[#c9a35c] px-4 py-2 mt-2" style={{ color: "#c9a35c" }}>Agende seu horário</span>
        </div>
      );

    case "minimalista":
      return (
        <div className="w-full h-full flex flex-col justify-between px-8 py-9" style={{ background: "#fafafa", color: "#111" }}>
          {nome && <span className="text-xs tracking-widest uppercase">{nome}</span>}
          <div className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-wide text-black/50">Vagou um horário</span>
            <span className="text-xl font-medium">{dataFormatada}</span>
            <span className="text-6xl font-light tracking-tight -ml-0.5">{hora}</span>
          </div>
          <div className="flex items-center justify-between">
            {frase ? <p className="text-sm text-black/60 max-w-[70%]">{frase}</p> : <span />}
            <span className="text-xs font-semibold uppercase border-b-2 border-black pb-0.5">Agende seu horário</span>
          </div>
        </div>
      );

    case "luxo":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center text-center px-8 py-8 gap-3" style={{ background: "linear-gradient(160deg,#0b0b0b,#1f1a10)", color: "#e9d9ac" }}>
          <div className="absolute inset-3 border border-[#a8842f]" />
          <div className="absolute inset-[18px] border border-[#a8842f]/40" />
          {nome && <span className="text-xs tracking-[0.4em] uppercase">{nome}</span>}
          <span className="text-sm uppercase tracking-[0.3em] opacity-70 mt-2">Vagou um horário</span>
          <span className="text-2xl" style={{ fontFamily: "Georgia, serif" }}>{dataFormatada}</span>
          <span className="text-6xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#f4e3ab" }}>{hora}</span>
          {frase && <p className="text-sm opacity-70 mt-1">{frase}</p>}
          <span className="text-xs uppercase tracking-[0.3em] mt-2" style={{ color: "#0b0b0b", background: "#e9d9ac", padding: "10px 22px" }}>Agende seu horário</span>
        </div>
      );

    case "moderno":
      return (
        <div className="w-full h-full relative overflow-hidden flex flex-col justify-end px-7 py-8 gap-2" style={{ background: "linear-gradient(135deg,#4f46e5,#0ea5e9)", color: "#fff" }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rotate-45" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute top-6 left-7 text-xs font-bold uppercase tracking-wide bg-white text-indigo-700 px-2.5 py-1 w-fit">Vagou um horário!</div>
          {nome && <span className="absolute top-6 right-7 text-xs font-semibold opacity-90">{nome}</span>}
          <span className="text-lg font-semibold opacity-90">{dataFormatada}</span>
          <span className="text-7xl font-extrabold leading-none">{hora}</span>
          {frase && <p className="text-sm opacity-90">{frase}</p>}
          <span className="mt-2 w-fit text-sm font-bold uppercase bg-white text-indigo-700 px-4 py-2 rounded-full">Agende seu horário</span>
        </div>
      );

    case "delicado":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 py-8 gap-2.5" style={{ background: "linear-gradient(160deg,#ffe4ef,#fbc2d4)", color: "#7a2e4a" }}>
          {nome && <span className="text-xs tracking-widest uppercase opacity-80">{nome}</span>}
          <div className="w-8 h-8 rounded-full border border-[#c96d90] flex items-center justify-center text-sm">✿</div>
          <span className="text-sm italic" style={{ fontFamily: "Georgia, serif" }}>Vagou um horariozinho</span>
          <span className="text-2xl" style={{ fontFamily: "Georgia, serif" }}>{dataFormatada}</span>
          <span className="text-5xl font-semibold" style={{ color: "#c96d90" }}>{hora}</span>
          {frase && <p className="text-sm opacity-80">{frase}</p>}
          <span className="text-xs uppercase tracking-wide rounded-full px-4 py-2 mt-1" style={{ background: "#c96d90", color: "#fff" }}>Agende seu horário</span>
        </div>
      );

    case "glam":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center text-center px-8 py-8 gap-2.5" style={{ background: "radial-gradient(circle at 30% 20%, #831843, #3b0764 70%)", color: "#fbcfe8" }}>
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "18px 18px", opacity: 0.15 }} />
          {nome && <span className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color: "#f0abfc" }}>{nome}</span>}
          <span className="text-xs uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: "linear-gradient(90deg,#f0abfc,#f472b6)", color: "#3b0764" }}>Vagou um horário!</span>
          <span className="text-xl font-semibold">{dataFormatada}</span>
          <span className="text-6xl font-black" style={{ background: "linear-gradient(90deg,#fbcfe8,#f472b6)", WebkitBackgroundClip: "text", color: "transparent" }}>{hora}</span>
          {frase && <p className="text-sm opacity-90">{frase}</p>}
          <span className="text-xs font-bold uppercase mt-1 px-4 py-2 rounded-full" style={{ background: "#f472b6", color: "#3b0764" }}>Agende seu horário</span>
        </div>
      );

    case "neon":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 py-8 gap-3" style={{ background: "#050014", color: "#fff" }}>
          {nome && <span className="text-xs tracking-[0.3em] uppercase" style={{ color: "#22d3ee", textShadow: "0 0 8px #22d3ee" }}>{nome}</span>}
          <span className="text-sm uppercase tracking-widest" style={{ color: "#f0f", textShadow: "0 0 8px #f0f" }}>Vagou um horário!</span>
          <span className="text-xl" style={{ color: "#fff", opacity: 0.85 }}>{dataFormatada}</span>
          <span
            className="text-6xl font-extrabold px-4 py-1 border-2 rounded-xl"
            style={{ color: "#22d3ee", borderColor: "#22d3ee", textShadow: "0 0 12px #22d3ee", boxShadow: "0 0 16px rgba(34,211,238,0.6)" }}
          >
            {hora}
          </span>
          {frase && <p className="text-sm opacity-80 mt-1">{frase}</p>}
          <span className="text-xs uppercase font-bold px-4 py-2 mt-1 rounded-full" style={{ background: "#f0f", color: "#050014", boxShadow: "0 0 14px #f0f" }}>Agende seu horário</span>
        </div>
      );

    case "clean":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 py-8 gap-3" style={{ background: "#ffffff", color: "#0f172a" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: "#e0f2f1", color: "#0d9488" }}>📅</div>
          {nome && <span className="text-sm font-semibold" style={{ color: "#0d9488" }}>{nome}</span>}
          <span className="text-xs uppercase tracking-wide text-black/50">Vagou um horário</span>
          <span className="text-2xl font-semibold">{dataFormatada}</span>
          <span className="text-6xl font-bold" style={{ color: "#0d9488" }}>{hora}</span>
          {frase && <p className="text-sm text-black/60">{frase}</p>}
          <span className="text-xs font-bold uppercase px-4 py-2 rounded-lg mt-1" style={{ background: "#0d9488", color: "#fff" }}>Agende seu horário</span>
        </div>
      );

    case "urgencia":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center text-center px-8 py-8 gap-2.5 overflow-hidden" style={{ background: "linear-gradient(135deg,#dc2626,#f97316)", color: "#fff" }}>
          <div className="absolute top-5 -left-10 w-40 text-center text-[11px] font-black uppercase py-1 -rotate-45" style={{ background: "#111", color: "#fff" }}>Última vaga</div>
          {nome && <span className="text-xs font-bold uppercase tracking-wide opacity-90">{nome}</span>}
          <span className="text-lg font-black uppercase mt-2">Vagou um horário!</span>
          <span className="text-xl font-semibold">{dataFormatada}</span>
          <span className="text-7xl font-black leading-none" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.25)" }}>{hora}</span>
          {frase && <p className="text-sm font-medium opacity-95">{frase}</p>}
          <span className="text-sm font-black uppercase px-5 py-2.5 mt-1 rounded-md" style={{ background: "#111", color: "#fff" }}>Agende agora</span>
        </div>
      );

    case "beauty":
    default:
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 py-8 gap-2.5" style={{ background: "linear-gradient(160deg,#fff1e6,#f6d9c4)", color: "#8a5a2b" }}>
          {nome && <span className="text-xs font-semibold tracking-[0.25em] uppercase">{nome}</span>}
          <span className="text-lg" style={{ fontFamily: "Georgia, serif" }}>✨ Vagou um horário ✨</span>
          <span className="text-2xl font-semibold">{dataFormatada}</span>
          <span className="text-5xl font-bold" style={{ color: "#c9822b" }}>{hora}</span>
          {frase && <p className="text-sm opacity-80">{frase}</p>}
          <span className="text-xs font-bold uppercase tracking-wide rounded-full px-5 py-2.5 mt-1" style={{ background: "#c9822b", color: "#fff" }}>Agende seu horário</span>
        </div>
      );
  }
}

export default function DivulgarHorarioPage() {
  return (
    <Suspense>
      <DivulgarHorarioConteudo />
    </Suspense>
  );
}

function DivulgarHorarioConteudo() {
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [linkAgendamento, setLinkAgendamento] = useState("");
  const searchParams = useSearchParams();
  const [data, setData] = useState(searchParams.get("data") ?? "");
  const [hora, setHora] = useState(searchParams.get("hora") ?? "");
  const [frase, setFrase] = useState("");
  const [mostrarNome, setMostrarNome] = useState(true);
  const [moldeId, setMoldeId] = useState<string>(MOLDES[0].id);
  const [formato, setFormato] = useState<"post" | "story">("post");
  const [baixando, setBaixando] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) return;
      setEmpresaNome(empresas[0].nome);
      setComandasHabilitadas(empresas[0].comandasHabilitadas ?? true);
      setLinkAgendamento(`${window.location.origin}/agendar/${empresas[0].id}`);
    })();
  }, [router]);

  async function baixarImagem() {
    if (!previewRef.current) return;
    setBaixando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "horario-disponivel.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setBaixando(false);
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkAgendamento);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  function compartilharWhatsApp() {
    const texto = `Vagou um horário${data ? ` em ${formatarDataBr(data)}` : ""}${hora ? ` às ${hora}` : ""}! ${frase ? frase + " " : ""}Agende pelo link: ${linkAgendamento}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  const dimensoes = formato === "post" ? "aspect-square" : "aspect-[9/16]";

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Divulgar horário disponível" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className={`${cardStyle} p-5 flex flex-col gap-3`}>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className={labelStyle}>Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className={`${inputStyle} cursor-pointer`}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className={labelStyle}>Horário</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className={`${inputStyle} cursor-pointer`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Frase (opcional)</label>
                <input
                  value={frase}
                  onChange={(e) => setFrase(e.target.value)}
                  placeholder="Ex: Chame no WhatsApp pra garantir!"
                  className={inputStyle}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={mostrarNome} onChange={(e) => setMostrarNome(e.target.checked)} className="accent-indigo-600" />
                Mostrar nome da empresa
              </label>

              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Formato</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormato("post")} className={formato === "post" ? botaoPrimario : botaoSecundario}>
                    Post
                  </button>
                  <button type="button" onClick={() => setFormato("story")} className={formato === "story" ? botaoPrimario : botaoSecundario}>
                    Story/Status
                  </button>
                </div>
              </div>
            </div>

            <div className={`${cardStyle} p-5`}>
              <h2 className="text-sm font-semibold mb-3">Escolha o molde</h2>
              <div className="grid grid-cols-5 gap-2">
                {MOLDES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMoldeId(m.id)}
                    title={m.nome}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      moldeId === m.id ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-black/10 dark:border-white/10"
                    }`}
                    style={{ background: m.thumb }}
                  />
                ))}
              </div>
              <p className="text-xs text-center mt-2 text-black/50 dark:text-white/50">{MOLDES.find((m) => m.id === moldeId)?.nome}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div ref={previewRef} className={`w-full max-w-sm ${dimensoes} overflow-hidden relative`}>
              <Arte
                moldeId={moldeId}
                empresaNome={empresaNome || "Sua Empresa"}
                mostrarNome={mostrarNome}
                dataFormatada={data ? formatarDataBr(data) : "Data"}
                hora={hora || "--:--"}
                frase={frase}
              />
            </div>
            <p className="text-xs text-black/40 dark:text-white/40">Pré-visualização da arte</p>

            <button onClick={baixarImagem} disabled={baixando || !data || !hora} className={`${botaoPrimario} w-full max-w-sm`}>
              {baixando ? "Gerando..." : "Baixar imagem"}
            </button>

            <div className="flex items-center gap-2 w-full max-w-sm">
              <input readOnly value={linkAgendamento} onFocus={(e) => e.currentTarget.select()} className={`${inputStyle} flex-1 text-xs`} />
              <button type="button" onClick={copiarLink} className={botaoSecundario}>
                {linkCopiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            <button type="button" onClick={compartilharWhatsApp} className={`${botaoTexto} w-full max-w-sm text-center`}>
              Compartilhar no WhatsApp
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
