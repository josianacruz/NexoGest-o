"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import PageHeader from "../_components/PageHeader";
import { botaoPrimario, botaoSecundario, cardStyle } from "../_components/ui";
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

  // Manda pra Vendas já com cliente e produto escolhidos — quem completa a
  // venda ali é o mesmo endpoint que já cuida de cobrança automaticamente.
  function irVenderNaTelaDeVendas(i: Interesse) {
    const params = new URLSearchParams({
      interesseId: String(i.id),
      clienteId: String(i.clienteId),
      clienteNome: i.clienteNome,
      produtoId: String(i.produtoId),
      produtoNome: i.produtoNome,
      produtoPreco: String(i.produtoPreco),
    });
    router.push(`/vendas?${params.toString()}`);
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
                  <div className="leading-snug flex items-center gap-2 flex-wrap">
                    <span>
                      <span className="font-semibold">{i.clienteNome}</span>
                      <span className="text-black/60 dark:text-white/60"> quer </span>
                      <span className="font-semibold">{i.produtoNome}</span>
                    </span>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_ESTILO[i.status]}`}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </div>
                  <div className="text-sm text-black/60 dark:text-white/60">
                    R$ {i.produtoPreco.toFixed(2)} · {formatarData(i.dataCriacao)}
                  </div>
                </div>
              </div>

              {i.status === "Novo" && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => chamarNoWhatsApp(i)}
                    className="h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
                  >
                    💬 Chamar no WhatsApp
                  </button>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button onClick={() => reservar(i)} disabled={salvando} className="text-black/50 dark:text-white/50 hover:underline">
                      Reservar
                    </button>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <button onClick={() => irVenderNaTelaDeVendas(i)} className="text-black/50 dark:text-white/50 hover:underline">
                      Já vendeu
                    </button>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <button onClick={() => marcarPerdido(i)} disabled={salvando} className="text-black/40 dark:text-white/40 hover:text-red-600 hover:underline">
                      Não avançou
                    </button>
                  </div>
                </div>
              )}

              {i.status === "Reservado" && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => irVenderNaTelaDeVendas(i)}
                    className="h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    ✅ Vender agora
                  </button>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button onClick={() => chamarNoWhatsApp(i)} className="text-black/50 dark:text-white/50 hover:underline">
                      WhatsApp
                    </button>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <button onClick={() => marcarPerdido(i)} disabled={salvando} className="text-black/40 dark:text-white/40 hover:text-red-600 hover:underline">
                      Não avançou
                    </button>
                  </div>
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
            <div className="text-center py-10">
              <p className="text-2xl mb-1">💎</p>
              <p className="text-sm text-black/50 dark:text-white/50">
                Nenhum interesse ainda. Crie uma Story em Produtos e compartilhe o link!
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
