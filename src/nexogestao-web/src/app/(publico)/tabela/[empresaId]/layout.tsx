import type { Metadata } from "next";
import { buscarDadosDaPrevia, metadadosDaPrevia } from "../../_previa";

// Título e texto do cartão que aparece quando o link da tabela é enviado (a imagem vem de opengraph-image.tsx).
export async function generateMetadata({ params }: { params: Promise<{ empresaId: string }> }): Promise<Metadata> {
  const { empresaId } = await params;
  return metadadosDaPrevia(await buscarDadosDaPrevia(empresaId, true), "tabela");
}

export default function TabelaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
