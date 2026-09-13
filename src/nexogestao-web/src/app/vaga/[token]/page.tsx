"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { inputStyle, labelStyle, botaoPrimario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
}

interface VagaInfo {
  status: "Ativa" | "Preenchida" | "Expirada";
  empresaId: number;
  empresaNome: string;
  dataHora?: string;
  servicos?: Servico[];
  mensagem?: string;
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function VagaPage() {
  const params = useParams();
  const token = params.token as string;

  const [vaga, setVaga] = useState<VagaInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [preenchida, setPreenchida] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ servico: string; dataHora: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/publico/vagas/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setErro("Link inválido.");
          return;
        }
        const data = await res.json();
        setVaga(data);
        if (data.status !== "Ativa") setPreenchida(true);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!servicoId || enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/publico/vagas/${token}/agendamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicoId, nomeCliente: nome, celular }),
      });

      if (res.status === 409) {
        setPreenchida(true);
        return;
      }

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível confirmar o agendamento."));
        return;
      }

      const agendamento = await res.json();
      setConfirmado({ servico: agendamento.servicoNome, dataHora: agendamento.dataHora });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <main className="max-w-md mx-auto px-4 py-10 text-sm text-black/50 dark:text-white/50">Carregando...</main>;
  }

  if (!vaga) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-sm text-red-600">Link inválido.</p>
      </main>
    );
  }

  if (preenchida) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <div className={`${cardStyle} p-6 text-center`}>
          <h1 className="text-lg font-semibold mb-2">Este horário já foi preenchido</h1>
          <p className="text-sm text-black/60 dark:text-white/60 mb-4">Alguém garantiu essa vaga antes de você.</p>
          <a href={`/agendar/${vaga.empresaId}`} className={botaoPrimario}>
            Ver outros horários
          </a>
        </div>
      </main>
    );
  }

  if (confirmado) {
    const dt = new Date(confirmado.dataHora);
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <div className={`${cardStyle} p-6 text-center`}>
          <h1 className="text-lg font-semibold mb-2">Agendamento confirmado!</h1>
          <p className="text-sm text-black/70 dark:text-white/70">
            {confirmado.servico} em {dt.toLocaleDateString("pt-BR", { timeZone: "UTC" })} às{" "}
            {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}.
          </p>
        </div>
      </main>
    );
  }

  const dataHora = vaga.dataHora ? new Date(vaga.dataHora) : null;
  const servicos = vaga.servicos ?? [];

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-lg font-semibold mb-1">{vaga.empresaNome}</h1>
      <p className="text-sm text-black/50 dark:text-white/50 mb-5">Vagou um horário — garanta o seu!</p>

      <form onSubmit={confirmar} className={`${cardStyle} p-5 flex flex-col gap-4`}>
        <div className={`${inputStyle} font-semibold`}>
          {dataHora?.toLocaleDateString("pt-BR", { timeZone: "UTC" })} às{" "}
          {dataHora?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
        </div>

        {servicos.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Nenhum serviço cabe nesse horário no momento.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label className={labelStyle}>Serviço</label>
            <select
              value={servicoId ?? ""}
              onChange={(e) => setServicoId(Number(e.target.value) || null)}
              required
              className={inputStyle}
            >
              <option value="">Selecione...</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.duracaoMinutos} min) — R$ {s.preco.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        {servicoId && (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Seu nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Celular (com DDD)</label>
              <input
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="(11) 91234-5678"
                required
                className={inputStyle}
              />
            </div>
          </>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {servicoId && (
          <button type="submit" disabled={enviando} className={botaoPrimario}>
            {enviando ? "Confirmando..." : "Confirmar agendamento"}
          </button>
        )}
      </form>
    </main>
  );
}
