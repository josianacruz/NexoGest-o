"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, apiFetch, textoDoErro } from "../../../lib/api";
import { separarNomeEslogan } from "../../../lib/modulos";
import { useEmpresa } from "../../_suave/EmpresaContext";
import Folha from "../../_suave/Folha";
import { SUAVE } from "../../_suave/tokens";

interface EmpresaAdmin {
  id: number;
  nome: string;
  tipoNegocio: string | null;
  nicho: string;
  dataCriacao: string;
  perfil: "Salao" | "Loja" | "Alimentacao" | "Completo" | "Personalizado";
  modulos: string[];
  donos: string[];
}

type PerfilAplicavel = "Salao" | "Loja" | "Alimentacao" | "Completo";

// Perfis de acesso (mesma regra do servidor): o que cada tipo de cliente enxerga.
const PERFIS: Record<PerfilAplicavel, { nome: string; descricao: string; modulos: string[] }> = {
  Salao: { nome: "Salão de beleza", descricao: "Agenda, agendamento público, serviços e tabela, promoções e Stories, clientes.", modulos: ["Clientes", "Agenda", "Servicos", "Marketing"] },
  Loja: { nome: "Loja / varejo", descricao: "Estoque (produtos), vendas e caixa, clientes.", modulos: ["Clientes", "Produtos", "Vendas"] },
  Alimentacao: { nome: "Alimentação", descricao: "Comandas, cardápio, estoque, vendas e caixa, clientes. Sem agenda.", modulos: ["Clientes", "Produtos", "Vendas", "Comandas", "Marketing"] },
  Completo: { nome: "Completo", descricao: "Todos os módulos (menos Afiliados, que é ligado à parte).", modulos: ["Clientes", "Produtos", "Vendas", "Comandas", "Cobrancas", "Agenda", "Servicos", "Marketing", "Financeiro", "Interesses"] },
};

const ROTULO: Record<string, string> = {
  Clientes: "Clientes",
  Produtos: "Estoque",
  Vendas: "Vendas e caixa",
  Comandas: "Comandas",
  Cobrancas: "Cobranças",
  Agenda: "Agenda",
  Servicos: "Serviços e tabela",
  Marketing: "Promoções e Stories",
  Financeiro: "Relatórios",
  Interesses: "Interesses",
  Afiliados: "Afiliados",
};

const NOME_PERFIL: Record<string, string> = { Salao: "Salão", Loja: "Loja", Alimentacao: "Alimentação", Completo: "Completo", Personalizado: "Personalizado" };

// Console da administradora máster: todas as empresas, o perfil de cada uma e atalho para entrar no ambiente dela.
export default function AdminPage() {
  const { empresa, ehAdmin, carregando, trocarEmpresa } = useEmpresa();
  const [lista, setLista] = useState<EmpresaAdmin[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState<{ empresa: EmpresaAdmin; perfil: PerfilAplicavel } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const token = () => localStorage.getItem("nexo_token") ?? "";

  const carregar = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/admin/empresas`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.status === 403) return setErro("Esta área é só da administradora do sistema.");
      if (!res.ok) return setErro("Não consegui carregar as empresas. Tente de novo.");
      setLista(await res.json());
      setErro(null);
    } catch (e) {
      setErro(textoDoErro(e, "Não consegui carregar as empresas."));
    }
  }, []);

  useEffect(() => {
    if (ehAdmin) carregar();
  }, [ehAdmin, carregar]);

  async function aplicar() {
    if (!aplicando || salvando) return;
    setSalvando(true);
    try {
      const res = await apiFetch(`${API_URL}/api/admin/empresas/${aplicando.empresa.id}/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ perfil: aplicando.perfil }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(d?.mensagem ?? "Não foi possível aplicar o perfil.");
      } else {
        setAviso(`Perfil “${PERFIS[aplicando.perfil].nome}” aplicado em ${separarNomeEslogan(aplicando.empresa.nome).nome}. Quem estiver com a tela aberta vê a mudança ao recarregar.`);
        await carregar();
      }
      setAplicando(null);
    } catch (e) {
      setErro(textoDoErro(e, "Não foi possível aplicar o perfil."));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return null;
  if (!ehAdmin) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className={`${SUAVE.cartao} p-5 text-sm ${SUAVE.textoSuave}`}>Esta área é só da administradora do sistema.</p>
      </main>
    );
  }

  const desligaria = aplicando ? aplicando.empresa.modulos.filter((m) => m !== "Afiliados" && !PERFIS[aplicando.perfil].modulos.includes(m)) : [];
  const ligaria = aplicando ? PERFIS[aplicando.perfil].modulos.filter((m) => !aplicando.empresa.modulos.includes(m)) : [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
        <p className={`text-sm ${SUAVE.textoSuave}`}>Todas as empresas do sistema. Escolha o perfil de acesso de cada uma ou entre no ambiente dela para testar e dar suporte.</p>
      </div>

      {erro && (
        <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className={`rounded-2xl p-3 text-sm ${SUAVE.seloOk}`}>
          {aviso}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((e) => (
          <li key={e.id} className={`${SUAVE.cartao} flex min-w-0 flex-col gap-3 p-4`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold">{separarNomeEslogan(e.nome).nome}</p>
                <p className={`truncate text-xs ${SUAVE.textoFraco}`}>{e.donos.length ? e.donos.join(", ") : "sem Dono cadastrado"}</p>
              </div>
              <span className={`${SUAVE.selo} shrink-0 ${e.perfil === "Personalizado" ? SUAVE.seloAviso : SUAVE.seloInfo}`}>{NOME_PERFIL[e.perfil]}</span>
            </div>

            <p className={`text-xs ${SUAVE.textoSuave}`}>{e.modulos.map((m) => ROTULO[m] ?? m).join(" · ") || "Nenhum módulo ligado"}</p>

            <fieldset>
              <legend className={SUAVE.rotulo}>Perfil de acesso</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PERFIS) as PerfilAplicavel[]).map((p) => (
                  <button key={p} type="button" aria-pressed={e.perfil === p} onClick={() => e.perfil !== p && setAplicando({ empresa: e, perfil: p })} className={e.perfil === p ? SUAVE.chipAtivo : SUAVE.chip}>
                    {PERFIS[p].nome}
                  </button>
                ))}
              </div>
            </fieldset>

            <button type="button" onClick={() => trocarEmpresa(e.id)} disabled={empresa?.id === e.id} className={`${SUAVE.botaoSecundario} mt-auto`}>
              {empresa?.id === e.id ? "Você está neste ambiente" : "Entrar neste ambiente"}
            </button>
          </li>
        ))}
      </ul>

      {aplicando && (
        <Folha titulo={`Aplicar perfil “${PERFIS[aplicando.perfil].nome}”?`} subtitulo={separarNomeEslogan(aplicando.empresa.nome).nome} aoFechar={() => setAplicando(null)}>
          <div className="grid gap-4">
            <p className={`text-sm ${SUAVE.textoSuave}`}>{PERFIS[aplicando.perfil].descricao}</p>
            {ligaria.length > 0 && (
              <p className={`rounded-2xl p-3 text-sm ${SUAVE.seloOk}`}>
                <strong>Passa a aparecer:</strong> {ligaria.map((m) => ROTULO[m] ?? m).join(", ")}
              </p>
            )}
            {desligaria.length > 0 && (
              <p className={`rounded-2xl p-3 text-sm ${SUAVE.seloAviso}`}>
                <strong>Deixa de aparecer para a cliente:</strong> {desligaria.map((m) => ROTULO[m] ?? m).join(", ")}. Os dados não são apagados; voltam se o módulo for ligado de novo.
              </p>
            )}
            {ligaria.length === 0 && desligaria.length === 0 && <p className={`text-sm ${SUAVE.textoSuave}`}>Nada muda nos módulos; só o tipo de loja é ajustado.</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setAplicando(null)} className={`${SUAVE.botaoSecundario} flex-1`}>
                Cancelar
              </button>
              <button type="button" onClick={aplicar} disabled={salvando} className={`${SUAVE.botaoPrimario} flex-1`}>
                {salvando ? "Aplicando…" : "Aplicar"}
              </button>
            </div>
          </div>
        </Folha>
      )}
    </main>
  );
}
