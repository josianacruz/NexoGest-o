"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import PageHeader from "../_components/PageHeader";
import { cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";

interface Notificacao {
  id: number;
  titulo: string;
  clienteNome: string;
  servicoNome: string;
  dataHoraAgendamento: string;
  agendamentoId: number | null;
  lida: boolean;
  dataCriacao: string;
}

export default function NotificacoesPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  useEffect(() => {
    const token = getToken();
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
      setEmpresaId(empresas[0].id);
      setEmpresaNome(empresas[0].nome);
      setComandasHabilitadas(empresas[0].comandasHabilitadas ?? true);

      const resNotificacoes = await fetch(`${API_URL}/api/empresas/${empresas[0].id}/notificacoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resNotificacoes.ok) setNotificacoes(await resNotificacoes.json());
      setCarregando(false);
    })();
  }, [router]);

  async function abrirNotificacao(n: Notificacao) {
    if (!empresaId) return;
    const token = getToken();
    if (!n.lida) {
      await fetch(`${API_URL}/api/empresas/${empresaId}/notificacoes/${n.id}/marcar-lida`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    const dataDoAgendamento = n.dataHoraAgendamento.slice(0, 10);
    // Navegação completa (não router.push): a Agenda só lê a data da URL na
    // primeira montagem, então uma navegação client-side não pega o novo valor.
    window.location.href = `/agenda?data=${dataDoAgendamento}`;
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Notificações" />

        <div className="flex flex-col gap-2">
          {notificacoes.map((n) => {
            const dt = new Date(n.dataHoraAgendamento);
            return (
              <button
                key={n.id}
                onClick={() => abrirNotificacao(n)}
                className={`${cardStyle} p-4 text-left flex flex-col gap-1 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors ${
                  !n.lida ? "border-indigo-400 dark:border-indigo-500" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{n.titulo}</span>
                  {!n.lida && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                </div>
                <p className="text-sm text-black/70 dark:text-white/70">
                  {n.clienteNome} agendou {n.servicoNome}
                </p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {dt.toLocaleDateString("pt-BR", { timeZone: "UTC" })} às{" "}
                  {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} · Origem: Horário vago
                </p>
              </button>
            );
          })}
          {!carregando && notificacoes.length === 0 && (
            <p className="text-sm text-black/40 dark:text-white/40 text-center py-8">Nenhuma notificação ainda.</p>
          )}
        </div>
      </main>
    </>
  );
}
