"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

function formatarDataBr(data: string) {
  if (!data) return "";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [data, setData] = useState(searchParams.get("data") ?? "");
  const [hora, setHora] = useState(searchParams.get("hora") ?? "");
  const [frase, setFrase] = useState("");
  const [formato, setFormato] = useState<"post" | "story">("post");
  const [baixando, setBaixando] = useState(false);
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

  useEffect(() => {
    if (!linkAgendamento) return;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      setQrDataUrl(await QRCode.toDataURL(linkAgendamento, { margin: 1, width: 240 }));
    })();
  }, [linkAgendamento]);

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

  const dimensoes = formato === "post" ? "aspect-square" : "aspect-[9/16]";

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Divulgar horário disponível" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                placeholder="Ex: Chame no WhatsApp ou clique no link!"
                className={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Formato</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormato("post")}
                  className={formato === "post" ? botaoPrimario : botaoSecundario}
                >
                  Post
                </button>
                <button
                  type="button"
                  onClick={() => setFormato("story")}
                  className={formato === "story" ? botaoPrimario : botaoSecundario}
                >
                  Story/Status
                </button>
              </div>
            </div>

            <button onClick={baixarImagem} disabled={baixando || !data || !hora} className={`${botaoPrimario} mt-2`}>
              {baixando ? "Gerando..." : "Baixar imagem"}
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div
              ref={previewRef}
              className={`w-full max-w-sm ${dimensoes} overflow-hidden relative flex flex-col justify-center items-center gap-3 px-6 py-6 text-center bg-gradient-to-b from-indigo-950 to-black text-white`}
            >
              <span className="text-xs font-semibold tracking-wide opacity-80">{empresaNome}</span>
              <span className="inline-block w-fit text-xs font-bold uppercase tracking-wide px-2.5 py-1 bg-indigo-500">
                Vagou um horário!
              </span>
              <h2 className="text-2xl font-bold leading-tight">
                {data ? formatarDataBr(data) : "Data"} {hora && `às ${hora}`}
              </h2>
              {frase && <p className="text-sm opacity-80">{frase}</p>}
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code para agendar" className="w-32 h-32 bg-white p-2 rounded-lg mt-1" />
              )}
              <p className="text-xs opacity-60 break-all mt-1">{linkAgendamento}</p>
            </div>
            <p className="text-xs text-black/40 dark:text-white/40 mt-2">Pré-visualização da arte</p>
          </div>
        </div>
      </main>
    </>
  );
}
