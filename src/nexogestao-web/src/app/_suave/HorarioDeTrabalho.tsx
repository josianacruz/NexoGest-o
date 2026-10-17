"use client";

import { useEffect, useState } from "react";
import { textoDoErro } from "../../lib/api";
import { NOMES_DIAS, OPCOES_HORA, ORDEM_NA_TELA, SEMANA_PADRAO, validarSemana, type DiaTrabalho } from "../../lib/horarioTrabalho";
import { useEmpresa } from "./EmpresaContext";
import { SUAVE } from "./tokens";

// Configurações > Horário de trabalho: em quais dias a loja atende e de que hora até que hora.
// É a regra única da agenda: a página de agendamento das clientes só oferece horários dentro dela (e o servidor recusa
// pedidos fora dela), e os horários rápidos do painel também a seguem.
export default function HorarioDeTrabalho() {
  const { empresa, api } = useEmpresa();
  const [semana, setSemana] = useState<DiaTrabalho[]>(SEMANA_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    if (!empresa?.modulos.includes("Agenda")) return;
    (async () => {
      try {
        const r = await api("/agenda/perfil");
        if (r.ok) setSemana(await r.json());
      } catch (e) {
        setAviso({ tipo: "erro", texto: textoDoErro(e, "Não consegui carregar o horário.") });
      } finally {
        setCarregando(false);
      }
    })();
  }, [empresa?.id]);

  if (!empresa?.modulos.includes("Agenda")) return null;

  const mudar = (diaSemana: number, parte: Partial<DiaTrabalho>) => {
    setSemana((s) => s.map((d) => (d.diaSemana === diaSemana ? { ...d, ...parte } : d)));
    setAlterado(true);
    setAviso(null);
  };

  const dia = (n: number) => semana.find((d) => d.diaSemana === n) ?? SEMANA_PADRAO[n];

  function copiarDaSegunda() {
    const seg = dia(1);
    setSemana((s) => s.map((d) => (d.ativo ? { ...d, horaInicio: seg.horaInicio, horaFim: seg.horaFim } : d)));
    setAlterado(true);
    setAviso(null);
  }

  async function salvar() {
    const erro = validarSemana(semana);
    if (erro) return setAviso({ tipo: "erro", texto: erro });
    setSalvando(true);
    setAviso(null);
    try {
      const r = await api("/agenda/perfil", {
        method: "PUT",
        body: JSON.stringify({ dias: semana.map((d) => ({ diaSemana: d.diaSemana, ativo: d.ativo, horaInicio: d.horaInicio, horaFim: d.horaFim })) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) return setAviso({ tipo: "erro", texto: d?.mensagem ?? (r.status === 403 ? "Só o Dono da loja pode mudar o horário de trabalho." : "Não foi possível salvar. Tente de novo.") });
      setSemana(d);
      setAlterado(false);
      setAviso({ tipo: "ok", texto: "Horário salvo. Os clientes só veem horários dentro dele." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: textoDoErro(e, "Não foi possível salvar. Tente de novo.") });
    } finally {
      setSalvando(false);
    }
  }

  // Mantém na lista um horário que já esteja salvo mesmo que não seja de meia em meia hora (ex.: 08:15).
  const opcoes = (atual: string) => (OPCOES_HORA.includes(atual) ? OPCOES_HORA : [...OPCOES_HORA, atual].sort());
  const podeEditar = empresa.podeAdministrar;

  return (
    <section className={`${SUAVE.cartao} p-5`}>
      <h2 className="mb-1 font-semibold">Horário de trabalho</h2>
      <p className={`mb-4 text-sm ${SUAVE.textoSuave}`}>
        Escolha os dias e o horário em que você atende. A página de agendamento das clientes só mostra horários dentro desse período, e a sua agenda também segue ele.
      </p>

      {carregando ? (
        <p className={`text-sm ${SUAVE.textoFraco}`}>Carregando…</p>
      ) : (
        <div className="grid gap-3">
          {ORDEM_NA_TELA.map((n) => {
            const d = dia(n);
            return (
              <div key={n} className={`grid gap-2 rounded-2xl border p-3 sm:grid-cols-[11rem_1fr] sm:items-center ${d.ativo ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40"}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-6 w-6 shrink-0 accent-violet-500" checked={d.ativo} disabled={!podeEditar} onChange={(e) => mudar(n, { ativo: e.target.checked })} />
                  <span className="font-semibold">{NOMES_DIAS[n]}</span>
                </label>
                {d.ativo ? (
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`ini-${n}`}>
                      {NOMES_DIAS[n]}: abre às
                    </label>
                    <select id={`ini-${n}`} className={SUAVE.campo} value={d.horaInicio} disabled={!podeEditar} onChange={(e) => mudar(n, { horaInicio: e.target.value })}>
                      {opcoes(d.horaInicio).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className={SUAVE.textoSuave}>até</span>
                    <label className="sr-only" htmlFor={`fim-${n}`}>
                      {NOMES_DIAS[n]}: fecha às
                    </label>
                    <select id={`fim-${n}`} className={SUAVE.campo} value={d.horaFim} disabled={!podeEditar} onChange={(e) => mudar(n, { horaFim: e.target.value })}>
                      {opcoes(d.horaFim).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className={`text-sm ${SUAVE.textoSuave}`}>Fechado</p>
                )}
              </div>
            );
          })}

          {aviso && (
            <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`rounded-2xl p-3 text-sm ${aviso.tipo === "erro" ? SUAVE.seloErro : SUAVE.seloOk}`}>
              {aviso.texto}
            </p>
          )}
          {!podeEditar && <p className={`text-sm ${SUAVE.textoSuave}`}>Só o Dono da loja pode mudar o horário de trabalho.</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiarDaSegunda} disabled={!podeEditar} className={SUAVE.botaoSecundario}>
              Usar o horário de segunda nos outros dias abertos
            </button>
            <button type="button" onClick={salvar} disabled={!podeEditar || salvando || !alterado} className={SUAVE.botaoPrimario}>
              {salvando ? "Salvando…" : "Salvar horário"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
