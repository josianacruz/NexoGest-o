"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { inputStyle, labelStyle, botaoPrimario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface ProdutoInfo {
  disponivel: boolean;
  mensagem?: string | null;
  empresaNome: string;
  produtoNome: string;
  preco: number;
  fotoUrl?: string | null;
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function InteressePage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<ProdutoInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/publico/interesses/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setErro("Link inválido.");
          return;
        }
        setInfo(await res.json());
      })
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviarInteresse(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !consentimento) return;
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/publico/interesses/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeCliente: nome, celular }),
      });

      if (res.status === 409) {
        setInfo((i) => (i ? { ...i, disponivel: false, mensagem: "Essa peça não está mais disponível." } : i));
        return;
      }

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível registrar seu interesse."));
        return;
      }

      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <main className="max-w-sm mx-auto px-4 py-10 text-sm text-black/50 dark:text-white/50">Carregando...</main>;
  }

  if (!info) {
    return (
      <main className="max-w-sm mx-auto px-4 py-10">
        <p className="text-sm text-red-600">Link inválido.</p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-8">
      <div className={`${cardStyle} overflow-hidden`}>
        {info.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.fotoUrl} alt={info.produtoNome} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-black/5 dark:bg-white/5 flex items-center justify-center text-4xl">
            💎
          </div>
        )}

        <div className="p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-black/50 dark:text-white/50">{info.empresaNome}</span>
          <h1 className="text-lg font-semibold leading-tight">{info.produtoNome}</h1>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            R$ {info.preco.toFixed(2)}
          </span>

          {!info.disponivel ? (
            <p className="text-sm text-red-600 mt-2">{info.mensagem ?? "Essa peça não está mais disponível."}</p>
          ) : enviado ? (
            <div className="mt-2 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm p-3">
              Interesse registrado! A loja pode demorar um pouco para responder — fique de olho no WhatsApp. 💎
            </div>
          ) : !mostrarForm ? (
            <button onClick={() => setMostrarForm(true)} className={`${botaoPrimario} mt-2`}>
              Tenho interesse 💎
            </button>
          ) : (
            <form onSubmit={enviarInteresse} className="flex flex-col gap-3 mt-2">
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus className={inputStyle} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>WhatsApp (com DDD)</label>
                <input
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="(11) 91234-5678"
                  required
                  className={inputStyle}
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-black/60 dark:text-white/60">
                <input
                  type="checkbox"
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  className="mt-0.5 accent-indigo-600"
                  required
                />
                Concordo em ser contatado(a) pela loja no WhatsApp sobre esse item.
              </label>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <button type="submit" disabled={enviando || !consentimento} className={botaoPrimario}>
                {enviando ? "Enviando..." : "Confirmar interesse"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
