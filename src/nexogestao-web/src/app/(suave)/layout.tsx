import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ShellSuave from "../_suave/ShellSuave";

// Layout das telas já migradas para o visual suave (menu lateral, cores pastel, modo escuro confortável).
// "(suave)" é só um grupo de rotas: não aparece no endereço. Para migrar outra tela, mova a pasta dela para cá.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-suave", display: "swap" });

export const metadata: Metadata = { title: "NexoGestão" };

export default function SuaveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} [font-family:var(--font-suave),system-ui,sans-serif]`}>
      <ShellSuave>{children}</ShellSuave>
    </div>
  );
}
