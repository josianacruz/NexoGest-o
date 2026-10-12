"use client";

import { useEffect, useState } from "react";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";

interface Credencial {
  id: number;
  nome: string;
  prefixo: string;
  criadaEm: string;
  ultimoContato: string | null;
  online: boolean;
  maquina: string | null;
  versao: string | null;
  pasta: string | null;
  espacoUsadoBytes: number | null;
  espacoLivreBytes: number | null;
}

const tamanho = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB` : `${(b / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} MB`;

// Gerencia o worker que gera os vídeos NO SEU COMPUTADOR: credencial própria da empresa (revogável),
// estado de conexão, pasta e espaço em disco. O Nexo online não guarda nem baixa os vídeos.
export default function WorkerPanel({ empresaId, getToken }: { empresaId: number; getToken: () => string | null }) {
  const [aberto, setAberto] = useState(false);
  const [credenciais, setCredenciais] = useState<Credencial[]>([]);
  const [nome, setNome] = useState("Meu computador");
  const [novoToken, setNovoToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function carregar() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/worker`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCredenciais((await res.json()).credenciais);
  }

  useEffect(() => {
    if (!aberto) return;
    carregar();
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [aberto]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setErro(null);
    const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/worker/credenciais`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome }),
    });
    const dados = await res.json().catch(() => null);
    if (!res.ok) {
      setErro(dados?.mensagem ?? "Não foi possível criar a credencial.");
      return;
    }
    setNovoToken(dados.token);
    setCopiado(false);
    await carregar();
  }

  async function revogar(id: number) {
    if (!confirm("Revogar esta credencial? O worker que a usa para de funcionar na hora.")) return;
    const token = getToken();
    if (!token) return;
    await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/worker/credenciais/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await carregar();
  }

  return (
    <section className={`${cardStyle} p-4`}>
      <button onClick={() => setAberto((v) => !v)} className={`${botaoTexto} font-semibold`}>
        {aberto ? "▾" : "▸"} Worker de vídeo (gera os vídeos no seu computador)
      </button>
      {aberto && (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-gray-500">
            Os vídeos são montados no seu computador e ficam numa pasta dele; este site guarda só o texto e os dados. O
            worker só faz conexões de saída até aqui (nenhuma porta aberta no seu roteador) e usa uma credencial própria
            desta empresa, que você pode revogar a qualquer momento.
          </p>

          {credenciais.length === 0 ? (
            <p className="text-sm">Nenhuma credencial ativa. Crie uma abaixo e coloque o código no worker.</p>
          ) : (
            <div className="space-y-2">
              {credenciais.map((c) => (
                <div key={c.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3 text-sm flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {c.nome} <span className="text-xs text-gray-400">({c.prefixo}…)</span>{" "}
                      <span className={c.online ? "text-green-600" : "text-amber-600"}>{c.online ? "● conectado" : "○ desconectado"}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {c.ultimoContato ? `Último contato: ${new Date(c.ultimoContato).toLocaleString("pt-BR")}` : "Nunca conectou"}
                      {c.maquina ? ` · ${c.maquina}` : ""}
                      {c.versao ? ` · versão ${c.versao}` : ""}
                    </p>
                    {c.pasta && <p className="text-xs text-gray-500 break-all">Pasta dos vídeos: {c.pasta}</p>}
                    {c.espacoUsadoBytes != null && c.espacoLivreBytes != null && (
                      <p className="text-xs text-gray-500">
                        Vídeos ocupam {tamanho(c.espacoUsadoBytes)}; livre no disco: {tamanho(c.espacoLivreBytes)}. Nada é apagado
                        automaticamente.
                      </p>
                    )}
                  </div>
                  <button onClick={() => revogar(c.id)} className={botaoTexto}>
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={criar} className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelStyle}>Nome da credencial</label>
              <input className={inputStyle} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
            </div>
            <button type="submit" className={botaoSecundario}>
              Criar credencial
            </button>
          </form>
          {erro && <p className="text-sm text-red-600">{erro}</p>}

          {novoToken && (
            <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-sm space-y-2">
              <p className="font-medium">Copie o código agora: ele só aparece desta vez.</p>
              <code className="block break-all text-xs bg-black/10 dark:bg-white/10 rounded p-2">{novoToken}</code>
              <div className="flex gap-3">
                <button
                  onClick={() => navigator.clipboard?.writeText(novoToken).then(() => setCopiado(true))}
                  className={botaoSecundario}
                >
                  {copiado ? "Copiado" : "Copiar"}
                </button>
                <button onClick={() => setNovoToken(null)} className={botaoTexto}>
                  Já guardei
                </button>
              </div>
              <p className="text-xs text-gray-500">
                No computador do worker, defina a variável de ambiente NEXO_WORKER_TOKEN com este código (ou use o arquivo de
                configuração do worker). Não o envie para ninguém e não o coloque em arquivos do projeto.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
