// Classes do visual "minimalista chic" das páginas públicas. Mobile-first: alvos de toque de 48 a 56 px,
// texto de 16 px nos campos (o iPhone não dá zoom sozinho) e nada com largura fixa maior que a tela.
const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A2F]";

export const E = {
  titulo: "[font-family:var(--font-chic-titulo),Georgia,serif]",
  cartao: "rounded-3xl border border-[#EADFD6] bg-white shadow-[0_6px_24px_-12px_rgba(47,48,54,0.18)]",
  selo: "inline-flex items-center rounded-full bg-[#F2C9CD] px-3 py-1 text-xs font-semibold tracking-wide text-[#2F3036]",
  texto: "text-[#2F3036]",
  suave: "text-[#66666E]",
  dourado: "text-[#8A6A2F]",
  botao: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#E8B4BA] px-6 text-base font-semibold text-[#2F3036] shadow-sm transition active:scale-[0.99] hover:bg-[#E3A7AE] disabled:cursor-not-allowed disabled:opacity-50 ${foco}`,
  botaoEscuro: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#2F3036] px-6 text-base font-semibold text-[#FAF7F4] shadow-sm transition active:scale-[0.99] hover:bg-[#3b3c43] disabled:cursor-not-allowed disabled:opacity-50 ${foco}`,
  botaoContorno: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-[#C9A96E] bg-transparent px-6 text-base font-semibold text-[#2F3036] transition active:scale-[0.99] hover:bg-[#F7DDE0]/60 disabled:cursor-not-allowed disabled:opacity-50 ${foco}`,
  botaoVerde: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1F6B4A] px-6 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] hover:bg-[#195a3e] ${foco}`,
  chip: `inline-flex min-h-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#E6D9CE] bg-white px-4 text-[#2F3036] transition ${foco}`,
  chipAtivo: `inline-flex min-h-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#E8B4BA] bg-[#F2C9CD] px-4 text-[#2F3036] ring-2 ring-[#E8B4BA] transition ${foco}`,
  hora: `min-h-14 rounded-2xl border border-[#E6D9CE] bg-white text-lg font-semibold text-[#2F3036] transition active:scale-[0.98] hover:bg-[#F7DDE0]/60 ${foco}`,
  campo: `h-14 w-full rounded-2xl border border-[#DCCDBF] bg-white px-4 text-base text-[#2F3036] placeholder:text-[#8a8a92] focus:border-[#C9A96E] focus:outline-none focus:ring-4 focus:ring-[#F2C9CD]/70`,
  rotulo: "mb-1.5 block text-sm font-semibold text-[#2F3036]",
  erro: "rounded-2xl border border-[#E7B9BF] bg-[#FBE9EB] p-3 text-sm text-[#7A2631]",
  ok: "rounded-2xl border border-[#BFD9CB] bg-[#EAF5EE] p-3 text-sm text-[#1F5A3F]",
} as const;
