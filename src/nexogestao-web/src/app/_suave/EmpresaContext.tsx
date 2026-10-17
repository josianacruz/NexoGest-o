"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, textoDoErro } from "../../lib/api";
import { definirEmpresaAtiva, escolherEmpresa } from "../../lib/empresaAtiva";
import { EMPRESAS_TEMA_CLARO, definirPadraoClaroDaEmpresa } from "../../lib/tema";

export interface EmpresaAtual {
  id: number;
  nome: string;
  modulos: string[]; // o que ESTA pessoa enxerga agora (a administradora vê tudo, ou só o da empresa em "ver como a cliente")
  modulosDaEmpresa: string[]; // o que a empresa realmente tem ligado
  papel: string; // Dono, Gerente, Atendente ou "Admin" (administradora máster em modo suporte)
  podeAdministrar: boolean; // Dono da empresa ou administradora máster
  comandasHabilitadas: boolean;
  nicho: "Alimentos" | "Moda" | "BelezaServicos" | "Outros";
  precisaEscolherTipo: boolean; // empresa nova que ainda não escolheu o tipo de negócio (primeiro acesso)
}

export interface EmpresaDaLista {
  id: number;
  nome: string;
  papel: string;
}

export interface Avisos {
  naoLidas: number; // notificações da agenda
  vencidas: number; // cobranças vencidas
  interessesNovos: number;
}

interface Contexto {
  empresa: EmpresaAtual | null;
  empresas: EmpresaDaLista[]; // todas as que a pessoa pode usar (a administradora máster vê todas do sistema)
  ehAdmin: boolean;
  modoSuporte: boolean; // administradora olhando uma empresa que não é dela
  verComoCliente: boolean; // administradora vendo só os módulos que a empresa realmente tem
  alternarVerComoCliente: () => void;
  trocarEmpresa: (id: number) => void;
  avisos: Avisos;
  carregando: boolean;
  erro: string | null;
  // Chamada autenticada para /api/empresas/{id}{caminho}.
  api: (caminho: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<Contexto | null>(null);
const CHAVE_VER_COMO_CLIENTE = "nexo_admin_ver_como_cliente";

// Para componentes que também existem fora do visual suave (ex.: o menu antigo): devolve null em vez de lançar erro.
export function useEmpresaOpcional() {
  return useContext(Ctx);
}

export function useEmpresa() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEmpresa fora do EmpresaProvider");
  return c;
}

interface EmpresaApi {
  id: number;
  nome: string;
  papel?: string;
  ehAdmin?: boolean;
  modulos?: string[];
  modulosDaEmpresa?: string[];
  comandasHabilitadas?: boolean;
  nicho?: EmpresaAtual["nicho"];
  precisaEscolherTipo?: boolean;
}

// Carrega a empresa em uso uma vez para todo o painel (menu, stories, agenda e clientes usam o mesmo contexto).
export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [brutas, setBrutas] = useState<EmpresaApi[]>([]);
  const [ativaId, setAtivaId] = useState<number | null>(null);
  const [verComoCliente, setVerComoCliente] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Avisos>({ naoLidas: 0, vencidas: 0, interessesNovos: 0 });

  useEffect(() => {
    try {
      setVerComoCliente(localStorage.getItem(CHAVE_VER_COMO_CLIENTE) === "1");
    } catch {
      /* ignora */
    }
    const token = localStorage.getItem("nexo_token");
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/empresas/minhas`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const lista: EmpresaApi[] = await res.json();
        if (lista.length === 0) {
          setErro("Você ainda não tem nenhuma empresa cadastrada.");
          return;
        }
        const e = escolherEmpresa(lista);
        definirEmpresaAtiva(e.id); // as telas antigas leem esta mesma escolha
        setBrutas(lista);
        setAtivaId(e.id);
        // Padrão claro só para empresas que pediram (por Id); nunca sobrescreve a escolha da pessoa.
        definirPadraoClaroDaEmpresa(EMPRESAS_TEMA_CLARO.includes(e.id));
      } catch (err) {
        setErro(textoDoErro(err, "Não consegui falar com o servidor. Tente de novo em instantes."));
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ehAdmin = brutas.some((e) => e.ehAdmin);

  const empresa = useMemo<EmpresaAtual | null>(() => {
    const e = brutas.find((x) => x.id === ativaId);
    if (!e) return null;
    const daEmpresa = e.modulosDaEmpresa ?? e.modulos ?? [];
    const modulos = e.ehAdmin && verComoCliente ? daEmpresa : (e.modulos ?? []);
    return {
      id: e.id,
      nome: e.nome,
      modulos,
      modulosDaEmpresa: daEmpresa,
      papel: e.papel ?? "",
      podeAdministrar: !!e.ehAdmin || e.papel === "Dono",
      comandasHabilitadas: e.comandasHabilitadas ?? true,
      nicho: e.nicho ?? "Outros",
      precisaEscolherTipo: !!e.precisaEscolherTipo && e.papel === "Dono",
    };
  }, [brutas, ativaId, verComoCliente]);

  // Avisos do menu (um extra; falha em silêncio), recarregados quando a empresa em uso muda.
  useEffect(() => {
    if (!empresa) return;
    const token = localStorage.getItem("nexo_token") ?? "";
    const h = { headers: { Authorization: `Bearer ${token}` } };
    const base = `${API_URL}/api/empresas/${empresa.id}`;
    const m = empresa.modulos;
    let vivo = true;
    (async () => {
      const [n, i, c] = await Promise.all([
        m.includes("Agenda") ? fetch(`${base}/notificacoes/nao-lidas`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
        m.includes("Interesses") ? fetch(`${base}/interesses?status=Novo`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
        m.includes("Cobrancas") ? fetch(`${base}/contas-receber/resumo`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
      ]);
      if (vivo) setAvisos({ naoLidas: n?.quantidade ?? 0, interessesNovos: Array.isArray(i) ? i.length : 0, vencidas: c?.quantidadeVencidas ?? 0 });
    })();
    return () => {
      vivo = false;
    };
  }, [empresa?.id]);

  const api = useCallback(
    (caminho: string, init?: RequestInit) => {
      const token = localStorage.getItem("nexo_token") ?? "";
      return apiFetch(`${API_URL}/api/empresas/${empresa?.id}${caminho}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
      });
    },
    [empresa?.id]
  );

  const trocarEmpresa = useCallback((id: number) => {
    definirEmpresaAtiva(id);
    // Recarrega a tela: todas as páginas (inclusive as que carregam os próprios dados) passam a usar a empresa nova.
    window.location.assign("/inicio");
  }, []);

  const alternarVerComoCliente = useCallback(() => {
    setVerComoCliente((v) => {
      try {
        localStorage.setItem(CHAVE_VER_COMO_CLIENTE, v ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }, []);

  const empresas = useMemo<EmpresaDaLista[]>(() => brutas.map((e) => ({ id: e.id, nome: e.nome, papel: e.papel ?? "" })), [brutas]);
  const modoSuporte = !!empresa && ehAdmin && empresa.papel === "Admin";

  const valor = useMemo(
    () => ({ empresa, empresas, ehAdmin, modoSuporte, verComoCliente, alternarVerComoCliente, trocarEmpresa, avisos, carregando, erro, api }),
    [empresa, empresas, ehAdmin, modoSuporte, verComoCliente, alternarVerComoCliente, trocarEmpresa, avisos, carregando, erro, api]
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
