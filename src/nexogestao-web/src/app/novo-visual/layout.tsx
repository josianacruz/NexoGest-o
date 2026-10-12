import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ShellSuave from "./_ux/ShellSuave";

// Pré-visualização do novo visual (menu lateral, cores suaves, Stories e agendamento rápido).
// Fica numa rota própria: as telas atuais continuam exatamente como estão até esta versão ser aprovada.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-suave", display: "swap" });

export const metadata: Metadata = { title: "NexoGestão · novo visual (pré-visualização)" };

export default function NovoVisualLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} [font-family:var(--font-suave),system-ui,sans-serif]`}>
      <ShellSuave>{children}</ShellSuave>
    </div>
  );
}
