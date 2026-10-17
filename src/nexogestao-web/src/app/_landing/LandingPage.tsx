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
  TelaStoryPromo,
  TelaAgendamentoPublico,
} from "./DeviceFrames";

const DIAS_TESTE_GRATIS = 14;

const JORNADA = [
  {
    numero: "1",
    icone: "📸",
    titulo: "Crie o Story ou a arte",
    texto: "Gere uma Story profissional, banner de promoção ou tabela de serviços/cardápio direto no sistema — sem precisar abrir o Canva.",
  },
  {
    numero: "2",
    icone: "🔗",
    titulo: "Poste o link na Bio e no Status",
    texto: "Um único link leva o cliente direto pra agenda ou pro catálogo — no Instagram, no WhatsApp, onde você já divulga hoje.",
  },
  {
    numero: "3",
    icone: "✅",
    titulo: "Cliente agenda sozinho, 24h por dia",
    texto: "Ele escolhe o serviço, o dia e o horário com o próprio dedo. Você só recebe a confirmação pronta — zero troca de mensagem.",
  },
];

const BENEFICIOS = [
  {
    icone: "🔗",
    dor: "Cansado de digitar \"tem horário disponível?\" 50 vezes por dia?",
    titulo: "Agendamento Automático 24h",
    texto: "O cliente escolhe o serviço, o dia e o horário sozinho pelo link. Você só recebe a confirmação pronta, sem trocar mensagem.",
  },
  {
    icone: "🎨",
    dor: "Sem tempo (ou jeito) pra mexer no Canva?",
    titulo: "Materiais Prontos em 1 Clique",
    texto: "Gere Stories, banners de promoção e tabela de serviços ou cardápio direto no sistema, em segundos.",
  },
  {
    icone: "💸",
    dor: "Cansado de \"esquecer\" quem ainda te deve?",
    titulo: "Controle de Fiado",
    texto: "Veja o total em aberto por cliente e cobre com um toque. É dinheiro seu voltando pro caixa — não mais um favor esquecido.",
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
];

const NICHOS = [
  {
    emoji: "💇‍♀️",
    titulo: "Salões, Barbearias e Estética",
    gancho: "Pra quem vive de agenda cheia",
    texto: "Agenda online pelo seu link: fim dos furos de horário e dos lembretes manuais. A cliente marca sozinha, você só confirma.",
  },
  {
    emoji: "🍔",
    titulo: "Lanchonetes, Marmitas e Alimentação",
    gancho: "Pra quem vive de pedido certo e entrega rápida",
    texto: "Cardápio digital pronto pra postar nos Stories, comandas organizadas e controle rápido de vendas — sem post-it, sem perder pedido.",
  },
  {
    emoji: "💎",
    titulo: "Lojas, Semijoias e Revenda",
    gancho: "Pra quem vive de giro de estoque",
    texto: "Catálogo completo no link pra divulgar nos Stories, vendas registradas em segundos, estoque e controle total de fiado.",
  },
  {
    emoji: "🧰",
    titulo: "Prestadores de Serviço e Autônomos",
    gancho: "Pra quem vive sozinho de um negócio inteiro",
    texto: "Histórico de cada cliente, cobranças organizadas e materiais prontos pra divulgar e atrair mais gente, sem depender de ninguém.",
  },
];

const DIFERENCIAIS = [
  {
    titulo: "Caderno, Planilha e WhatsApp Manual",
    ruim: true,
    itens: [
      "Você digita a mesma resposta dezenas de vezes por dia",
      "Fácil de perder, rasgar ou errar a conta",
      "Nenhum relatório, nenhum lembrete automático",
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
      "Cliente agenda e compra sozinho pelo link, 24h por dia",
      "Simples o bastante pra usar ainda hoje, sem curso",
      "Suporte humano e preço que cabe no bolso",
    ],
  },
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
    descricao: "Clientes marcam pelo link, você confirma. Fim dos horários esquecidos e dos \"furos\" na agenda.",
  },
  {
    chave: "cardapio",
    label: "Cardápio & Divulgação",
    descricao: "Gere Stories, banners e catálogo com link pronto pra postar — e venda enquanto dorme.",
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
            <a href="#jornada" className="hover:text-violet-700 dark:hover:text-violet-300">
              Como funciona
            </a>
            <a href="#demonstracao" className="hover:text-violet-700 dark:hover:text-violet-300">
              Veja por dentro
            </a>
            <a href="#nichos" className="hover:text-violet-700 dark:hover:text-violet-300">
              Pra quem é
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
              Pare de perder horas no WhatsApp. <span className="text-violet-700 dark:text-violet-300">Deixe um link vender e agendar por você</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300">
              Crie Stories e catálogos profissionais em segundos, poste o link na bio e deixe o cliente escolher o serviço, o
              dia e o horário sozinho — 24 horas por dia, sem você precisar digitar uma palavra.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/cadastro" className={`${botaoPrimario} h-12 justify-center px-6 text-base`}>
                Testar Grátis Agora
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

      {/* Do Story ao agendamento fechado */}
      <section id="jornada" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Do Story ao agendamento fechado — sem trocar uma mensagem sequer</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Pare de digitar &ldquo;oi, tem horário disponível?&rdquo; o dia inteiro. Deixe o link fazer esse trabalho por você.
            </p>
          </div>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              {JORNADA.map((j) => (
                <div key={j.numero} className="flex gap-4">
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-violet-200 text-lg font-bold text-violet-950 dark:bg-violet-300/25 dark:text-violet-50">
                      {j.numero}
                    </div>
                    {j.numero !== "3" && <div className="mt-2 h-full w-px flex-1 bg-violet-200 dark:bg-violet-300/20" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                      {j.icone} {j.titulo}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{j.texto}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <MoldiraCelular className="w-[170px] rotate-[-3deg]">
                <TelaStoryPromo />
              </MoldiraCelular>
              <span className="shrink-0 text-2xl text-slate-300 dark:text-slate-600">→</span>
              <MoldiraCelular className="w-[170px] rotate-[3deg]">
                <TelaAgendamentoPublico />
              </MoldiraCelular>
            </div>
          </div>
        </div>
      </section>

      {/* Demonstração */}
      <section id="demonstracao" className="py-16">
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
      <section id="nichos" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Feito Sob Medida Para o Seu Negócio</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Não interessa o que você vende — o NexoGestão se adapta à sua rotina, não o contrário.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {NICHOS.map((n) => (
              <div key={n.titulo} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
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
      <section id="beneficios" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Isso não é &ldquo;mais um sistema&rdquo;. É o fim da sua dor de cabeça.</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Cada recurso existe pra resolver um problema real do seu dia a dia.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
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
      <section id="diferenciais" className="border-t border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Por que trocar o caderno (e o WhatsApp manual) por isso?</h2>
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

      {/* Teste grátis */}
      <section id="teste-gratis" className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-8 text-center shadow-sm dark:border-violet-300/20 dark:bg-violet-300/10 sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight">Seu negócio merece parar de depender do seu WhatsApp o dia todo</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Toda semana sem um link de agendamento é tempo e dinheiro que você está deixando na mesa. Teste grátis por{" "}
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
              Quero Meu Link de Vendas e Agenda Grátis
            </Link>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Leva 2 minutos pra criar sua conta. Sem cartão de crédito, sem desculpa pra continuar na bagunça.
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
