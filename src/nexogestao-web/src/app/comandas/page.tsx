"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import Drawer from "../_components/Drawer";
import PageHeader from "../_components/PageHeader";
import SearchInput from "../_components/SearchInput";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, botaoPerigo, cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";

interface Produto {
  id: number;
  nome: string;
  preco: number;
}

interface Cliente {
  id: number;
  nome: string;
}

interface ItemComanda {
  id: number;
  produtoId: number;
  nome: string;
  quantidade: number;
  preco: number;
}

interface Comanda {
  id: number;
  numero: number;
  nomeCliente?: string | null;
  dataAbertura: string;
  itens: ItemComanda[];
}

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

export default function ComandasPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [nomeNovaComanda, setNomeNovaComanda] = useState("");
  const [selecionadas, setSelecionadas] = useState<number[]>([]);

  const [comandaAbertaId, setComandaAbertaId] = useState<number | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [valorRecebido, setValorRecebido] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [clienteSelecionado, setClienteSelecionado] = useState("");

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
      if (empresas.length === 0) return;

      const empresa = empresas[0];
      setEmpresaId(empresa.id);
      setEmpresaNome(empresa.nome);
      setComandasHabilitadas(empresa.comandasHabilitadas ?? true);

      const [resProdutos, resComandas, resClientes] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${empresa.id}/produtos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/comandas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${empresa.id}/clientes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setProdutos(await resProdutos.json());
      setComandas(await resComandas.json());
      setClientes(await resClientes.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  async function abrirComanda() {
    if (salvando) return;
    setErro(null);
    const token = getToken();
    if (!token || !empresaId) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/comandas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nomeCliente: nomeNovaComanda.trim() || null }),
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível abrir a comanda."));
        return;
      }

      const novaComanda = await res.json();
      setNomeNovaComanda("");
      await carregarTudo();
      setComandaAbertaId(novaComanda.id);
      setProdutoSelecionado("");
      setQuantidade("1");
      setFormaPagamento("PIX");
      setValorRecebido("");
      setParcelas("1");
      setClienteSelecionado("");
    } finally {
      setSalvando(false);
    }
  }

  function abrirDrawer(comanda: Comanda) {
    setErro(null);
    setComandaAbertaId(comanda.id);
    setProdutoSelecionado("");
    setQuantidade("1");
    setFormaPagamento("PIX");
    setValorRecebido("");
    setParcelas("1");
    setClienteSelecionado("");
  }

  function fecharDrawer() {
    setComandaAbertaId(null);
  }

  async function adicionarItem() {
    if (salvando || !comandaAbertaId || !produtoSelecionado || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaAbertaId}/itens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            produtoId: Number(produtoSelecionado),
            quantidade: Number(quantidade || "1"),
          }),
        }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível adicionar o item."));
        return;
      }

      setProdutoSelecionado("");
      setQuantidade("1");
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function alterarQuantidade(itemId: number, novaQuantidade: number) {
    if (salvando || !comandaAbertaId || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaAbertaId}/itens/${itemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ quantidade: novaQuantidade }),
        }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível atualizar o item."));
        return;
      }

      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function removerItem(itemId: number) {
    if (salvando || !comandaAbertaId || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaAbertaId}/itens/${itemId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível remover o item."));
        return;
      }

      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  const comandaAberta = comandas.find((c) => c.id === comandaAbertaId) ?? null;
  const totalAberta = comandaAberta
    ? comandaAberta.itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0)
    : 0;
  const valorPago = Number(valorRecebido || "0");
  const faltante =
    formaPagamento === "Dinheiro" || formaPagamento === "Fiado" ? totalAberta - valorPago : 0;
  const trocoCalculado =
    formaPagamento === "Dinheiro" && valorRecebido && faltante <= 0 ? valorPago - totalAberta : null;
  const precisaDeCliente = faltante > 0 && (formaPagamento === "Dinheiro" || formaPagamento === "Fiado");

  async function fecharComanda() {
    if (salvando || !comandaAbertaId || !empresaId) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    if (precisaDeCliente && !clienteSelecionado) {
      setErro("Selecione um cliente para registrar o valor que ficou faltando como fiado.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(
        `${API_URL}/api/empresas/${empresaId}/comandas/${comandaAbertaId}/fechar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            formaPagamento,
            clienteId: clienteSelecionado ? Number(clienteSelecionado) : null,
            valorRecebido:
              formaPagamento === "Dinheiro" || formaPagamento === "Fiado" ? valorPago : null,
            parcelas: formaPagamento === "Crédito" ? Number(parcelas || "1") : null,
          }),
        }
      );

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível fechar a comanda."));
        return;
      }

      fecharDrawer();
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarComanda() {
    if (salvando || !comandaAbertaId || !empresaId) return;
    if (!window.confirm("Cancelar esta comanda? Essa ação não pode ser desfeita.")) return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/comandas/${comandaAbertaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível cancelar a comanda."));
        return;
      }

      fecharDrawer();
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  function alternarSelecao(id: number) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  async function excluirSelecionadas() {
    if (salvando || !empresaId || selecionadas.length === 0) return;
    if (
      !window.confirm(
        `Cancelar ${selecionadas.length} ${selecionadas.length === 1 ? "comanda" : "comandas"}? Essa ação não pode ser desfeita.`
      )
    )
      return;
    setErro(null);
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    try {
      await Promise.all(
        selecionadas.map((id) =>
          fetch(`${API_URL}/api/empresas/${empresaId}/comandas/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      setSelecionadas([]);
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  const comandasFiltradas = comandas.filter((c) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return String(c.numero).includes(termo) || (c.nomeCliente ?? "").toLowerCase().includes(termo);
  });

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
        <PageHeader titulo="Comandas" />

        <div className={`${cardStyle} p-4 mb-4 flex flex-wrap gap-3 items-end`}>
          <div className="flex flex-col gap-1">
            <label className={labelStyle}>Nome do cliente (opcional)</label>
            <input
              value={nomeNovaComanda}
              onChange={(e) => setNomeNovaComanda(e.target.value)}
              placeholder="Ex: João"
              className={`${inputStyle} w-48`}
            />
          </div>
          <button onClick={abrirComanda} disabled={salvando} className={botaoPrimario}>
            {salvando ? "Abrindo..." : "+ Abrir comanda"}
          </button>
        </div>

        {comandas.length > 0 && (
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por nome ou número da comanda..."
            className="mb-4 max-w-xs"
          />
        )}

        {erro && !comandaAbertaId && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        {selecionadas.length > 0 && (
          <div className={`${cardStyle} p-3 mb-4 flex items-center justify-between gap-3`}>
            <span className="text-sm">
              {selecionadas.length} {selecionadas.length === 1 ? "comanda selecionada" : "comandas selecionadas"}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setSelecionadas([])} className={botaoTexto}>
                Limpar seleção
              </button>
              <button onClick={excluirSelecionadas} disabled={salvando} className={botaoPerigo}>
                Excluir selecionadas
              </button>
            </div>
          </div>
        )}

        {comandasFiltradas.length === 0 ? (
          <div className={`${cardStyle} py-6 px-4 text-center text-black/40 dark:text-white/40 text-sm`}>
            {carregando
              ? "Carregando..."
              : comandas.length === 0
              ? "Nenhuma comanda aberta."
              : "Nenhuma comanda encontrada pra essa busca."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {comandasFiltradas.map((c) => {
              const total = c.itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
              const qtdItens = c.itens.reduce((soma, i) => soma + i.quantidade, 0);
              const selecionada = selecionadas.includes(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => abrirDrawer(c)}
                  className={`${cardStyle} relative flex flex-col gap-1 p-4 pl-9 text-left cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all ${
                    selecionada ? "border-indigo-500 ring-1 ring-indigo-500" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => alternarSelecao(c.id)}
                    className="absolute top-4 left-3 w-4 h-4 accent-indigo-600 cursor-pointer"
                    aria-label={`Selecionar comanda #${c.numero}`}
                  />
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                    #{c.numero}
                  </span>
                  <span className="text-sm truncate">{c.nomeCliente ?? "Sem nome"}</span>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {qtdItens} {qtdItens === 1 ? "item" : "itens"}
                  </span>
                  <span className="font-semibold mt-1">R$ {total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {comandaAberta && (
        <Drawer
          titulo={`Comanda #${comandaAberta.numero}`}
          subtitulo={`${comandaAberta.nomeCliente ?? "Sem nome"} · aberta às ${new Date(
            comandaAberta.dataAbertura
          ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          onFechar={fecharDrawer}
        >
          <div className="flex flex-col gap-4">
            {comandaAberta.itens.length > 0 && (
              <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {comandaAberta.itens.map((item) => (
                      <tr key={item.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                        <td className="py-2 px-3">{item.nome}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => alterarQuantidade(item.id, item.quantidade - 1)}
                              disabled={salvando}
                              className="w-6 h-6 flex items-center justify-center rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-5 text-center">{item.quantidade}</span>
                            <button
                              onClick={() => alterarQuantidade(item.id, item.quantidade + 1)}
                              disabled={salvando}
                              className="w-6 h-6 flex items-center justify-center rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          R$ {(item.preco * item.quantidade).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => removerItem(item.id)}
                            disabled={salvando}
                            className="text-red-600 hover:underline text-xs font-medium disabled:opacity-40"
                          >
                            remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <label className={labelStyle}>Produto</label>
                <select
                  value={produtoSelecionado}
                  onChange={(e) => setProdutoSelecionado(e.target.value)}
                  className={`${inputStyle} w-full`}
                >
                  <option value="">Selecione um produto</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {p.preco}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-16">
                <label className={labelStyle}>Qtd.</label>
                <input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <button onClick={adicionarItem} disabled={salvando || !produtoSelecionado} className={botaoSecundario}>
                + Add
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-indigo-600/10 px-4 py-3">
              <span className="text-sm font-medium text-black/70 dark:text-white/70">Total</span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                R$ {totalAberta.toFixed(2)}
              </span>
            </div>

            <div className="border-t border-black/10 dark:border-white/10 pt-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className={labelStyle}>Pagamento</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className={inputStyle}
                  >
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
                      className={`${inputStyle} w-16`}
                    />
                  </div>
                )}

                {(formaPagamento === "Dinheiro" || formaPagamento === "Fiado") && (
                  <div className="flex flex-col gap-1">
                    <label className={labelStyle}>{formaPagamento === "Fiado" ? "Pago agora" : "Recebido"}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(e.target.value)}
                      className={`${inputStyle} w-24`}
                    />
                  </div>
                )}

                {(formaPagamento === "Fiado" || (formaPagamento === "Dinheiro" && faltante > 0)) && (
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <label className={labelStyle}>Cliente</label>
                    <select
                      value={clienteSelecionado}
                      onChange={(e) => setClienteSelecionado(e.target.value)}
                      className={`${inputStyle} w-full`}
                    >
                      <option value="">Selecione</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {trocoCalculado !== null && (
                <p className="text-sm font-medium text-green-600">Troco: R$ {trocoCalculado.toFixed(2)}</p>
              )}
              {faltante > 0 && (formaPagamento === "Dinheiro" || formaPagamento === "Fiado") && (
                <p className="text-sm font-medium text-amber-600">
                  {clienteSelecionado
                    ? `Fica devendo: R$ ${faltante.toFixed(2)}`
                    : `Falta R$ ${faltante.toFixed(2)} — selecione um cliente pra registrar como fiado`}
                </p>
              )}
              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <div className="flex gap-2">
                <button
                  onClick={fecharComanda}
                  disabled={
                    comandaAberta.itens.length === 0 ||
                    salvando ||
                    (precisaDeCliente && !clienteSelecionado)
                  }
                  className={`${botaoPrimario} flex-1`}
                >
                  {salvando ? "Salvando..." : "Fechar comanda"}
                </button>
                <button onClick={cancelarComanda} disabled={salvando} className={botaoSecundario}>
                  Cancelar comanda
                </button>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
