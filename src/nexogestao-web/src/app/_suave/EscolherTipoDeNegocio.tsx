"use client";

import { useEffect, useState } from "react";
import { textoDoErro } from "../../lib/api";
import { TIPOS_DE_NEGOCIO, type TipoDeNegocio } from "../../lib/tiposDeNegocio";
import { useEmpresa } from "./EmpresaContext";
import { SUAVE } from "./tokens";

const chaveDispensado = (empresaId: number) => `nexo_tipo_dispensado_${empresaId}`;

// Primeiro acesso: pergunta o tipo do negócio para o menu mostrar só o que a pessoa usa. Só aparece para a Dono de uma
// empresa nova que ainda não escolheu (o servidor decide). "Agora não" esconde por este aparelho; os dados nunca somem.
export default function EscolherTipoDeNegocio() {
  const { empresa, api } = useEmpresa();
  const [dispensado, setDispensado] = useState(true);
  const [escolhido, setEscolhido] = useState<TipoDeNegocio | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!empresa) return;
    try {
      setDispensado(localStorage.getItem(chaveDispensado(empresa.id)) === "1");
    } catch {
      setDispensado(false);
    }
  }, [empresa?.id]);

  if (!empresa?.precisaEscolherTipo || dispensado) return null;

  function agoraNao() {
    try {
      localStorage.setItem(chaveDispensado(empresa!.id), "1");
    } catch {
      /* sem armazenamento: some só até recarregar */
    }
    setDispensado(true);
  }

  async function confirmar() {
    if (!escolhido || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await api("/tipo-de-negocio", { method: "PUT", body: JSON.stringify({ perfil: escolhido.perfil }) });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setErro(d?.mensagem ?? "Não consegui salvar agora. Tente de novo.");
        return;
      }
      window.location.reload(); // o menu passa a mostrar só os módulos do tipo escolhido
    } catch (e) {
      setErro(textoDoErro(e, "Não consegui salvar agora. Tente de novo."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/50 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-tipo">
      <div className={`${SUAVE.cartao} flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl`}>
        <div className="px-5 pt-5">
          <h2 id="titulo-tipo" className="text-xl font-bold">
            Qual é o seu tipo de negócio?
          </h2>
          <p className={`mt-1 text-sm ${SUAVE.textoSuave}`}>Assim o menu mostra só o que você usa. Nenhum dado é apagado e a administradora pode mudar depois.</p>
        </div>

        <div role="radiogroup" aria-label="Tipo de negócio" className="grid gap-2 overflow-y-auto px-5 py-4">
          {TIPOS_DE_NEGOCIO.map((t) => {
            const ativo = escolhido?.perfil === t.perfil;
            return (
              <button
                key={t.perfil}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setEscolhido(t)}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${ativo ? "border-violet-300 bg-violet-100 ring-2 ring-violet-300 dark:border-violet-300/40 dark:bg-violet-300/20" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {t.icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.nome}</span>
                  <span className={`block text-xs ${SUAVE.textoSuave}`}>{t.exemplos}</span>
                  {ativo && <span className={`mt-1 block text-xs ${SUAVE.textoFraco}`}>Vai mostrar: {t.mostra}.</span>}
                </span>
              </button>
            );
          })}
        </div>

        {erro && (
          <p role="alert" className={`mx-5 mb-3 rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
            {erro}
          </p>
        )}

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={agoraNao} disabled={salvando} className={`${SUAVE.botaoSecundario} flex-1`}>
            Agora não
          </button>
          <button type="button" onClick={confirmar} disabled={!escolhido || salvando} className={`${SUAVE.botaoPrimario} flex-1`}>
            {salvando ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
