"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Modal from "../_components/Modal";
import PageHeader from "../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";
import { abrirWhatsApp, mensagemInteresseProduto } from "../../lib/whatsapp";

type StatusInteresse = "Novo" | "Reservado" | "Convertido" | "Perdido";

interface Interesse {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  produtoId: number;
  produtoNome: string;
  produtoPreco: number;
  produtoFotoUrl?: string | null;
  status: StatusInteresse;
  vendaId?: number | null;
  dataCriacao: string;
}

const STATUS_ESTILO: Record<StatusInteresse, string> = {
  Novo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  Reservado: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Convertido: "bg-green-500/10 text-green-600 dark:text-green-400",
  Perdido: "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 line-through",
};

// Rótulos em linguagem simples pra quem não usa termos de sistema no dia a dia.
const STATUS_LABEL: Record<StatusInteresse, string> = {
  Novo: "Novo",
  Reservado: "Reservado",
  Convertido: "Vendido",
  Perdido: "Não avançou",
};

const FILTROS: { chave: string; label: string }[] = [
  { chave: "", label: "Todos" },
  { chave: "Novo", label: "Novos" },
  { chave: "Reservado", label: "Reservados" },
  { chave: "Convertido", label: "Vendidos" },
  { chave: "Perdido", label: "Não avançaram" },
];

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function InteressesPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [filtro, setFiltro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [convertendo, setConvertendo] = useState<Interesse | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [valorRecebido, setValorRecebido] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [dataVencimento, setDataVencimento] = useState("");
  const [resultadoConversao, setResultadoConversao] = useState<{
    interesseId: number;
    vendaId: number;
    total: number;
    saldoDevedor: number | null;
    contaReceberId: number | null;
  } | null>(null);

  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  async function carregar(status = filtro) {
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
      setEmpresaId(empresas[0].id);
      setEmpresaNome(empresas[0].nome);
      setComandasHabilitadas(empresas[0].comandasHabilitadas ?? true);

      const url = `${API_URL}/api/empresas/${empresas[0].id}/interesses${status ? `?status=${status}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (moduloIndisponivel(res)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }
      setInteresses(await res.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  function chamarNoWhatsApp(i: Interesse) {
    const abriu = abrirWhatsApp(i.clienteTelefone, mensagemInteresseProduto(i.clienteNome, i.produtoNome, i.produtoPreco));
    if (!abriu) setErro("Esse cliente não tem telefone cadastrado.");
  }

  async function reservar(i: Interesse) {
    if (!empresaId || salvando) return;
    const token = getToken();
    if (!token) return;
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/interesses/${i.id}/reservar`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível reservar."));
        return;
      }
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPerdido(i: Interesse) {
    if (!empresaId || salvando) return;
    const token = getToken();
    if (!token) return;
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/interesses/${i.id}/perdido`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível marcar como perdido."));
        return;
      }
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  function abrirConversao(i: Interesse) {
    setErro(null);
    setConvertendo(i);
    setFormaPagamento("PIX");
    setValorRecebido("");
    setParcelas("1");
    setDataVencimento("");
  }

  async function confirmarConversao(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !convertendo || salvando) return;
    const token = getToken();
    if (!token) return;

    if (formaPagamento === "Fiado" && !dataVencimento) {
      setErro("Informe a data de vencimento da venda fiado.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/interesses/${convertendo.id}/converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          formaPagamento,
          valorRecebido:
            formaPagamento === "Dinheiro" || formaPagamento === "Fiado" ? Number(valorRecebido || "0") : null,
          parcelas: formaPagamento === "Crédito" ? Number(parcelas || "1") : null,
          dataVencimento: formaPagamento === "Fiado" ? dataVencimento : null,
        }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível converter em venda."));
        return;
      }

      const venda = await res.json();
      setResultadoConversao({
        interesseId: convertendo.id,
        vendaId: venda.id,
        total: venda.total,
        saldoDevedor: venda.saldoDevedor,
        contaReceberId: venda.contaReceberId,
      });
      setConvertendo(null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  function formatarData(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6 w-full min-w-0">
        <PageHeader titulo="Interesses" />

        {!carregando && interesses.filter((i) => i.status === "Novo").length > 0 && filtro === "" && (
          <div className="rounded-xl bg-indigo-600 text-white px-4 py-3 mb-4 flex items-center gap-2 text-sm font-medium">
            <span className="text-lg">👉</span>
            {interesses.filter((i) => i.status === "Novo").length === 1
              ? "1 pessoa nova interessada — chame no WhatsApp!"
              : `${interesses.filter((i) => i.status === "Novo").length} pessoas novas interessadas — chame no WhatsApp!`}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              onClick={() => setFiltro(f.chave)}
              className={filtro === f.chave ? botaoPrimario : botaoSecundario}
            >
              {f.label}
            </button>
          ))}
        </div>

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <div className="flex flex-col gap-3">
          {interesses.map((i) => (
            <div
              key={i.id}
              className={`${cardStyle} p-4 flex flex-col gap-3 ${
                i.status === "Novo" ? "border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/30" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {i.produtoFotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.produtoFotoUrl} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center text-xl shrink-0">
                    💎
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{i.clienteNome}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_ESTILO[i.status]}`}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </div>
                  <div className="text-sm text-black/60 dark:text-white/60 truncate">
                    {i.produtoNome} — R$ {i.produtoPreco.toFixed(2)}
                  </div>
                  <div className="text-xs text-black/40 dark:text-white/40">{formatarData(i.dataCriacao)}</div>
                </div>
              </div>

              {resultadoConversao?.interesseId === i.id && (
                <div className="rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3">
                  Venda #{resultadoConversao.vendaId} criada — total R$ {resultadoConversao.total.toFixed(2)}.
                  {resultadoConversao.contaReceberId && (
                    <>
                      {" "}
                      Cobrança gerada (pendente: R$ {(resultadoConversao.saldoDevedor ?? resultadoConversao.total).toFixed(2)}) —{" "}
                      <a href="/cobrancas" className="underline font-medium">
                        ver em Cobranças
                      </a>
                      .
                    </>
                  )}
                </div>
              )}

              {i.status !== "Convertido" && i.status !== "Perdido" && (
                <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => chamarNoWhatsApp(i)}
                    className="h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
                  >
                    💬 Chamar no WhatsApp
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {i.status === "Novo" && (
                      <button onClick={() => reservar(i)} disabled={salvando} className={`${botaoSecundario} flex-1`}>
                        Reservar
                      </button>
                    )}
                    <button onClick={() => abrirConversao(i)} disabled={salvando} className={`${botaoPrimario} flex-1`}>
                      Vender
                    </button>
                  </div>
                  <button
                    onClick={() => marcarPerdido(i)}
                    disabled={salvando}
                    className="text-xs text-black/40 dark:text-white/40 hover:text-red-600 hover:underline self-center"
                  >
                    Não avançou
                  </button>
                </div>
              )}

              {i.status === "Convertido" && i.vendaId && (
                <a
                  href="/vendas"
                  className="pt-2 border-t border-black/5 dark:border-white/5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Ver venda #{i.vendaId}
                </a>
              )}
            </div>
          ))}

          {!carregando && interesses.length === 0 && (
            <p className="text-sm text-black/40 dark:text-white/40 text-center py-8">Nenhum interesse por aqui ainda.</p>
          )}
        </div>
      </main>

      {convertendo && (
        <Modal titulo={`Vender para ${convertendo.clienteNome}`} onFechar={() => setConvertendo(null)}>
          <form onSubmit={confirmarConversao} className="flex flex-col gap-3">
            <p className="text-sm text-black/60 dark:text-white/60">
              {convertendo.produtoNome} — R$ {convertendo.produtoPreco.toFixed(2)}
            </p>
            <div className="flex flex-col gap-1">
              <label className={labelStyle}>Forma de pagamento</label>
              <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={inputStyle}>
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
                <option value="Fiado">Fiado</option>
              </select>
            </div>

            {formaPagamento === "Crédito" && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className={`${inputStyle} w-20`}
                />
              </div>
            )}

            {(formaPagamento === "Dinheiro" || formaPagamento === "Fiado") && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>
                  {formaPagamento === "Fiado" ? "Valor pago agora (opcional)" : "Valor recebido"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  className={inputStyle}
                />
              </div>
            )}

            {formaPagamento === "Fiado" && (
              <div className="flex flex-col gap-1">
                <label className={labelStyle}>Data de vencimento</label>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className={inputStyle}
                />
              </div>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <button type="button" onClick={() => setConvertendo(null)} className="h-10 px-3 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className={botaoPrimario}>
                {salvando ? "Vendendo..." : "Confirmar venda"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
