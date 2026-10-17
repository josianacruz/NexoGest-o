import { TAMANHO_PREVIA, buscarDadosDaPrevia, imagemTabela } from "../../_previa";

export const alt = "Tabela de serviços";
export const size = TAMANHO_PREVIA;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  return imagemTabela(await buscarDadosDaPrevia(empresaId, true));
}
