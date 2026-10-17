import type { Metadata } from "next";
import { E } from "../_estilo";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como os seus dados são usados quando você agenda um horário.",
};

// Texto simples e direto para quem agenda pelo celular (Lei Geral de Proteção de Dados – LGPD).
export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-8">
      <h1 className={`${E.titulo} text-2xl font-semibold`}>Política de privacidade</h1>
      <p className={`mt-1 text-sm ${E.suave}`}>Em linguagem simples: o que acontece com os seus dados quando você agenda.</p>

      <div className={`${E.cartao} mt-6 grid gap-5 p-5 text-[15px] leading-relaxed`}>
        <section>
          <h2 className={`${E.titulo} text-lg font-semibold`}>O que pedimos</h2>
          <p>Seu <strong>nome</strong> e seu <strong>número de WhatsApp</strong>, mais o serviço, o dia e o horário que você escolheu.</p>
        </section>
        <section>
          <h2 className={`${E.titulo} text-lg font-semibold`}>Para que usamos</h2>
          <p>Só para o seu agendamento: confirmar, lembrar do horário e falar com você sobre ele pelo WhatsApp. Não vendemos nem repassamos os seus dados a terceiros.</p>
        </section>
        <section>
          <h2 className={`${E.titulo} text-lg font-semibold`}>Quem cuida dos dados</h2>
          <p>O salão ou a loja em que você agendou é quem decide como usar os dados e fala com você. O sistema NexoGestão apenas guarda as informações para o estabelecimento, com acesso protegido por senha.</p>
        </section>
        <section>
          <h2 className={`${E.titulo} text-lg font-semibold`}>Por quanto tempo</h2>
          <p>Enquanto você for cliente do estabelecimento ou até você pedir para apagar.</p>
        </section>
        <section>
          <h2 className={`${E.titulo} text-lg font-semibold`}>Os seus direitos</h2>
          <p>Você pode pedir ao estabelecimento, a qualquer momento, para <strong>ver</strong>, <strong>corrigir</strong> ou <strong>apagar</strong> os seus dados, e para parar de receber mensagens. É só responder no WhatsApp do salão.</p>
        </section>
      </div>

      <p className={`mt-6 text-center text-sm ${E.suave}`}>Pode fechar esta página para voltar ao agendamento.</p>
    </main>
  );
}
