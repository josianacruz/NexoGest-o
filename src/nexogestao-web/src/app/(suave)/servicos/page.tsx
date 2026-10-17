"use client";

import { useCallback, useEffect, useState } from "react";
import { MODULO_INDISPONIVEL_MSG, moduloIndisponivel, textoDoErro } from "../../../lib/api";
import { apagarRascunho, lerRascunho, useRascunho } from "../../../lib/rascunho";
import { useEmpresa } from "../../_suave/EmpresaContext";
import Folha from "../../_suave/Folha";
import { SUAVE, brl } from "../../_suave/tokens";

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
  permiteAutoagendamento: boolean;
}

interface Form {
  nome: string;
  duracao: string;
  preco: string;
  online: boolean;
}

const formVazio: Form = { nome: "", duracao: "30", preco: "", online: true };
const DURACOES = [15, 30, 45, 60, 90, 120];
const CHAVE_NOVO = "servico-novo";

async function mensagemDeErro(res: Response, padrao: string) {
  const d = await res.json().catch(() => null);
  return d?.mensagem ?? padrao;
}

const numero = (t: string) => Number(t.replace(",", "."));

// Cadastro de serviços: cartões (nada de tabela larga no celular), formulário em janela que sobe de baixo,
// rascunho automático e mensagens claras quando a internet falha.
export default function ServicosPage() {
  const { empresa, api } = useEmpresa();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const [aberto, setAberto] = useState<"novo" | Servico | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [recuperado, setRecuperado] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<Servico | null>(null);

  const chaveRascunho = aberto === "novo" ? CHAVE_NOVO : aberto ? `servico-${aberto.id}` : CHAVE_NOVO;
  useRascunho(chaveRascunho, form, aberto !== null, (f) => aberto === "novo" ? !f.nome.trim() && !f.preco.trim() : false);

  const carregar = useCallback(async () => {
    try {
      const res = await api("/servicos");
      if (moduloIndisponivel(res)) setErroGeral(MODULO_INDISPONIVEL_MSG);
      else if (res.ok) {
        setServicos(await res.json());
        setErroGeral(null);
      } else setErroGeral("Não consegui carregar os serviços. Tente de novo.");
    } catch (e) {
      setErroGeral(textoDoErro(e, "Não consegui carregar os serviços."));
    } finally {
      setCarregando(false);
    }
  }, [api]);

  useEffect(() => {
    if (empresa) carregar();
  }, [empresa?.id]);

  function abrirNovo() {
    setErroForm(null);
    const r = lerRascunho<Form>(CHAVE_NOVO);
    setForm(r ?? formVazio);
    setRecuperado(!!r);
    setAberto("novo");
  }

  function abrirEdicao(s: Servico) {
    setErroForm(null);
    const r = lerRascunho<Form>(`servico-${s.id}`);
    setForm(r ?? { nome: s.nome, duracao: String(s.duracaoMinutos), preco: String(s.preco).replace(".", ","), online: s.permiteAutoagendamento });
    setRecuperado(!!r);
    setAberto(s);
  }

  function descartarRascunho() {
    apagarRascunho(chaveRascunho);
    setRecuperado(false);
    if (aberto === "novo") setForm(formVazio);
    else if (aberto) setForm({ nome: aberto.nome, duracao: String(aberto.duracaoMinutos), preco: String(aberto.preco).replace(".", ","), online: aberto.permiteAutoagendamento });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !aberto) return;
    const duracao = Math.round(numero(form.duracao));
    const preco = numero(form.preco);
    if (form.nome.trim().length < 2) return setErroForm("Escreva o nome do serviço.");
    if (!Number.isFinite(duracao) || duracao < 5 || duracao > 600) return setErroForm("A duração precisa ser entre 5 e 600 minutos.");
    if (!Number.isFinite(preco) || preco < 0) return setErroForm("Confira o preço.");

    setSalvando(true);
    setErroForm(null);
    try {
      const editando = aberto !== "novo";
      const res = await api(editando ? `/servicos/${(aberto as Servico).id}` : "/servicos", {
        method: editando ? "PUT" : "POST",
        body: JSON.stringify({ nome: form.nome.trim(), duracaoMinutos: duracao, preco, permiteAutoagendamento: form.online }),
      });
      if (!res.ok) {
        setErroForm(await mensagemDeErro(res, "Não foi possível salvar o serviço."));
        return;
      }
      apagarRascunho(chaveRascunho); // salvou: o rascunho não é mais necessário
      setAberto(null);
      await carregar();
    } catch (err) {
      setErroForm(textoDoErro(err, "Não foi possível salvar o serviço. Tente de novo."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!removendo || salvando) return;
    setSalvando(true);
    try {
      const res = await api(`/servicos/${removendo.id}`, { method: "DELETE" });
      if (!res.ok) {
        setErroGeral(await mensagemDeErro(res, "Não foi possível remover o serviço."));
      } else {
        setRemovendo(null);
        await carregar();
      }
    } catch (err) {
      setErroGeral(textoDoErro(err, "Não foi possível remover o serviço."));
    } finally {
      setSalvando(false);
    }
  }

  if (!empresa) return null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Serviços</h1>
          <p className={`text-sm ${SUAVE.textoSuave}`}>{carregando ? "Carregando…" : `${servicos.length} ${servicos.length === 1 ? "serviço" : "serviços"}`}</p>
        </div>
        <button type="button" onClick={abrirNovo} className={SUAVE.botaoPrimario}>
          + Novo serviço
        </button>
      </div>

      {erroGeral && (
        <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
          {erroGeral}
        </p>
      )}

      {!carregando && !erroGeral && servicos.length === 0 && <p className={`${SUAVE.cartao} p-5 text-sm ${SUAVE.textoSuave}`}>Nenhum serviço ainda. Toque em “+ Novo serviço” para cadastrar o primeiro.</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {servicos.map((s) => (
          <li key={s.id} className={`${SUAVE.cartaoClicavel} flex min-w-0 flex-col gap-3 p-4`}>
            <div className="min-w-0">
              <p className="break-words font-semibold">{s.nome}</p>
              <p className={`text-sm ${SUAVE.textoSuave}`}>
                {s.duracaoMinutos} min · {brl(s.preco)}
              </p>
            </div>
            <span className={`${SUAVE.selo} w-fit ${s.permiteAutoagendamento ? SUAVE.seloInfo : SUAVE.seloNeutro}`}>{s.permiteAutoagendamento ? "Agenda online" : "Só no painel"}</span>
            <div className="mt-auto flex gap-2">
              <button type="button" onClick={() => abrirEdicao(s)} className={`${SUAVE.botaoSecundario} flex-1 !py-2.5`}>
                Editar
              </button>
              <button type="button" onClick={() => setRemovendo(s)} className={`${SUAVE.botaoSecundario} !py-2.5`} aria-label={`Remover ${s.nome}`}>
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>

      {aberto && (
        <Folha titulo={aberto === "novo" ? "Novo serviço" : `Editar ${aberto.nome}`} aoFechar={() => setAberto(null)}>
          <form onSubmit={salvar} className="grid gap-4">
            {recuperado && (
              <div className={`flex flex-wrap items-center gap-2 rounded-2xl p-3 text-sm ${SUAVE.seloInfo}`}>
                <span className="flex-1">Recuperamos o que você tinha digitado.</span>
                <button type="button" onClick={descartarRascunho} className="font-bold underline">
                  Começar do zero
                </button>
              </div>
            )}
            <div>
              <label htmlFor="srv-nome" className={SUAVE.rotulo}>
                Nome do serviço
              </label>
              <input id="srv-nome" className={SUAVE.campo} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={80} placeholder="Ex.: Escova + hidratação" autoFocus autoComplete="off" />
            </div>

            <fieldset>
              <legend className={SUAVE.rotulo}>Duração</legend>
              <div className="flex flex-wrap gap-2">
                {DURACOES.map((d) => (
                  <button key={d} type="button" aria-pressed={form.duracao === String(d)} onClick={() => setForm({ ...form, duracao: String(d) })} className={form.duracao === String(d) ? SUAVE.chipAtivo : SUAVE.chip}>
                    {d} min
                  </button>
                ))}
              </div>
              <input aria-label="Duração em minutos" className={`${SUAVE.campo} mt-2 !w-36`} inputMode="numeric" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="Outro valor" />
            </fieldset>

            <div>
              <label htmlFor="srv-preco" className={SUAVE.rotulo}>
                Preço (R$)
              </label>
              <input id="srv-preco" className={SUAVE.campo} inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="80,00" autoComplete="off" />
            </div>

            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
              <input type="checkbox" className="h-6 w-6 shrink-0 accent-violet-500" checked={form.online} onChange={(e) => setForm({ ...form, online: e.target.checked })} />
              <span>
                <span className="block font-semibold">As clientes podem agendar pelo link</span>
                <span className={`block text-xs ${SUAVE.textoSuave}`}>Desmarque para serviços que você só marca pelo painel.</span>
              </span>
            </label>

            {erroForm && (
              <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                {erroForm}
              </p>
            )}
            <button type="submit" disabled={salvando} className={SUAVE.botaoPrimario}>
              {salvando ? "Salvando…" : "Salvar serviço"}
            </button>
          </form>
        </Folha>
      )}

      {removendo && (
        <Folha titulo="Remover serviço?" aoFechar={() => setRemovendo(null)}>
          <div className="grid gap-4">
            <p className={`text-sm ${SUAVE.textoSuave}`}>
              “{removendo.nome}” deixa de aparecer na agenda e no link das clientes. Os agendamentos que já existem continuam no histórico.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRemovendo(null)} className={`${SUAVE.botaoSecundario} flex-1`}>
                Cancelar
              </button>
              <button type="button" onClick={remover} disabled={salvando} className={`${SUAVE.botaoPrimario} flex-1`}>
                {salvando ? "Removendo…" : "Remover"}
              </button>
            </div>
          </div>
        </Folha>
      )}
    </main>
  );
}
