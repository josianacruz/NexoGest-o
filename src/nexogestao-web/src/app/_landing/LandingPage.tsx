"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "../_components/ThemeToggle";
import { botaoPrimario, botaoSecundario } from "../_components/ui";
import { MolduraComputador, MoldiraCelular, TelaVendas, TelaAgenda, TelaRelatorios, TelaClientes } from "./DeviceFrames";

const DIAS_TESTE_GRATIS = 14;

const RECURSOS = [
  { icone: "🛒", titulo: "Gestão de Vendas", texto: "Registre vendas em segundos, pelo computador ou pelo celular, sem precisar de caixa registradora." },
  { icone: "📦", titulo: "Controle de Estoque", texto: "Saiba exatamente o que tem disponível e receba um aviso antes de faltar produto." },
  { icone: "📊", titulo: "Relatórios de Lucro", texto: "Veja quanto o seu negócio realmente lucra, sem precisar montar planilha." },
  { icone: "👥", titulo: "Cadastro de Clientes", texto: "Histórico de compras e contato de cada cliente, sempre à mão." },
  { icone: "📅", titulo: "Agenda de Horários", texto: "Organize atendimentos e serviços automaticamente, sem confusão de horário." },
  { icone: "💰", titulo: "Cobranças", texto: "Controle o que falta receber e avise o cliente com um clique." },
];

const PASSOS = [
  { numero: "1", titulo: "Crie sua conta grátis", texto: "Leva menos de 2 minutos. Só precisamos do seu e-mail e do nome do seu negócio." },
  { numero: "2", titulo: "Configure do seu jeito", texto: "Cadastre produtos, serviços ou o que você vende. O sistema te guia passo a passo." },
  { numero: "3", titulo: "Comece a usar", texto: "Registre vendas, acompanhe o estoque e a agenda, e veja seu negócio organizado." },
];

const BENEFICIOS_TESTE = [
  "Sem necessidade de cartão de crédito",
  "Acesso completo a todos os módulos do sistema",
  "Suporte humano durante o período de teste",
  "Cancele quando quiser, sem multa ou burocracia",
];

type AbaDemo = "vendas" | "agenda" | "relatorios" | "clientes";

const ABAS_DEMO: { chave: AbaDemo; label: string }[] = [
  { chave: "vendas", label: "Vendas" },
  { chave: "agenda", label: "Agenda" },
  { chave: "relatorios", label: "Relatórios" },
  { chave: "clientes", label: "Clientes" },
];

function ConteudoDaAba({ aba }: { aba: AbaDemo }) {
  switch (aba) {
    case "vendas":
      return <TelaVendas />;
    case "agenda":
      return <TelaAgenda />;
    case "relatorios":
      return <TelaRelatorios />;
    case "clientes":
      return <TelaClientes />;
  }
}

export default function LandingPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaDemo>("vendas");

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-lg font-bold tracking-tight">NexoGestão</span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#recursos" className="hover:text-violet-700 dark:hover:text-violet-300">
              O que fazemos
            </a>
            <a href="#demonstracao" className="hover:text-violet-700 dark:hover:text-violet-300">
              Demonstração
            </a>
            <a href="#como-funciona" className="hover:text-violet-700 dark:hover:text-violet-300">
              Como funciona
            </a>
            <a href="#teste-gratis" className="hover:text-violet-700 dark:hover:text-violet-300">
              Teste grátis
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle suave />
            </div>
            <Link href="/login" className={`${botaoSecundario} h-10 px-4 text-sm`}>
              Entrar
            </Link>
            <Link href="/cadastro" className={`${botaoPrimario} h-10 px-4 text-sm`}>
              Testar Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-300/20 dark:text-violet-200">
              Feito para pequenos e médios negócios
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pare de gerenciar seu negócio no caderno <span className="text-violet-700 dark:text-violet-300">(ou na cabeça)</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300">
              Vendas, estoque, agenda e clientes organizados automaticamente, num só lugar. Sem planilha, sem curso complicado,
              sem precisar entender nada de tecnologia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/cadastro" className={`${botaoPrimario} h-12 justify-center px-6 text-base`}>
                Testar Grátis no seu Negócio
              </Link>
              <a href="#demonstracao" className={`${botaoSecundario} h-12 justify-center px-6 text-base`}>
                Ver como funciona
              </a>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Grátis por {DIAS_TESTE_GRATIS} dias · Sem necessidade de cartão de crédito
            </p>
          </div>

          <div className="relative flex justify-center pb-10 pr-6 lg:justify-end lg:pr-10">
            <MolduraComputador className="w-full max-w-md">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Painel · Vendas</p>
              <TelaVendas />
            </MolduraComputador>
            <MoldiraCelular className="absolute -bottom-2 -right-2 hidden rotate-[-4deg] sm:block">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Agenda</p>
              <TelaAgenda compacta limite={2} />
            </MoldiraCelular>
          </div>
        </div>
      </section>

      {/* O que o Nexo Gestão faz por você */}
      <section id="recursos" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">O que o Nexo Gestão faz por você</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Tudo que o seu negócio precisa para vender mais e perder menos tempo com organização.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                <span className="text-3xl">{r.icone}</span>
                <h3 className="mt-3 text-lg font-semibold">{r.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demonstração */}
      <section id="demonstracao" className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Veja o sistema por dentro</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Uma prévia de como fica cada tela — simples, direta e pensada para o dia a dia do seu negócio.</p>
          </div>

          <div role="tablist" aria-label="Telas do sistema" className="mt-8 flex flex-wrap justify-center gap-2">
            {ABAS_DEMO.map((aba) => (
              <button
                key={aba.chave}
                type="button"
                role="tab"
                aria-selected={abaAtiva === aba.chave}
                onClick={() => setAbaAtiva(aba.chave)}
                className={`h-11 rounded-full px-5 text-sm font-semibold transition cursor-pointer ${
                  abaAtiva === aba.chave
                    ? "bg-violet-200 text-violet-950 dark:bg-violet-300/25 dark:text-violet-50"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          <MolduraComputador className="mx-auto mt-8 max-w-2xl">
            <ConteudoDaAba aba={abaAtiva} />
          </MolduraComputador>
        </div>
      </section>

      {/* Passo a passo simples */}
      <section id="como-funciona" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Comece em 3 passos simples</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Sem complicação: do cadastro ao primeiro uso em poucos minutos.</p>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.numero} className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-200 text-lg font-bold text-violet-950 dark:bg-violet-300/25 dark:text-violet-50">
                  {p.numero}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teste grátis */}
      <section id="teste-gratis" className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-8 text-center shadow-sm dark:border-violet-300/20 dark:bg-violet-300/10 sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight">Teste grátis por {DIAS_TESTE_GRATIS} dias</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Experimente o sistema completo no seu negócio, sem compromisso.</p>
            <ul className="mx-auto mt-6 grid max-w-md gap-2.5 text-left text-sm">
              {BENEFICIOS_TESTE.map((b) => (
                <li key={b} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                  <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <Link href="/cadastro" className={`${botaoPrimario} mt-8 h-12 w-full justify-center px-6 text-base sm:w-auto`}>
              Começar meu teste grátis
            </Link>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-slate-200 py-10 dark:border-slate-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <span className="text-base font-bold tracking-tight">NexoGestão</span>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestão simples para o seu negócio.</p>
          <div className="flex gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link href="/login" className="hover:text-violet-700 dark:hover:text-violet-300">
              Entrar
            </Link>
            <Link href="/cadastro" className="hover:text-violet-700 dark:hover:text-violet-300">
              Testar grátis
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">© {new Date().getFullYear()} NexoGestão. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
