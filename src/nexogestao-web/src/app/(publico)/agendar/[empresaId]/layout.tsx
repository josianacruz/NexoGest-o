import type { Metadata } from "next";
import { buscarDadosDaPrevia, metadadosDaPrevia } from "../../_previa";

// Título e texto do cartão que aparece quando o link de agendamento é enviado (a imagem vem de opengraph-image.tsx).
export async function generateMetadata({ params }: { params: Promise<{ empresaId: string }> }): Promise<Metadata> {
  const { empresaId } = await params;
  return metadadosDaPrevia(await buscarDadosDaPrevia(empresaId, false), "agendar");
}

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
