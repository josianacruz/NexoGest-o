"use client";

import { useEffect, useRef, useState } from "react";
import { EVENTO_PAGAMENTO, type DadosPagamento } from "../../lib/pagamentoOk";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Cartão grande de confirmação, para a dona da loja ter certeza de que o recebimento foi gravado (mesmo olhando de
// relance, com o cliente na frente). Some sozinho em 4 s; "OK" fecha na hora. Leitores de tela anunciam o texto.
export default function PagamentoConfirmado() {
  const [dados, setDados] = useState<DadosPagamento | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const aoReceber = (e: Event) => {
      const d = (e as CustomEvent<DadosPagamento>).detail ?? {};
      setDados(d);
      try {
        navigator.vibrate?.(80); // vibração curta no celular
      } catch {
        /* sem vibração */
      }
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setDados(null), 4000);
    };
    window.addEventListener(EVENTO_PAGAMENTO, aoReceber);
    return () => {
      window.removeEventListener(EVENTO_PAGAMENTO, aoReceber);
      if (relogio.current) clearTimeout(relogio.current);
    };
  }, []);

  if (!dados) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-slate-900/30 p-4" aria-live="polite">
      <div role="status" className="pointer-events-auto w-full max-w-xs rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-2xl dark:border-emerald-400/30 dark:bg-slate-800">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100" aria-hidden="true">
          ✓
        </div>
        <p className="text-lg font-bold leading-snug text-slate-900 dark:text-slate-50">{dados.titulo ?? "Pagamento efetuado com sucesso"}</p>
        {dados.valor !== undefined && dados.valor > 0 && <p className="mt-1 text-3xl font-extrabold text-emerald-800 dark:text-emerald-200">{brl(dados.valor)}</p>}
        {(dados.forma || dados.quem) && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{[dados.forma, dados.quem].filter(Boolean).join(" · ")}</p>}
        {dados.detalhe && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dados.detalhe}</p>}
        <button type="button" onClick={() => setDados(null)} className="mt-4 min-h-12 w-full rounded-2xl bg-emerald-100 px-5 text-base font-semibold text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-100">
          OK
        </button>
      </div>
    </div>
  );
}
