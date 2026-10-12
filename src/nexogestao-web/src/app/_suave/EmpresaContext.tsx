"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";
import { EMPRESAS_TEMA_CLARO, definirPadraoClaroDaEmpresa } from "../../lib/tema";

export interface EmpresaAtual {
  id: number;
  nome: string;
  modulos: string[];
  papel: string;
  comandasHabilitadas: boolean;
}

export interface Avisos {
  naoLidas: number; // notificações da agenda
  vencidas: number; // cobranças vencidas
  interessesNovos: number;
}

interface Contexto {
  empresa: EmpresaAtual | null;
  avisos: Avisos;
  carregando: boolean;
  erro: string | null;
  // Chamada autenticada para /api/empresas/{id}{caminho}.
  api: (caminho: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<Contexto | null>(null);

// Para componentes que também existem fora do visual suave (ex.: o menu antigo): devolve null em vez de lançar erro.
export function useEmpresaOpcional() {
  return useContext(Ctx);
}

export function useEmpresa() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEmpresa fora do EmpresaProvider");
  return c;
}

// Carrega a empresa logada uma vez para todo o visual novo (menu, stories, agenda e clientes usam o mesmo contexto).
export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<EmpresaAtual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Avisos>({ naoLidas: 0, vencidas: 0, interessesNovos: 0 });

  useEffect(() => {
    const token = localStorage.getItem("nexo_token");
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/empresas/minhas`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const lista = await res.json();
        if (lista.length === 0) {
          setErro("Você ainda não tem nenhuma empresa cadastrada.");
          return;
        }
        const e = lista[0];
        const modulos: string[] = e.modulos ?? [];
        setEmpresa({ id: e.id, nome: e.nome, modulos, papel: e.papel ?? "", comandasHabilitadas: e.comandasHabilitadas ?? true });
        // Padrão claro só para empresas que pediram (por Id); nunca sobrescreve a escolha da pessoa.
        definirPadraoClaroDaEmpresa(EMPRESAS_TEMA_CLARO.includes(e.id));

        // Avisos do menu: um extra, falha em silêncio.
        const h = { headers: { Authorization: `Bearer ${token}` } };
        const base = `${API_URL}/api/empresas/${e.id}`;
        const [n, i, c] = await Promise.all([
          modulos.includes("Agenda") ? fetch(`${base}/notificacoes/nao-lidas`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
          modulos.includes("Interesses") ? fetch(`${base}/interesses?status=Novo`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
          modulos.includes("Cobrancas") ? fetch(`${base}/contas-receber/resumo`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
        ]);
        setAvisos({ naoLidas: n?.quantidade ?? 0, interessesNovos: Array.isArray(i) ? i.length : 0, vencidas: c?.quantidadeVencidas ?? 0 });
      } catch {
        setErro("Não consegui falar com o servidor. Tente de novo em instantes.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const api = useCallback(
    (caminho: string, init?: RequestInit) => {
      const token = localStorage.getItem("nexo_token") ?? "";
      return fetch(`${API_URL}/api/empresas/${empresa?.id}${caminho}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
      });
    },
    [empresa?.id]
  );

  const valor = useMemo(() => ({ empresa, avisos, carregando, erro, api }), [empresa, avisos, carregando, erro, api]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
