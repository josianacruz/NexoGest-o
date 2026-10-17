import { TAMANHO_PREVIA, buscarDadosDaPrevia, imagemAgendar } from "../../_previa";

export const alt = "Agende seu horário";
export const size = TAMANHO_PREVIA;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  return imagemAgendar(await buscarDadosDaPrevia(empresaId, false));
}
