"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "../_components/ThemeToggle";
import { botaoPrimario, botaoSecundario } from "../_components/ui";
import {
  MolduraComputador,
  MoldiraCelular,
  TelaVendas,
  TelaAgenda,
  TelaRelatorios,
  TelaClientes,
  TelaCardapio,
} from "./DeviceFrames";

const DIAS_TESTE_GRATIS = 14;

const BENEFICIOS = [
  {
    icone: "💸",
    dor: "Cansado de \"esquecer\" quem ainda te deve?",
    titulo: "Controle de Fiado",
    texto: "Veja o total em aberto por cliente e cobre com um toque. É dinheiro seu voltando pro caixa — não mais um favor esquecido.",
  },
  {
    icone: "📲",
    dor: "Perdendo venda por falta de divulgação?",
    titulo: "Divulgação & WhatsApp",
    texto: "Catálogo, link e texto prontos pra mandar no Status e nos grupos. Sem saber nada de design, sem perder cliente por sumir do feed.",
  },
  {
    icone: "📊",
    dor: "Cansado de planilha que nunca fecha?",
    titulo: "Gestão em Tempo Real",
    texto: "Vendas, estoque e lucro atualizados na hora, do celular. Sem fórmula quebrada, sem erro de digitação, sem versão desatualizada.",
  },
  {
    icone: "🛒",
    dor: "Perdendo tempo com caixa complicado?",
    titulo: "Vendas em Segundos",
    texto: "Registre qualquer venda em poucos toques, no computador ou no celular — sem precisar de caixa registradora.",
  },
  {
    icone: "📦",
    dor: "Já prometeu um produto que não tinha mais?",
    titulo: "Estoque Sob Controle",
    texto: "Alerta automático antes de faltar produto. Você sabe exatamente o que tem disponível, sempre.",
  },
  {
    icone: "📅",
    dor: "Cliente esqueceu o horário de novo?",
    titulo: "Agenda Sem Furo",
    texto: "Confirmação e lembrete automáticos. Menos ausência, menos prejuízo, mais atendimento no seu dia.",
  },
];

const NICHOS = [
  {
    emoji: "💇‍♀️",
    titulo: "Salões, Barbearias e Estética",
    gancho: "Pra quem vive de agenda cheia",
    texto:
      "Chega de cliente que marca e não aparece, ou de agenda feita no caderninho. Confirme horários automaticamente, controle comissão e descubra qual serviço mais vende.",
  },
  {
    emoji: "🍔",
    titulo: "Lanchonetes, Marmitas e Alimentação",
    gancho: "Pra quem vive de pedido certo e entrega rápida",
    texto:
      "Monte seu cardápio digital, mande no grupo do WhatsApp e já receba o pedido organizado. Sem anotar em post-it, sem perder encomenda no fim de semana.",
  },
  {
    emoji: "💎",
    titulo: "Lojas, Semijoias e Revenda",
    gancho: "Pra quem vive de giro de estoque",
    texto:
      "Saiba o que vendeu, o que sobrou e o que já era pra ter repetido. Catálogo pronto pra divulgar nos Stories em poucos cliques.",
  },
  {
    emoji: "🧰",
    titulo: "Prestadores de Serviço e Autônomos",
    gancho: "Pra quem vive sozinho de um negócio inteiro",
    texto:
      "Orçamento, agenda, cobrança e histórico de cliente, tudo num só lugar — sem precisar mais anotar serviço no bloco de notas do celular.",
  },
];

const DIFERENCIAIS = [
  {
    titulo: "Caderno e Planilha",
    ruim: true,
    itens: [
      "Fácil de perder, rasgar ou errar a conta",
      "Nenhum relatório, nenhum lembrete automático",
      "Ninguém mais além de você entende a bagunça",
    ],
  },
  {
    titulo: "Sistemas Caros e Complexos",
    ruim: true,
    itens: [
      "Exigem curso só pra aprender a usar",
      "Mensalidade salgada por recursos que você nunca vai usar",
      "Suporte travado, sem ninguém pra te ajudar de verdade",
    ],
  },
  {
    titulo: "NexoGestão",
    ruim: false,
    itens: [
      "Simples o bastante pra usar ainda hoje, sem curso",
      "Só o que o seu negócio pequeno realmente precisa",
      "Suporte humano e preço que cabe no bolso",
    ],
  },
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

type AbaDemo = "vendas" | "agenda" | "cardapio" | "clientes" | "relatorios";

const ABAS_DEMO: { chave: AbaDemo; label: string; descricao: string }[] = [
  {
    chave: "vendas",
    label: "Vendas",
    descricao: "Registre cada venda em segundos e veja o lucro do dia na hora — sem abrir planilha nenhuma.",
  },
  {
    chave: "agenda",
    label: "Agenda",
    descricao: "Clientes marcam, você confirma. Fim dos horários esquecidos e dos \"furos\" na agenda.",
  },
  {
    chave: "cardapio",
    label: "Cardápio/Divulgação",
    descricao: "Gere um catálogo com link pronto pra mandar no Status do WhatsApp — e venda enquanto dorme.",
  },
  {
    chave: "clientes",
    label: "Clientes & Fiado",
    descricao: "Saiba exatamente quem te deve, quanto deve, e cobre com um clique. Nunca mais \"esqueça\" um fiado.",
  },
  {
    chave: "relatorios",
    label: "Relatórios",
    descricao: "Descubra se o seu negócio está dando lucro de verdade — em números, não em achismo.",
  },
];

function ConteudoDaAba({ aba }: { aba: AbaDemo }) {
  switch (aba) {
    case "vendas":
      return <TelaVendas />;
    case "agenda":
      return <TelaAgenda />;
    case "cardapio":
      return <TelaCardapio />;
    case "clientes":
      return <TelaClientes />;
    case "relatorios":
      return <TelaRelatorios />;
  }
}

export default function LandingPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaDemo>("vendas");
  const descricaoAtiva = ABAS_DEMO.find((a) => a.chave === abaAtiva)?.descricao;

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-lg font-bold tracking-tight">NexoGestão</span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#demonstracao" className="hover:text-violet-700 dark:hover:text-violet-300">
              Veja por dentro
            </a>
            <a href="#nichos" className="hover:text-violet-700 dark:hover:text-violet-300">
              Pra quem é
            </a>
            <a href="#beneficios" className="hover:text-violet-700 dark:hover:text-violet-300">
              Benefícios
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
              Feito para quem toca o negócio sozinho (ou quase)
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pare de perder dinheiro com caderno, planilha e <span className="text-violet-700 dark:text-violet-300">5 apps diferentes</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300">
              O NexoGestão junta vendas, estoque, agenda, fiado e divulgação num só lugar. Simples o bastante pra usar
              ainda hoje — sem curso, sem planilha quebrada e sem precisar entender nada de tecnologia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/cadastro" className={`${botaoPrimario} h-12 justify-center px-6 text-base`}>
                Testar Grátis no Meu Negócio
              </Link>
              <a href="#demonstracao" className={`${botaoSecundario} h-12 justify-center px-6 text-base`}>
                Ver o sistema por dentro
              </a>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Grátis por {DIAS_TESTE_GRATIS} dias · Sem necessidade de cartão de crédito · Cancele quando quiser
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

      {/* Demonstração */}
      <section id="demonstracao" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Veja o sistema por dentro antes de criar sua conta</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Clique em cada aba abaixo e descubra exatamente como vai ficar o dia a dia do seu negócio.
            </p>
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

          <p className="mx-auto mt-6 max-w-xl text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            {descricaoAtiva}
          </p>

          <MolduraComputador className="mx-auto mt-6 max-w-2xl">
            <ConteudoDaAba aba={abaAtiva} />
          </MolduraComputador>
        </div>
      </section>

      {/* Nichos */}
      <section id="nichos" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Feito Sob Medida Para o Seu Negócio</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Não interessa o que você vende — o NexoGestão se adapta à sua rotina, não o contrário.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {NICHOS.map((n) => (
              <div key={n.titulo} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                <span className="text-3xl">{n.emoji}</span>
                <h3 className="mt-3 text-lg font-semibold">{n.titulo}</h3>
                <p className="mt-1 text-sm font-semibold text-violet-700 dark:text-violet-300">{n.gancho}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{n.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios reais */}
      <section id="beneficios" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Isso não é &ldquo;mais um sistema&rdquo;. É o fim da sua dor de cabeça.</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Cada recurso existe pra resolver um problema real do seu dia a dia.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                <span className="text-3xl">{b.icone}</span>
                <p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">{b.dor}</p>
                <h3 className="mt-1 text-lg font-semibold">{b.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{b.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Por que trocar o caderno por isso?</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Compare e veja por que o NexoGestão é a escolha óbvia.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {DIFERENCIAIS.map((d) => (
              <div
                key={d.titulo}
                className={`rounded-2xl border p-6 ${
                  d.ruim
                    ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    : "border-violet-300 bg-violet-50 shadow-sm dark:border-violet-300/30 dark:bg-violet-300/10"
                }`}
              >
                <h3 className={`text-lg font-semibold ${d.ruim ? "text-slate-700 dark:text-slate-200" : "text-violet-800 dark:text-violet-200"}`}>
                  {d.titulo}
                </h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                  {d.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                      <span className={d.ruim ? "mt-0.5 text-rose-500 dark:text-rose-400" : "mt-0.5 text-emerald-600 dark:text-emerald-400"}>
                        {d.ruim ? "✕" : "✓"}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
            <h2 className="text-3xl font-bold tracking-tight">Seu negócio merece sair da bagunça hoje</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Toda semana sem controle é dinheiro que você não sabe se está ganhando ou perdendo. Teste grátis por{" "}
              {DIAS_TESTE_GRATIS} dias, sem compromisso.
            </p>
            <ul className="mx-auto mt-6 grid max-w-md gap-2.5 text-left text-sm">
              {BENEFICIOS_TESTE.map((b) => (
                <li key={b} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                  <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <Link href="/cadastro" className={`${botaoPrimario} mt-8 h-12 w-full justify-center px-6 text-base sm:w-auto`}>
              Quero Organizar Meu Negócio Agora
            </Link>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Leva 2 minutos pra criar sua conta. Depois disso, não tem mais desculpa pra continuar na bagunça.
            </p>
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
