"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { brl, type ServicoPublico } from "../../../../lib/chic";
import { E } from "../../_estilo";
import { baixarTabelaPdf, buscarPagina, paginaEmCache, type Loja } from "../../_dados";

// Cardápio público de serviços: é o link que a dona do salão copia e manda para as clientes.
export default function TabelaPublicaPage() {
  const empresaId = Number(useParams().empresaId);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [servicos, setServicos] = useState<ServicoPublico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    const guardada = paginaEmCache(empresaId, true);
    if (guardada) {
      setLoja(guardada.loja);
      setServicos(guardada.servicos);
      setCarregando(false);
    }
    buscarPagina(empresaId, true)
      .then((p) => {
        setLoja(p.loja);
        setServicos(p.servicos);
        setErro(null);
      })
      .catch((e: Error & { status?: number }) => {
        if (!guardada || e.status === 404) setErro(e.message || "Não foi possível carregar a tabela de preços.");
      })
      .finally(() => setCarregando(false));
  }, [empresaId]);

  async function pdf() {
    if (!loja || baixando) return;
    setBaixando(true);
    try {
      await baixarTabelaPdf(empresaId, loja, `${window.location.origin}/agendar/${empresaId}`);
    } catch {
      setErro("Não consegui gerar o PDF agora. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  }

  if (carregando) return <main className="mx-auto max-w-md px-5 py-16 text-center text-[#66666E]">Carregando…</main>;
  if (erro || !loja)
    return (
      <main className="mx-auto max-w-md px-5 py-12">
        <p className={E.erro}>{erro ?? "Tabela indisponível."}</p>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <header className="mb-7 text-center">
        <h1 className={`${E.titulo} text-[26px] font-semibold leading-tight tracking-[0.06em]`}>{loja.nome}</h1>
        {loja.slogan && <p className={`${E.titulo} mt-1 text-[15px] italic ${E.suave}`}>{loja.slogan}</p>}
        <div className="mx-auto mt-3 h-px w-10 bg-[#C9A96E]" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#8A6A2F]">Tabela de serviços</p>
      </header>

      {servicos.length === 0 ? (
        <p className={`${E.cartao} p-5 text-center ${E.suave}`}>Nenhum serviço cadastrado ainda.</p>
      ) : (
        <ul className={`${E.cartao} divide-y divide-[#EFE5DC] px-5`}>
          {servicos.map((s) => (
            <li key={s.id} className="flex items-baseline gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className={`${E.titulo} text-lg font-medium leading-snug`}>{s.nome}</p>
                <p className={`text-sm ${E.suave}`}>{s.duracaoMinutos} min</p>
              </div>
              <p className={`shrink-0 text-lg font-semibold ${E.dourado}`}>{brl(s.preco)}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={pdf} disabled={baixando || servicos.length === 0} className={E.botaoContorno}>
          {baixando ? "Gerando PDF…" : "Baixar tabela em PDF"}
        </button>
        {loja.whatsapp && (
          <a href={`https://wa.me/${loja.whatsapp}?text=${encodeURIComponent("Olá! Vi a tabela de serviços e gostaria de agendar. 💖")}`} target="_blank" rel="noopener noreferrer" className={E.botaoVerde}>
            Falar no WhatsApp
          </a>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#FAF7F4] via-[#FAF7F4] to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto max-w-md">
          <Link href={`/agendar/${empresaId}`} className={E.botao}>
            Agendar meu horário
          </Link>
        </div>
      </div>
    </main>
  );
}
