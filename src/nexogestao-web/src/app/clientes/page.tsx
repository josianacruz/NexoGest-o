"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import WhatsAppMenu from "../_components/WhatsAppMenu";
import Modal from "../_components/Modal";
import Drawer from "../_components/Drawer";
import PageHeader from "../_components/PageHeader";
import SearchInput from "../_components/SearchInput";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";
import { abrirWhatsApp, mensagemLembreteVencimento, mensagemCobrancaVencida } from "../../lib/whatsapp";

interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  saldoDevedor?: number | null;
  totalPendente: number;
  totalVencido: number;
  proximoVencimento?: string | null;
}

interface ContaReceber {
  id: number;
  vendaId: number;
  valorOriginal: number;
  valorPendente: number;
  dataVencimento: string;
  dataPagamento?: string | null;
  status: "PENDENTE" | "VENCIDO" | "PAGO";
}

function formatarDataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

const formVazio = { nome: "", telefone: "", email: "" };

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<"novo" | "editar" | null>(null);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(formVazio);
  const [clienteContasId, setClienteContasId] = useState<number | null>(null);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(false);
  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregarEmpresaEClientes() {
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
      const primeiraEmpresa = empresas[0];
      setEmpresaId(primeiraEmpresa.id);
      setEmpresaNome(primeiraEmpresa.nome);
      setComandasHabilitadas(primeiraEmpresa.comandasHabilitadas ?? true);

      const resClientes = await fetch(
        `${API_URL}/api/empresas/${primeiraEmpresa.id}/clientes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listaClientes = await resClientes.json();
      setClientes(listaClientes);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEmpresaEClientes();
  }, []);

  function abrirNovo() {
    setErro(null);
    setForm(formVazio);
    setModalAberto("novo");
  }

  function abrirEdicao(c: Cliente) {
    setErro(null);
    setClienteEditando(c);
    setForm({ nome: c.nome, telefone: c.telefone ?? "", email: c.email ?? "" });
    setModalAberto("editar");
  }

  async function abrirContas(clienteId: number) {
    setErro(null);
    setClienteContasId(clienteId);
    setCarregandoContas(true);
    const token = getToken();
    if (!token || !empresaId) return;
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/clientes/${clienteId}/contas-receber`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContas(await res.json());
    } finally {
      setCarregandoContas(false);
    }
  }

  function fecharContas() {
    setClienteContasId(null);
    setContas([]);
  }

  async function registrarPagamentoConta(contaId: number) {
    if (salvando || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/contas-receber/${contaId}/pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível registrar o pagamento."));
        return;
      }

      if (clienteContasId) await abrirContas(clienteContasId);
      await carregarEmpresaEClientes();
    } finally {
      setSalvando(false);
    }
  }

  function enviarLembrete(cliente: Cliente, conta: ContaReceber) {
    const mensagem =
      conta.status === "VENCIDO"
        ? mensagemCobrancaVencida(cliente.nome, conta.valorPendente, conta.dataVencimento)
        : mensagemLembreteVencimento(cliente.nome, conta.valorPendente, conta.dataVencimento);
    const abriu = abrirWhatsApp(cliente.telefone, mensagem);
    if (!abriu) setErro("Este cliente não possui telefone cadastrado.");
  }

  function fecharModal() {
    setModalAberto(null);
    setClienteEditando(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !empresaId) return;
    const token = getToken();
    if (!token) return;

    const editando = modalAberto === "editar" && clienteEditando;
    const url = editando
      ? `${API_URL}/api/empresas/${empresaId}/clientes/${clienteEditando!.id}`
      : `${API_URL}/api/empresas/${empresaId}/clientes`;

    setSalvando(true);
    try {
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar o cliente."));
        return;
      }

      fecharModal();
      await carregarEmpresaEClientes();
    } finally {
      setSalvando(false);
    }
  }

  const clienteContas = clientes.find((c) => c.id === clienteContasId) ?? null;
  const totalAReceberContas = contas
    .filter((c) => c.status !== "PAGO")
    .reduce((soma, c) => soma + c.valorPendente, 0);
  const totalVencidoContas = contas
    .filter((c) => c.status === "VENCIDO")
    .reduce((soma, c) => soma + c.valorPendente, 0);

  const clientesFiltrados = clientes.filter((c) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (
      c.nome.toLowerCase().includes(termo) ||
      (c.telefone ?? "").toLowerCase().includes(termo) ||
      (c.email ?? "").toLowerCase().includes(termo)
    );
  });

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader
          titulo="Clientes"
          acao={
            <button onClick={abrirNovo} className={botaoPrimario}>
              + Novo cliente
            </button>
          }
        />

        {clientes.length > 0 && (
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por nome, telefone ou email..."
            className="mb-4 max-w-xs"
          />
        )}

        {erro && !modalAberto && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <div className={`${cardStyle} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2.5 px-4 font-medium">Nome</th>
                <th className="py-2.5 px-4 font-medium">Telefone</th>
                <th className="py-2.5 px-4 font-medium">Email</th>
                <th className="py-2.5 px-4 font-medium">Situação financeira</th>
                <th className="py-2.5 px-4 font-medium text-center">WhatsApp</th>
                <th className="py-2.5 px-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => (
                <tr key={c.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 px-4">{c.nome}</td>
                  <td className="py-2.5 px-4">{c.telefone}</td>
                  <td className="py-2.5 px-4">{c.email}</td>
                  <td className="py-2.5 px-4">
                    {c.totalVencido > 0 ? (
                      <button onClick={() => abrirContas(c.id)} className="text-left hover:underline">
                        <span className="font-medium text-red-600 dark:text-red-400">
                          🔴 R$ {c.totalVencido.toFixed(2)} vencido
                        </span>
                        {c.proximoVencimento && (
                          <div className="text-xs text-black/50 dark:text-white/50">
                            Venceu {formatarDataBr(c.proximoVencimento)}
                          </div>
                        )}
                      </button>
                    ) : c.totalPendente > 0 ? (
                      <button onClick={() => abrirContas(c.id)} className="text-left hover:underline">
                        <span className="font-medium text-amber-600 dark:text-amber-500">
                          🟡 R$ {c.totalPendente.toFixed(2)} a receber
                        </span>
                        {c.proximoVencimento && (
                          <div className="text-xs text-black/50 dark:text-white/50">
                            Vence {formatarDataBr(c.proximoVencimento)}
                          </div>
                        )}
                      </button>
                    ) : (
                      <span className="text-green-600 dark:text-green-500 font-medium">🟢 Em dia</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <WhatsAppMenu
                      nome={c.nome}
                      telefone={c.telefone}
                      saldoDevedor={c.saldoDevedor}
                      onErro={setErro}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button onClick={() => abrirEdicao(c)} className={botaoTexto}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {clientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-black/40 dark:text-white/40">
                    {carregando
                      ? "Carregando..."
                      : clientes.length === 0
                      ? "Nenhum cliente cadastrado."
                      : "Nenhum cliente encontrado pra essa busca."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {modalAberto && (
        <Modal
          titulo={modalAberto === "novo" ? "Novo cliente" : `Editar ${clienteEditando?.nome}`}
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
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputStyle}
              />
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <button type="button" onClick={fecharModal} className="h-10 px-3 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className={botaoPrimario}>
                {salvando ? "Salvando..." : "Salvar cliente"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {clienteContas && (
        <Drawer
          titulo={`Contas de ${clienteContas.nome}`}
          subtitulo={clienteContas.telefone ?? undefined}
          onFechar={fecharContas}
        >
          <div className="flex flex-col gap-4">
            {contas.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`${cardStyle} p-3`}>
                  <div className={labelStyle}>Total a receber</div>
                  <div className="text-lg font-semibold">R$ {totalAReceberContas.toFixed(2)}</div>
                </div>
                <div className={`${cardStyle} p-3`}>
                  <div className={labelStyle}>Total vencido</div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    R$ {totalVencidoContas.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex flex-col gap-2">
              {carregandoContas ? (
                <p className="text-sm text-black/40 dark:text-white/40 text-center py-4">Carregando...</p>
              ) : contas.length === 0 ? (
                <p className="text-sm text-black/40 dark:text-white/40 text-center py-4">
                  Nenhuma conta fiado registrada.
                </p>
              ) : (
                contas.map((conta) => (
                  <div key={conta.id} className={`${cardStyle} p-3 flex flex-col gap-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-black/50 dark:text-white/50">Venda #{conta.vendaId}</span>
                      {conta.status === "PAGO" && (
                        <span className="text-xs font-medium text-green-600 dark:text-green-500">🟢 Pago</span>
                      )}
                      {conta.status === "PENDENTE" && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-500">🟡 Pendente</span>
                      )}
                      {conta.status === "VENCIDO" && (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">🔴 Vencido</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">R$ {conta.valorPendente.toFixed(2)}</span>
                      <span className="text-sm text-black/60 dark:text-white/60">
                        {conta.status === "PAGO"
                          ? `Pago em ${conta.dataPagamento ? formatarDataBr(conta.dataPagamento) : "—"}`
                          : `Vence ${formatarDataBr(conta.dataVencimento)}`}
                      </span>
                    </div>
                    {conta.status !== "PAGO" && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => enviarLembrete(clienteContas, conta)}
                          className={botaoTexto}
                        >
                          Enviar lembrete
                        </button>
                        <button
                          onClick={() => registrarPagamentoConta(conta.id)}
                          disabled={salvando}
                          className={botaoSecundario}
                        >
                          Registrar pagamento
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
