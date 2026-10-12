"use client";

import { useEffect, useState } from "react";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL } from "../../lib/api";

interface Consulta {
  id: number;
  nome: string;
  palavraChave: string;
  ordenacao: string;
  comissaoMinimaPercentual: number | null;
  maximoProdutos: number;
  ativa: boolean;
}

interface Execucao {
  id: number;
  origem: string;
  inicio: string;
  fim: string | null;
  status: string;
  consultas: number;
  chamadas: number;
  consultados: number;
  novos: number;
  atualizados: number;
  mensagem: string | null;
}

interface Estado {
  radarAtivo: boolean;
  credenciaisConfiguradas: boolean;
  fonteCredenciais: string | null;
  agendamento: string;
  agendadorInterno: boolean;
  gatilhoExternoConfigurado: boolean;
  consultas: Consulta[];
  ultimaExecucao: Execucao | null;
  aviso: string | null;
}

const ordenacoes: Record<string, string> = {
  Relevancia: "Relevância",
  Vendas: "Vendas",
  PrecoMaior: "Preço (maior primeiro)",
  PrecoMenor: "Preço (menor primeiro)",
  Comissao: "Comissão (maior primeiro)",
};

const statusTexto: Record<string, string> = {
  Executando: "Em andamento",
  Concluida: "Concluída",
  ConcluidaComAvisos: "Concluída com avisos",
  Falhou: "Falhou",
  NaoConfigurada: "Não configurada (nada foi consultado)",
};

const formVazio = { nome: "", palavraChave: "", ordenacao: "Comissao", comissaoMinimaPercentual: "", maximoProdutos: "50" };

// Radar Shopee: atualização diária de produtos, preços e comissões pela API OFICIAL de afiliados.
// Sem App ID e Secret aprovados pela Shopee nada é consultado; o CSV do painel continua sendo o caminho.
export default function RadarPanel({ empresaId, getToken, aoAtualizar }: { empresaId: number; getToken: () => string | null; aoAtualizar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [form, setForm] = useState(formVazio);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const base = `${API_URL}/api/empresas/${empresaId}/afiliados/radar`;
  const cab = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

  async function carregar() {
    if (!getToken()) return;
    const [r1, r2] = await Promise.all([fetch(base, { headers: cab() }), fetch(`${base}/execucoes`, { headers: cab() })]);
    if (r1.ok) setEstado(await r1.json());
    if (r2.ok) setExecucoes(await r2.json());
  }

  useEffect(() => {
    if (!aberto) return;
    carregar();
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
  }, [aberto]);

  async function chamar(url: string, metodo: string, corpo?: unknown) {
    setErro(null);
    setMsg(null);
    const res = await fetch(url, { method: metodo, headers: cab(), body: corpo ? JSON.stringify(corpo) : undefined });
    const dados = await res.json().catch(() => null);
    if (!res.ok) {
      setErro(dados?.mensagem ?? "Não foi possível concluir a ação.");
      return false;
    }
    if (dados?.mensagem) setMsg(dados.mensagem);
    await carregar();
    return true;
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const ok = await chamar(`${base}/consultas`, "POST", {
      nome: form.nome,
      palavraChave: form.palavraChave,
      ordenacao: form.ordenacao,
      comissaoMinimaPercentual: form.comissaoMinimaPercentual ? Number(form.comissaoMinimaPercentual.replace(",", ".")) : null,
      maximoProdutos: Number(form.maximoProdutos) || 50,
      ativa: true,
    });
    if (ok) setForm(formVazio);
  }

  async function executar() {
    if (await chamar(`${base}/executar`, "POST")) setTimeout(aoAtualizar, 15000);
  }

  return (
    <section className={`${cardStyle} p-4`}>
      <button onClick={() => setAberto((v) => !v)} className={`${botaoTexto} font-semibold`}>
        {aberto ? "▾" : "▸"} Radar Shopee (atualização diária pela API oficial)
      </button>
      {aberto && estado && (
        <div className="mt-3 space-y-4 text-sm">
          <div className={`rounded-lg p-3 ${estado.credenciaisConfiguradas ? "bg-green-500/10" : "bg-amber-500/10"}`}>
            {estado.credenciaisConfiguradas ? (
              <p>✓ Credenciais da API oficial configuradas ({estado.fonteCredenciais}).</p>
            ) : (
              <p>{estado.aviso}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {estado.agendamento} {estado.gatilhoExternoConfigurado ? "Gatilho externo configurado." : "Gatilho externo ainda não configurado."}
            </p>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={estado.radarAtivo}
                disabled={!estado.credenciaisConfiguradas && !estado.radarAtivo}
                onChange={(e) => chamar(`${base}/ativo`, "PUT", { ativo: e.target.checked })}
              />
              Atualizar automaticamente todos os dias às 08:00 (Brasília)
            </label>
          </div>

          <div>
            <h3 className="font-medium mb-2">O que consultar todos os dias</h3>
            {estado.consultas.length === 0 ? (
              <p className="text-gray-500">Nenhuma consulta cadastrada.</p>
            ) : (
              <ul className="space-y-1">
                {estado.consultas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 border border-black/10 dark:border-white/10 rounded px-3 py-2">
                    <span className="flex-1 min-w-0">
                      <strong>{c.nome}</strong>: “{c.palavraChave}”, {ordenacoes[c.ordenacao] ?? c.ordenacao}
                      {c.comissaoMinimaPercentual != null ? `, comissão mín. ${c.comissaoMinimaPercentual}%` : ""}, até {c.maximoProdutos} produtos
                      {c.ativa ? "" : " (pausada)"}
                    </span>
                    <button onClick={() => chamar(`${base}/consultas/${c.id}`, "DELETE")} className={botaoTexto}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={adicionar} className="grid sm:grid-cols-5 gap-2 mt-3">
              <div>
                <label className={labelStyle}>Nome</label>
                <input className={`${inputStyle} w-full`} required maxLength={60} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Cozinha" />
              </div>
              <div>
                <label className={labelStyle}>Palavra-chave</label>
                <input className={`${inputStyle} w-full`} required maxLength={100} value={form.palavraChave} onChange={(e) => setForm({ ...form, palavraChave: e.target.value })} placeholder="mini processador" />
              </div>
              <div>
                <label className={labelStyle}>Ordenar por</label>
                <select className={`${inputStyle} w-full`} value={form.ordenacao} onChange={(e) => setForm({ ...form, ordenacao: e.target.value })}>
                  {Object.entries(ordenacoes).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Comissão mín. (%)</label>
                <input className={`${inputStyle} w-full`} inputMode="decimal" value={form.comissaoMinimaPercentual} onChange={(e) => setForm({ ...form, comissaoMinimaPercentual: e.target.value })} />
              </div>
              <div>
                <label className={labelStyle}>Máx. produtos</label>
                <input className={`${inputStyle} w-full`} type="number" min={1} max={500} value={form.maximoProdutos} onChange={(e) => setForm({ ...form, maximoProdutos: e.target.value })} />
              </div>
              <div className="sm:col-span-5">
                <button type="submit" className={botaoSecundario}>Adicionar consulta</button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={executar} disabled={!estado.credenciaisConfiguradas || estado.consultas.length === 0} className={botaoPrimario}>
              Atualizar agora
            </button>
            {!estado.credenciaisConfiguradas && <span className="text-xs text-gray-500">Disponível depois que a Shopee liberar a API e você configurar o App ID e o Secret.</span>}
          </div>
          {msg && <p className="text-green-700">{msg}</p>}
          {erro && <p className="text-red-600">{erro}</p>}

          <div>
            <h3 className="font-medium mb-2">Últimas atualizações</h3>
            {execucoes.length === 0 ? (
              <p className="text-gray-500">Nenhuma ainda.</p>
            ) : (
              <ul className="space-y-1">
                {execucoes.map((e) => (
                  <li key={e.id} className="border border-black/10 dark:border-white/10 rounded px-3 py-2">
                    <p>
                      {new Date(e.inicio).toLocaleString("pt-BR")} ({e.origem}): <strong>{statusTexto[e.status] ?? e.status}</strong>. {e.consultados} produto(s) lido(s), {e.novos} novo(s), {e.atualizados} atualizado(s), {e.chamadas} chamada(s) à API.
                    </p>
                    {e.mensagem && <p className="text-xs text-amber-600">{e.mensagem}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
