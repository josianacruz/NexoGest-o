"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";

export interface EmpresaAtual {
  id: number;
  nome: string;
  modulos: string[];
  papel: string;
  comandasHabilitadas: boolean;
}

interface Contexto {
  empresa: EmpresaAtual | null;
  carregando: boolean;
  erro: string | null;
  // Chamada autenticada para /api/empresas/{id}{caminho}.
  api: (caminho: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<Contexto | null>(null);

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
        setEmpresa({ id: e.id, nome: e.nome, modulos: e.modulos ?? [], papel: e.papel ?? "", comandasHabilitadas: e.comandasHabilitadas ?? true });
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

  const valor = useMemo(() => ({ empresa, carregando, erro, api }), [empresa, carregando, erro, api]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
