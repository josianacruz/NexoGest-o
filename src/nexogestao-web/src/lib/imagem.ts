// Redução de foto no navegador antes de enviar: a biblioteca aceita até 400 KB por foto,
// então a imagem é redimensionada (lado maior 1080 px) e regravada em JPEG, baixando a qualidade se precisar.

export const MAX_BYTES_FOTO = 380 * 1024; // um pouco abaixo do limite da API (400 KB)
const LADO_MAXIMO = 1080;
const LADO_MINIATURA = 160;

export interface FotoReduzida {
  nome: string;
  dadosBase64: string; // só o base64, sem "data:..."
  dataUrl: string; // foto inteira (para usar direto num campo de imagem)
  miniatura: string; // data URL pequena para a lista
}

async function abrirImagem(arquivo: File): Promise<{ fonte: CanvasImageSource; largura: number; altura: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height };
    } catch {
      /* cai para o método com <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, falha) => {
      img.onload = () => ok();
      img.onerror = () => falha(new Error("Não consegui abrir esta foto."));
      img.src = url;
    });
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function desenhar(fonte: CanvasImageSource, largura: number, altura: number, ladoMaximo: number) {
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura));
  const w = Math.max(1, Math.round(largura * escala));
  const h = Math.max(1, Math.round(altura * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
  ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira fundo branco no JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(fonte, 0, 0, w, h);
  return canvas;
}

export async function reduzirImagem(arquivo: File): Promise<FotoReduzida> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha uma foto (JPG, PNG ou WebP).");
  const { fonte, largura, altura } = await abrirImagem(arquivo);

  let lado = LADO_MAXIMO;
  let qualidade = 0.82;
  let dataUrl = "";
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    dataUrl = desenhar(fonte, largura, altura, lado).toDataURL("image/jpeg", qualidade);
    const bytes = Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
    if (bytes <= MAX_BYTES_FOTO) break;
    qualidade = Math.max(0.5, qualidade - 0.1);
    if (qualidade <= 0.55) lado = Math.round(lado * 0.8);
  }
  const bytesFinais = Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  if (bytesFinais > MAX_BYTES_FOTO) throw new Error("A foto é muito pesada. Tente outra.");

  const miniatura = desenhar(fonte, largura, altura, LADO_MINIATURA).toDataURL("image/jpeg", 0.6);
  const nome = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60);
  return { nome, dadosBase64: dataUrl.slice(dataUrl.indexOf(",") + 1), dataUrl, miniatura };
}

// Foto inteira da biblioteca como data URL (para guardar no produto).
export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result as string);
    leitor.onerror = () => falha(new Error("Não consegui ler a foto."));
    leitor.readAsDataURL(blob);
  });
}
