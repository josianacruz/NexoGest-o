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

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function AutoagendamentoPage() {
  const params = useParams();
  const empresaId = Number(params.empresaId);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroInicial, setErroInicial] = useState<string | null>(null);

  const [servicoId, setServicoId] = useState<number | null>(null);
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ data: string; hora: string; servico: string } | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    fetch(`${API_URL}/api/publico/empresas/${empresaId}/agenda/servicos`)
      .then(async (res) => {
        if (!res.ok) {
          setErroInicial(await mensagemDeErro(res, "Agendamento não disponível para esta empresa."));
          return;
        }
        const lista = await res.json();
        setServicos(lista);
        if (lista.length === 0) {
          setErroInicial("Nenhum serviço disponível para agendamento online no momento.");
        }
      })
      .catch(() => setErroInicial("Não foi possível carregar os serviços."))
      .finally(() => setCarregando(false));
  }, [empresaId]);

  useEffect(() => {
    setHora(null);
    setHorarios([]);
    if (!servicoId || !data) return;

    setBuscandoHorarios(true);
    fetch(`${API_URL}/api/publico/empresas/${empresaId}/agenda/horarios?servicoId=${servicoId}&data=${data}`)
      .then(async (res) => {
        if (!res.ok) {
          setHorarios([]);
          return;
        }
        setHorarios(await res.json());
      })
      .finally(() => setBuscandoHorarios(false));
  }, [servicoId, data, empresaId]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!servicoId || !data || !hora || enviando) return;
    setErro(null);
    setEnviando(true);

    try {
      const res = await fetch(`${API_URL}/api/publico/empresas/${empresaId}/agenda/agendamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicoId,
          data,
          hora,
          nomeCliente: nome,
          celular,
        }),
      });

      if (res.status === 409) {
        setErro(await mensagemDeErro(res, "Esse horário acabou de ficar indisponível. Escolha outro."));
        setHora(null);
        // Atualiza a lista de horários pra refletir o que acabou de ocupar.
        setData((d) => d);
        const resHorarios = await fetch(
          `${API_URL}/api/publico/empresas/${empresaId}/agenda/horarios?servicoId=${servicoId}&data=${data}`
        );
        if (resHorarios.ok) setHorarios(await resHorarios.json());
        return;
      }

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível confirmar o agendamento."));
        return;
      }

      const servico = servicos.find((s) => s.id === servicoId);
      setConfirmado({ data, hora, servico: servico?.nome ?? "" });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <main className="max-w-md mx-auto px-4 py-10 text-sm text-black/50 dark:text-white/50">Carregando...</main>;
  }

  if (erroInicial) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-sm text-red-600">{erroInicial}</p>
      </main>
    );
  }

  if (confirmado) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <div className={`${cardStyle} p-6 text-center`}>
          <h1 className="text-lg font-semibold mb-2">Agendamento confirmado!</h1>
          <p className="text-sm text-black/70 dark:text-white/70">
            {confirmado.servico} em{" "}
            {new Date(confirmado.data + "T00:00:00").toLocaleDateString("pt-BR")} às {confirmado.hora}.
          </p>
        </div>
      </main>
    );
  }

  const servicoSelecionado = servicos.find((s) => s.id === servicoId);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-lg font-semibold mb-5">Agendar horário</h1>

      <form onSubmit={confirmar} className={`${cardStyle} p-5 flex flex-col gap-4`}>
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

        <div className="flex flex-col gap-1">
          <label className={labelStyle}>Data</label>
          <input
            type="date"
            min={hoje}
            value={data}
            onChange={(e) => setData(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={!servicoId}
            required
            className={`${inputStyle} cursor-pointer`}
          />
        </div>

        {servicoId && data && (
          <div className="flex flex-col gap-2">
            <label className={labelStyle}>Horário</label>
            {buscandoHorarios ? (
              <p className="text-sm text-black/50 dark:text-white/50">Buscando horários...</p>
            ) : horarios.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">Nenhum horário disponível nesse dia.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {horarios.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHora(h)}
                    className={`h-9 px-3 rounded-lg text-sm border ${
                      hora === h
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hora && (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Seu nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className={inputStyle}
              />
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

        {hora && (
          <button type="submit" disabled={enviando} className={botaoPrimario}>
            {enviando
              ? "Confirmando..."
              : `Confirmar ${servicoSelecionado?.nome ?? ""} em ${data ? new Date(data + "T00:00:00").toLocaleDateString("pt-BR") : ""} às ${hora}`}
          </button>
        )}
      </form>
    </main>
  );
}
