"use client";

import { useState } from "react";
import { SUAVE } from "./tokens";

export type Nicho = "Alimentos" | "Moda" | "BelezaServicos" | "Outros";

export const NICHOS: { valor: Nicho; nome: string; icone: string; descricao: string }[] = [
  { valor: "Alimentos", nome: "Alimentos", icone: "🍔", descricao: "Adicionais, ingredientes e tamanhos" },
  { valor: "Moda", nome: "Moda e roupas", icone: "👗", descricao: "Cores e grade de tamanhos (PP a XG)" },
  { valor: "BelezaServicos", nome: "Beleza e serviços", icone: "💇", descricao: "Duração em minutos" },
  { valor: "Outros", nome: "Outros", icone: "🛍️", descricao: "Cadastro simples, sem campos extras" },
];

export const GRADE = ["PP", "P", "M", "G", "GG", "XG"] as const;

export interface OpcaoForm {
  nome: string;
  preco: string;
}

// Estado do formulário (tudo texto, como os campos); `atributosParaApi` converte para o que a API espera.
export interface AtributosForm {
  adicionais: OpcaoForm[];
  ingredientes: string;
  tamanhos: OpcaoForm[];
  cores: string[];
  grade: string[];
  duracao: string;
}

export const atributosVazios = (): AtributosForm => ({ adicionais: [], ingredientes: "", tamanhos: [], cores: [], grade: [], duracao: "" });

interface AtributosApi {
  adicionais?: { nome: string; preco: number }[] | null;
  ingredientes?: string | null;
  tamanhos?: { nome: string; preco: number }[] | null;
  cores?: string[] | null;
  grade?: string[] | null;
  duracaoMinutos?: number | null;
}

export function atributosDaApi(a?: AtributosApi | null): AtributosForm {
  if (!a) return atributosVazios();
  const op = (l?: { nome: string; preco: number }[] | null) => (l ?? []).map((o) => ({ nome: o.nome, preco: String(o.preco) }));
  return { adicionais: op(a.adicionais), ingredientes: a.ingredientes ?? "", tamanhos: op(a.tamanhos), cores: a.cores ?? [], grade: a.grade ?? [], duracao: a.duracaoMinutos ? String(a.duracaoMinutos) : "" };
}

export function atributosParaApi(f: AtributosForm) {
  const op = (l: OpcaoForm[]) => l.filter((o) => o.nome.trim()).map((o) => ({ nome: o.nome.trim(), preco: Number(o.preco.replace(",", ".")) || 0 }));
  return {
    adicionais: op(f.adicionais),
    ingredientes: f.ingredientes.trim() || null,
    tamanhos: op(f.tamanhos),
    cores: f.cores,
    grade: f.grade,
    duracaoMinutos: f.duracao ? Number(f.duracao) : null,
  };
}

// Resumo curto para a lista de produtos ("P M G · Preto, Azul", "45 min"…), conforme o nicho.
export function resumoDosAtributos(nicho: Nicho, a?: AtributosApi | null): string[] {
  if (!a) return [];
  const r: string[] = [];
  if (nicho === "Moda") {
    if (a.grade?.length) r.push(a.grade.join(" "));
    if (a.cores?.length) r.push(a.cores.join(", "));
  } else if (nicho === "Alimentos") {
    if (a.ingredientes) r.push(a.ingredientes);
    if (a.tamanhos?.length) r.push(`${a.tamanhos.length} ${a.tamanhos.length === 1 ? "tamanho" : "tamanhos"}`);
    if (a.adicionais?.length) r.push(`${a.adicionais.length} ${a.adicionais.length === 1 ? "adicional" : "adicionais"}`);
  } else if (nicho === "BelezaServicos") {
    if (a.duracaoMinutos) r.push(`${a.duracaoMinutos} min`);
  }
  return r;
}

// Linhas de detalhe para a arte do cardápio (texto completo, ao contrário do resumo da lista).
export function linhasParaArte(nicho: Nicho, a?: AtributosApi | null): string[] {
  if (!a) return [];
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const r: string[] = [];
  if (nicho === "Alimentos") {
    if (a.ingredientes) r.push(a.ingredientes);
    if (a.tamanhos?.length) r.push(a.tamanhos.map((t) => `${t.nome} ${brl(t.preco)}`).join(" · "));
    if (a.adicionais?.length) r.push(`Adicionais: ${a.adicionais.map((x) => `${x.nome} +${brl(x.preco)}`).join(", ")}`);
  } else if (nicho === "Moda") {
    if (a.grade?.length) r.push(`Tamanhos: ${a.grade.join(" ")}`);
    if (a.cores?.length) r.push(`Cores: ${a.cores.join(", ")}`);
  } else if (nicho === "BelezaServicos") {
    if (a.duracaoMinutos) r.push(`${a.duracaoMinutos} min`);
  }
  return r;
}

const SUGESTOES_TAMANHO = ["Pequeno", "Médio", "Grande"];
const SUGESTOES_COR = ["Preto", "Branco", "Azul", "Rosa", "Vermelho", "Verde"];
const DURACOES = [15, 30, 45, 60, 90, 120];

function ListaDeOpcoes({ titulo, dica, itens, aoMudar, sugestoes, textoBotao }: { titulo: string; dica: string; itens: OpcaoForm[]; aoMudar: (l: OpcaoForm[]) => void; sugestoes?: string[]; textoBotao: string }) {
  const atualiza = (i: number, parte: Partial<OpcaoForm>) => aoMudar(itens.map((o, j) => (j === i ? { ...o, ...parte } : o)));
  return (
    <fieldset className="grid gap-2">
      <legend className={SUAVE.rotulo}>{titulo}</legend>
      <p className={`-mt-1 text-xs ${SUAVE.textoFraco}`}>{dica}</p>
      {itens.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={`${titulo}: nome ${i + 1}`} className={SUAVE.campo} value={o.nome} maxLength={40} placeholder="Nome" onChange={(e) => atualiza(i, { nome: e.target.value })} />
          <input aria-label={`${titulo}: preço ${i + 1}`} className={`${SUAVE.campo} !w-28 shrink-0`} inputMode="decimal" value={o.preco} placeholder="R$" onChange={(e) => atualiza(i, { preco: e.target.value })} />
          <button type="button" aria-label={`Remover ${o.nome || titulo}`} onClick={() => aoMudar(itens.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {sugestoes
          ?.filter((s) => !itens.some((o) => o.nome.toLowerCase() === s.toLowerCase()))
          .map((s) => (
            <button key={s} type="button" onClick={() => aoMudar([...itens, { nome: s, preco: "" }])} className={SUAVE.chip}>
              + {s}
            </button>
          ))}
        <button type="button" onClick={() => aoMudar([...itens, { nome: "", preco: "" }])} className={SUAVE.chip}>
          {textoBotao}
        </button>
      </div>
    </fieldset>
  );
}

// Campos que mudam conforme o nicho da loja. Em "Outros" não aparece nada.
export default function CamposDoNicho({ nicho, valor, aoMudar }: { nicho: Nicho; valor: AtributosForm; aoMudar: (v: AtributosForm) => void }) {
  const [novaCor, setNovaCor] = useState("");
  const set = (parte: Partial<AtributosForm>) => aoMudar({ ...valor, ...parte });

  if (nicho === "Alimentos") {
    return (
      <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <div>
          <label htmlFor="ingredientes" className={SUAVE.rotulo}>
            Ingredientes (opcional)
          </label>
          <input id="ingredientes" className={SUAVE.campo} value={valor.ingredientes} maxLength={300} placeholder="Ex.: pão, carne, queijo, alface" onChange={(e) => set({ ingredientes: e.target.value })} />
        </div>
        <ListaDeOpcoes titulo="Tamanhos" dica="Cada tamanho com o preço dele." itens={valor.tamanhos} aoMudar={(tamanhos) => set({ tamanhos })} sugestoes={SUGESTOES_TAMANHO} textoBotao="+ Outro tamanho" />
        <ListaDeOpcoes titulo="Adicionais" dica="Extras que o cliente pode somar (ex.: bacon +R$ 3,00)." itens={valor.adicionais} aoMudar={(adicionais) => set({ adicionais })} textoBotao="+ Adicional" />
      </div>
    );
  }

  if (nicho === "Moda") {
    const todos = valor.grade.length === GRADE.length;
    const adicionarCor = (c: string) => {
      const cor = c.trim();
      if (!cor || valor.cores.some((x) => x.toLowerCase() === cor.toLowerCase())) return;
      set({ cores: [...valor.cores, cor.slice(0, 20)] });
      setNovaCor("");
    };
    return (
      <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <fieldset>
          <legend className={SUAVE.rotulo}>Grade de tamanhos</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {GRADE.map((g) => {
              const ativo = valor.grade.includes(g);
              return (
                <button key={g} type="button" aria-pressed={ativo} onClick={() => set({ grade: ativo ? valor.grade.filter((x) => x !== g) : [...valor.grade, g].sort((a, b) => GRADE.indexOf(a as (typeof GRADE)[number]) - GRADE.indexOf(b as (typeof GRADE)[number])) })} className={ativo ? SUAVE.chipAtivo : SUAVE.chip}>
                  {g}
                </button>
              );
            })}
            <button type="button" onClick={() => set({ grade: todos ? [] : [...GRADE] })} className={SUAVE.chip}>
              {todos ? "Limpar" : "Todos"}
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend className={SUAVE.rotulo}>Cores</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {valor.cores.map((c) => (
              <button key={c} type="button" onClick={() => set({ cores: valor.cores.filter((x) => x !== c) })} className={SUAVE.chipAtivo} aria-label={`Tirar a cor ${c}`}>
                {c} ✕
              </button>
            ))}
            {SUGESTOES_COR.filter((c) => !valor.cores.some((x) => x.toLowerCase() === c.toLowerCase())).map((c) => (
              <button key={c} type="button" onClick={() => adicionarCor(c)} className={SUAVE.chip}>
                + {c}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input aria-label="Outra cor" className={SUAVE.campo} value={novaCor} maxLength={20} placeholder="Outra cor" onChange={(e) => setNovaCor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarCor(novaCor))} />
            <button type="button" onClick={() => adicionarCor(novaCor)} disabled={!novaCor.trim()} className={`${SUAVE.botaoSecundario} shrink-0`}>
              Adicionar
            </button>
          </div>
        </fieldset>
      </div>
    );
  }

  if (nicho === "BelezaServicos") {
    return (
      <fieldset className="grid gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <legend className={SUAVE.rotulo}>Duração (minutos)</legend>
        <div className="flex flex-wrap gap-2">
          {DURACOES.map((d) => (
            <button key={d} type="button" aria-pressed={valor.duracao === String(d)} onClick={() => set({ duracao: valor.duracao === String(d) ? "" : String(d) })} className={valor.duracao === String(d) ? SUAVE.chipAtivo : SUAVE.chip}>
              {d} min
            </button>
          ))}
        </div>
        <input aria-label="Duração em minutos" className={`${SUAVE.campo} !w-32`} inputMode="numeric" value={valor.duracao} placeholder="Outro valor" onChange={(e) => set({ duracao: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
      </fieldset>
    );
  }

  return null;
}
