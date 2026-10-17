// Molduras de "aparelho" (computador e celular) usadas na Landing Page para mostrar, de forma ilustrativa,
// como ficam as telas do sistema — sem depender de capturas de tela reais (que mudam a cada atualização).

export function MolduraComputador({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function MoldiraCelular({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-[210px] shrink-0 overflow-hidden rounded-[1.75rem] border-[6px] border-slate-900 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 ${className}`}>
      <div className="mx-auto mt-1.5 h-4 w-16 rounded-full bg-slate-900 dark:bg-slate-700" />
      <div className="p-3">{children}</div>
    </div>
  );
}

function Barra({ cor = "bg-violet-200 dark:bg-violet-300/25", largura = "w-full" }: { cor?: string; largura?: string }) {
  return <div className={`h-2.5 rounded-full ${cor} ${largura}`} />;
}

function CartaoEstatistica({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{rotulo}</p>
      <p className={`mt-1 text-base font-bold ${destaque ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-100"}`}>{valor}</p>
    </div>
  );
}

// ---------- Conteúdo ilustrativo de cada tela (nomes e números são exemplos, não dados reais) ----------

export function TelaVendas({ compacta = false }: { compacta?: boolean }) {
  const linhas = [
    { nome: "Maria Silva", item: "2x Corte + Escova", valor: "R$ 90,00" },
    { nome: "João Pedro", item: "Tênis 42", valor: "R$ 249,90" },
    { nome: "Ana Souza", item: "Combo Lanche", valor: "R$ 38,50" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <CartaoEstatistica rotulo="Vendas hoje" valor="R$ 1.248" destaque />
        <CartaoEstatistica rotulo="Ticket médio" valor="R$ 62,40" />
      </div>
      {!compacta && (
        <div className="flex flex-col gap-2">
          {linhas.map((l) => (
            <div key={l.nome} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{l.nome}</p>
                <p className="truncate text-slate-500 dark:text-slate-400">{l.item}</p>
              </div>
              <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400">{l.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TelaAgenda({ compacta = false, limite }: { compacta?: boolean; limite?: number }) {
  const todos = [
    { hora: "09:00", nome: "Maria Silva", servico: "Corte + Escova", status: "Confirmado" },
    { hora: "10:30", nome: "Carla Dias", servico: "Manicure", status: "Marcado" },
    { hora: "14:00", nome: "Pedro Lima", servico: "Barba", status: "Confirmado" },
  ];
  const compromissos = limite ? todos.slice(0, limite) : todos;

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between">
        <Barra largura="w-24" cor="bg-slate-200 dark:bg-slate-700" />
        <span className="rounded-full bg-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-900 dark:bg-violet-300/25 dark:text-violet-100">Hoje</span>
      </div>
      {compromissos.map((c) =>
        compacta ? (
          <div key={c.hora} className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">{c.hora}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.status === "Confirmado"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100"
                    : "bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100"
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">{c.nome}</p>
            <p className="truncate text-slate-500 dark:text-slate-400">{c.servico}</p>
          </div>
        ) : (
          <div key={c.hora} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <span className="w-10 shrink-0 font-bold text-slate-600 dark:text-slate-300">{c.hora}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{c.nome}</p>
              <p className="truncate text-slate-500 dark:text-slate-400">{c.servico}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                c.status === "Confirmado"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100"
                  : "bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100"
              }`}
            >
              {c.status}
            </span>
          </div>
        )
      )}
    </div>
  );
}

export function TelaRelatorios() {
  const barras = [38, 52, 44, 70, 61, 85, 58];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <CartaoEstatistica rotulo="Lucro do mês" valor="R$ 6.420" destaque />
        <CartaoEstatistica rotulo="Margem média" valor="34%" />
      </div>
      <div className="flex h-24 items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        {barras.map((altura, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-violet-300 dark:bg-violet-400/40" style={{ height: `${altura}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TelaClientes() {
  const clientes = [
    { nome: "Maria Silva", info: "12 compras · última há 3 dias", fiado: null },
    { nome: "João Pedro", info: "5 compras · última há 1 semana", fiado: "R$ 80,00" },
    { nome: "Ana Souza", info: "21 compras · última hoje", fiado: "R$ 35,00" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-300/20 dark:bg-amber-300/10">
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Total em fiado</span>
        <span className="text-sm font-bold text-amber-800 dark:text-amber-200">R$ 115,00</span>
      </div>
      <div className="flex flex-col gap-2">
        {clientes.map((c) => (
          <div key={c.nome} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-200 text-sm font-bold text-violet-900 dark:bg-violet-300/25 dark:text-violet-100">
              {c.nome.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{c.nome}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{c.info}</p>
            </div>
            {c.fiado && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-300/20 dark:text-amber-200">
                Deve {c.fiado}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelaCardapio() {
  const itens = [
    { nome: "Combo Lanche + Refri", preco: "R$ 32,90" },
    { nome: "Corte + Barba", preco: "R$ 55,00" },
    { nome: "Brinco Folheado a Ouro", preco: "R$ 24,90" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-300/20 dark:bg-emerald-300/10">
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Link pronto para enviar</span>
        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">nexo.app/cardapio</span>
      </div>
      <div className="flex flex-col gap-2">
        {itens.map((i) => (
          <div key={i.nome} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs dark:border-slate-700">
            <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{i.nome}</span>
            <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400">{i.preco}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white"
      >
        Compartilhar no WhatsApp
      </button>
    </div>
  );
}
