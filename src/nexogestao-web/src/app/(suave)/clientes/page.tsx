"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../../lib/api";
import {
  abrirWhatsApp,
  mensagemAgradecerCompra,
  mensagemCobrancaVencida,
  mensagemCobrarFiado,
  mensagemLembreteVencimento,
  mensagemLinkAgendamento,
  mensagemPromocaoPadrao,
} from "../../../lib/whatsapp";
import AgendamentoRapido, { type ClienteResumo } from "../../_suave/AgendamentoRapido";
import { useEmpresa } from "../../_suave/EmpresaContext";
import Folha from "../../_suave/Folha";
import { SUAVE, brl } from "../../_suave/tokens";

interface Cliente {
  id: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
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

const formVazio = { nome: "", telefone: "", email: "" };

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

async function mensagemDeErro(res: Response, padrao: string) {
  const d = await res.json().catch(() => null);
  return d?.mensagem ?? padrao;
}

// Clientes em cartões: o que mais se faz (agendar, chamar no WhatsApp, ver o que deve) fica a um toque.
export default function ClientesPage() {
  const { empresa, api } = useEmpresa();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState<"novo" | Cliente | null>(null);
  const [form, setForm] = useState(formVazio);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [zapDe, setZapDe] = useState<Cliente | null>(null);
  const [promocao, setPromocao] = useState<string | null>(null);
  const [avisoZap, setAvisoZap] = useState<string | null>(null);

  const [contasDe, setContasDe] = useState<Cliente | null>(null);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(false);
  const [erroContas, setErroContas] = useState<string | null>(null);

  const [agendarPara, setAgendarPara] = useState<ClienteResumo | null>(null);
  const [agendarAberto, setAgendarAberto] = useState(false);

  const temAgenda = !!empresa?.modulos.includes("Agenda");

  const carregar = useCallback(async () => {
    const res = await api("/clientes");
    if (moduloIndisponivel(res)) {
      setErroGeral(MODULO_INDISPONIVEL_MSG);
    } else if (res.ok) {
      setClientes(await res.json());
      setErroGeral(null);
    } else {
      setErroGeral("Não consegui carregar os clientes. Tente de novo.");
    }
    setCarregando(false);
  }, [api]);

  useEffect(() => {
    if (empresa) carregar();
  }, [empresa?.id]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(t) || (c.telefone ?? "").toLowerCase().includes(t) || (c.email ?? "").toLowerCase().includes(t));
  }, [clientes, busca]);

  function abrirForm(c: "novo" | Cliente) {
    setErroForm(null);
    setForm(c === "novo" ? formVazio : { nome: c.nome, telefone: c.telefone ?? "", email: c.email ?? "" });
    setFormAberto(c);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !formAberto) return;
    setSalvando(true);
    setErroForm(null);
    try {
      const editando = formAberto !== "novo";
      const res = await api(editando ? `/clientes/${(formAberto as Cliente).id}` : "/clientes", { method: editando ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) {
        setErroForm(await mensagemDeErro(res, "Não foi possível salvar o cliente."));
        return;
      }
      const criado = editando ? null : await res.json().catch(() => null);
      setFormAberto(null);
      await carregar();
      // Cliente novo e a loja usa agenda: já oferece marcar o primeiro horário.
      if (criado?.id && temAgenda) {
        setAgendarPara({ id: criado.id, nome: criado.nome ?? form.nome, telefone: form.telefone || null });
        setAgendarAberto(true);
      }
    } finally {
      setSalvando(false);
    }
  }

  async function abrirContas(c: Cliente) {
    setContasDe(c);
    setErroContas(null);
    setCarregandoContas(true);
    try {
      const res = await api(`/clientes/${c.id}/contas-receber`);
      setContas(res.ok ? await res.json() : []);
      if (!res.ok) setErroContas("Não consegui carregar as contas.");
    } finally {
      setCarregandoContas(false);
    }
  }

  async function registrarPagamento(contaId: number) {
    if (salvando || !contasDe) return;
    setSalvando(true);
    setErroContas(null);
    try {
      const res = await api(`/contas-receber/${contaId}/pagamento`, { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) {
        setErroContas(await mensagemDeErro(res, "Não foi possível registrar o pagamento."));
        return;
      }
      await Promise.all([abrirContasSemAbrir(contasDe.id), carregar()]);
    } finally {
      setSalvando(false);
    }
  }

  async function abrirContasSemAbrir(clienteId: number) {
    const res = await api(`/clientes/${clienteId}/contas-receber`);
    if (res.ok) setContas(await res.json());
  }

  function lembrar(c: Cliente, conta: ContaReceber) {
    const msg = conta.status === "VENCIDO" ? mensagemCobrancaVencida(c.nome, conta.valorPendente, conta.dataVencimento) : mensagemLembreteVencimento(c.nome, conta.valorPendente, conta.dataVencimento);
    if (!abrirWhatsApp(c.telefone, msg)) setErroContas("Este cliente não tem telefone cadastrado.");
  }

  function enviarZap(c: Cliente, mensagem?: string) {
    if (!abrirWhatsApp(c.telefone, mensagem)) {
      setAvisoZap("Este cliente não tem telefone cadastrado. Toque em Editar para colocar o número.");
      return;
    }
    setZapDe(null);
    setPromocao(null);
    setAvisoZap(null);
  }

  // Cliente atual do cartão aberto sempre com os números mais recentes (após registrar pagamento).
  const contasCliente = contasDe ? (clientes.find((c) => c.id === contasDe.id) ?? contasDe) : null;
  const totalReceber = contas.filter((c) => c.status !== "PAGO").reduce((s, c) => s + c.valorPendente, 0);
  const totalVencido = contas.filter((c) => c.status === "VENCIDO").reduce((s, c) => s + c.valorPendente, 0);

  if (!empresa) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className={`text-sm ${SUAVE.textoSuave}`}>{carregando ? "Carregando…" : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}</p>
        </div>
        <button type="button" onClick={() => abrirForm("novo")} className={SUAVE.botaoPrimario}>
          + Novo cliente
        </button>
      </div>

      {clientes.length > 0 && <input className={SUAVE.campo} placeholder="Buscar por nome, telefone ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />}

      {erroGeral && (
        <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
          {erroGeral}
        </p>
      )}

      {!carregando && !erroGeral && filtrados.length === 0 && (
        <p className={`${SUAVE.cartao} p-5 text-sm ${SUAVE.textoSuave}`}>{clientes.length === 0 ? "Nenhum cliente ainda. Toque em “+ Novo cliente” para cadastrar o primeiro." : "Ninguém com esse nome, telefone ou e-mail."}</p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((c) => {
          const temConta = c.totalVencido > 0 || c.totalPendente > 0;
          return (
            <li key={c.id} className={`${SUAVE.cartaoClicavel} flex min-w-0 flex-col gap-3 p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nome}</p>
                  <p className={`truncate text-sm ${SUAVE.textoFraco}`}>{c.telefone || "Sem telefone"}</p>
                  {c.email && <p className={`truncate text-xs ${SUAVE.textoFraco}`}>{c.email}</p>}
                </div>
                <button type="button" onClick={() => abrirForm(c)} className={`${SUAVE.botaoPequeno} shrink-0 ${SUAVE.seloNeutro}`} aria-label={`Editar ${c.nome}`}>
                  Editar
                </button>
              </div>

              {temConta ? (
                <button type="button" onClick={() => abrirContas(c)} className={`${SUAVE.selo} w-fit cursor-pointer text-left ${c.totalVencido > 0 ? SUAVE.seloErro : SUAVE.seloAviso}`}>
                  {c.totalVencido > 0 ? `Vencido ${brl(c.totalVencido)}` : `A receber ${brl(c.totalPendente)}`}
                  {c.proximoVencimento ? ` · ${c.totalVencido > 0 ? "venceu" : "vence"} ${dataBr(c.proximoVencimento)}` : ""} ›
                </button>
              ) : (
                <span className={`${SUAVE.selo} w-fit ${SUAVE.seloOk}`}>Em dia</span>
              )}

              <div className="mt-auto flex gap-2">
                {temAgenda && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgendarPara({ id: c.id, nome: c.nome, telefone: c.telefone ?? null });
                      setAgendarAberto(true);
                    }}
                    className={`${SUAVE.botaoPrimario} flex-1 !py-2.5`}
                  >
                    Agendar
                  </button>
                )}
                <button type="button" onClick={() => { setAvisoZap(null); setPromocao(null); setZapDe(c); }} className={`${SUAVE.botaoSucesso} flex-1 !py-2.5`}>
                  WhatsApp
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Novo / editar */}
      {formAberto && (
        <Folha titulo={formAberto === "novo" ? "Novo cliente" : `Editar ${formAberto.nome}`} aoFechar={() => setFormAberto(null)}>
          <form onSubmit={salvar} className="grid gap-3">
            <div>
              <label htmlFor="cli-nome" className={SUAVE.rotulo}>
                Nome
              </label>
              <input id="cli-nome" className={SUAVE.campo} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            </div>
            <div>
              <label htmlFor="cli-tel" className={SUAVE.rotulo}>
                Celular (opcional)
              </label>
              <input id="cli-tel" className={SUAVE.campo} inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="11 98765-4321" />
            </div>
            <div>
              <label htmlFor="cli-email" className={SUAVE.rotulo}>
                E-mail (opcional)
              </label>
              <input id="cli-email" type="email" className={SUAVE.campo} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {erroForm && (
              <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                {erroForm}
              </p>
            )}
            <button type="submit" disabled={salvando || form.nome.trim().length < 2} className={SUAVE.botaoPrimario}>
              {salvando ? "Salvando…" : formAberto === "novo" && temAgenda ? "Salvar e agendar" : "Salvar cliente"}
            </button>
          </form>
        </Folha>
      )}

      {/* WhatsApp */}
      {zapDe && (
        <Folha titulo={`WhatsApp · ${zapDe.nome}`} subtitulo={zapDe.telefone ?? "Sem telefone cadastrado"} aoFechar={() => { setZapDe(null); setPromocao(null); }}>
          {promocao === null ? (
            <div className="grid gap-2">
              <button type="button" onClick={() => enviarZap(zapDe)} className={`${SUAVE.botaoSecundario} !justify-start`}>
                💬 Conversar
              </button>
              <button type="button" disabled={!zapDe.saldoDevedor || zapDe.saldoDevedor <= 0} onClick={() => enviarZap(zapDe, mensagemCobrarFiado(zapDe.nome, zapDe.saldoDevedor ?? 0))} className={`${SUAVE.botaoSecundario} !justify-start`}>
                💰 Cobrar o que deve
              </button>
              <button type="button" onClick={() => enviarZap(zapDe, mensagemAgradecerCompra(zapDe.nome))} className={`${SUAVE.botaoSecundario} !justify-start`}>
                🙏 Agradecer a compra
              </button>
              <button type="button" onClick={() => setPromocao(mensagemPromocaoPadrao(zapDe.nome))} className={`${SUAVE.botaoSecundario} !justify-start`}>
                🎁 Enviar promoção
              </button>
              {temAgenda && (
                <button type="button" onClick={() => enviarZap(zapDe, mensagemLinkAgendamento(zapDe.nome, `${window.location.origin}/agendar/${empresa.id}`))} className={`${SUAVE.botaoSecundario} !justify-start`}>
                  📅 Enviar link para agendar
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              <label htmlFor="msg-promo" className={SUAVE.rotulo}>
                Mensagem
              </label>
              <textarea id="msg-promo" className={SUAVE.campo} rows={5} value={promocao} onChange={(e) => setPromocao(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={() => setPromocao(null)} className={`${SUAVE.botaoSecundario} flex-1`}>
                  Voltar
                </button>
                <button type="button" disabled={!promocao.trim()} onClick={() => enviarZap(zapDe, promocao.trim())} className={`${SUAVE.botaoSucesso} flex-1`}>
                  Abrir WhatsApp
                </button>
              </div>
            </div>
          )}
          {avisoZap && (
            <p role="alert" className={`mt-3 rounded-2xl p-3 text-sm ${SUAVE.seloAviso}`}>
              {avisoZap}
            </p>
          )}
        </Folha>
      )}

      {/* Contas a receber */}
      {contasCliente && (
        <Folha titulo={`Contas de ${contasCliente.nome}`} subtitulo={contasCliente.telefone ?? undefined} aoFechar={() => { setContasDe(null); setContas([]); }}>
          <div className="grid gap-3">
            {contas.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-700">
                  <p className={`text-xs ${SUAVE.textoSuave}`}>A receber</p>
                  <p className="text-lg font-bold">{brl(totalReceber)}</p>
                </div>
                <div className={`rounded-2xl p-3 ${SUAVE.seloErro}`}>
                  <p className="text-xs">Vencido</p>
                  <p className="text-lg font-bold">{brl(totalVencido)}</p>
                </div>
              </div>
            )}
            {erroContas && (
              <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                {erroContas}
              </p>
            )}
            {carregandoContas ? (
              <p className={`py-4 text-center text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
            ) : contas.length === 0 ? (
              <p className={`py-4 text-center text-sm ${SUAVE.textoFraco}`}>Nenhuma conta no fiado.</p>
            ) : (
              contas.map((conta) => (
                <div key={conta.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${SUAVE.textoSuave}`}>Venda #{conta.vendaId}</span>
                    <span className={`${SUAVE.selo} ${conta.status === "PAGO" ? SUAVE.seloOk : conta.status === "VENCIDO" ? SUAVE.seloErro : SUAVE.seloAviso}`}>{conta.status === "PAGO" ? "Pago" : conta.status === "VENCIDO" ? "Vencido" : "Pendente"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{brl(conta.status === "PAGO" ? conta.valorOriginal : conta.valorPendente)}</span>
                    <span className={`text-sm ${SUAVE.textoSuave}`}>{conta.status === "PAGO" ? `Pago em ${conta.dataPagamento ? dataBr(conta.dataPagamento) : "—"}` : `Vence ${dataBr(conta.dataVencimento)}`}</span>
                  </div>
                  {conta.status !== "PAGO" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => lembrar(contasCliente, conta)} className={`${SUAVE.botaoSucesso} flex-1 !py-2`}>
                        Lembrar no WhatsApp
                      </button>
                      <button type="button" disabled={salvando} onClick={() => registrarPagamento(conta.id)} className={`${SUAVE.botaoPrimario} flex-1 !py-2`}>
                        Já pagou
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Folha>
      )}

      <AgendamentoRapido aberto={agendarAberto} aoFechar={() => setAgendarAberto(false)} aoCriar={() => {}} clienteInicial={agendarPara} horarioInicial={null} />
    </div>
  );
}
