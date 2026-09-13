"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Modal from "../_components/Modal";
import PageHeader from "../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
  permiteAutoagendamento: boolean;
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

const formVazio = { nome: "", duracaoMinutos: "30", preco: "", permiteAutoagendamento: false };

export default function ServicosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<"novo" | "editar" | null>(null);
  const [servicoEditando, setServicoEditando] = useState<Servico | null>(null);
  const [form, setForm] = useState(formVazio);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarTudo() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) {
        setErro("Você ainda não tem nenhuma empresa cadastrada.");
        return;
      }
      const empresa = empresas[0];
      setEmpresaId(empresa.id);
      setEmpresaNome(empresa.nome);
      setComandasHabilitadas(empresa.comandasHabilitadas ?? true);

      const resServicos = await fetch(`${API_URL}/api/empresas/${empresa.id}/servicos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (moduloIndisponivel(resServicos)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }
      setServicos(await resServicos.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNovo() {
    setErro(null);
    setForm(formVazio);
    setModalAberto("novo");
  }

  function abrirEdicao(s: Servico) {
    setErro(null);
    setServicoEditando(s);
    setForm({
      nome: s.nome,
      duracaoMinutos: String(s.duracaoMinutos),
      preco: String(s.preco),
      permiteAutoagendamento: s.permiteAutoagendamento,
    });
    setModalAberto("editar");
  }

  function fecharModal() {
    setModalAberto(null);
    setServicoEditando(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !empresaId) return;
    const token = getToken();
    if (!token) return;

    const editando = modalAberto === "editar" && servicoEditando;
    const url = editando
      ? `${API_URL}/api/empresas/${empresaId}/servicos/${servicoEditando!.id}`
      : `${API_URL}/api/empresas/${empresaId}/servicos`;

    setSalvando(true);
    try {
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: form.nome,
          duracaoMinutos: Number(form.duracaoMinutos),
          preco: Number(form.preco),
          permiteAutoagendamento: form.permiteAutoagendamento,
        }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar o serviço."));
        return;
      }

      fecharModal();
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(servico: Servico) {
    if (salvando || !empresaId) return;
    if (!window.confirm(`Remover o serviço "${servico.nome}"?`)) return;
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/servicos/${servico.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível remover o serviço."));
        return;
      }
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader
          titulo="Serviços"
          acao={
            <button onClick={abrirNovo} className={botaoPrimario}>
              + Novo serviço
            </button>
          }
        />

        {erro && !modalAberto && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <div className={`${cardStyle} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2.5 px-4 font-medium">Nome</th>
                <th className="py-2.5 px-4 font-medium">Duração</th>
                <th className="py-2.5 px-4 font-medium">Preço</th>
                <th className="py-2.5 px-4 font-medium">Autoagendamento</th>
                <th className="py-2.5 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 px-4">{s.nome}</td>
                  <td className="py-2.5 px-4">{s.duracaoMinutos} min</td>
                  <td className="py-2.5 px-4">R$ {s.preco.toFixed(2)}</td>
                  <td className="py-2.5 px-4">{s.permiteAutoagendamento ? "Sim" : "Não"}</td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => abrirEdicao(s)} className={botaoTexto}>
                        Editar
                      </button>
                      <button onClick={() => remover(s)} className="text-red-600 hover:underline text-sm font-medium">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {servicos.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando ? "Carregando..." : "Nenhum serviço cadastrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {modalAberto && (
        <Modal
          titulo={modalAberto === "novo" ? "Novo serviço" : `Editar ${servicoEditando?.nome}`}
          onFechar={fecharModal}
        >
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                autoFocus
                className={inputStyle}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Duração (minutos)</label>
                <input
                  type="number"
                  min="1"
                  value={form.duracaoMinutos}
                  onChange={(e) => setForm({ ...form, duracaoMinutos: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className={labelStyle}>Preço</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  required
                  className={inputStyle}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.permiteAutoagendamento}
                onChange={(e) => setForm({ ...form, permiteAutoagendamento: e.target.checked })}
              />
              Permitir autoagendamento
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <button type="button" onClick={fecharModal} className="h-10 px-3 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className={botaoPrimario}>
                {salvando ? "Salvando..." : "Salvar serviço"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
