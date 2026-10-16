import { baixarBlob } from "./pdfCardapio";

// Converte uma arte (elemento da tela) em PNG na largura exata pedida — ex.: Story 360x640 na tela vira 1080x1920.
// A conta é feita pelo "pixelRatio": largura final ÷ largura do elemento. Tudo acontece no navegador (nada vai ao servidor).

function paraDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const l = new FileReader();
    l.onload = () => ok(l.result as string);
    l.onerror = () => falha(l.error);
    l.readAsDataURL(blob);
  });
}

// A biblioteca de imagem, sozinha, copia TODAS as fontes da página para dentro da arte (em telas com muitas fontes
// isso levava dezenas de segundos). Aqui o CSS é montado uma vez só, apenas com as duas fontes das artes
// (Playfair Display e Jost) e só o subconjunto de letras do português, e fica guardado para as próximas.
let cssDasFontes: Promise<string> | null = null;

async function lerCssDasFontes(): Promise<string> {
  const pedacos: string[] = [];
  const vistos = new Set<string>();
  for (const folha of Array.from(document.styleSheets)) {
    let regras: CSSRuleList;
    try {
      regras = folha.cssRules;
    } catch {
      continue; // folha de outro endereço, sem permissão de leitura
    }
    for (const regra of Array.from(regras)) {
      if (!(regra instanceof CSSFontFaceRule)) continue;
      const familia = regra.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      if (!/playfair|jost/i.test(familia)) continue;
      const faixa = regra.style.getPropertyValue("unicode-range");
      if (faixa && !/U\+0+-0*FF/i.test(faixa)) continue; // só o subconjunto "latin" (letras do português): "U+0-FF"
      const bruta = regra.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (!bruta) continue;
      // o endereço da fonte vem relativo à folha de estilo ("../media/…"), então se resolve a partir dela
      const origem = new URL(bruta, folha.href ?? window.location.href).href;
      if (vistos.has(origem)) continue;
      vistos.add(origem);
      try {
        const res = await fetch(origem);
        const dados = await paraDataUrl(await res.blob());
        pedacos.push(
          `@font-face{font-family:'${familia}';font-style:${regra.style.getPropertyValue("font-style") || "normal"};font-weight:${regra.style.getPropertyValue("font-weight") || "400"};src:url(${dados}) format('woff2');${faixa ? `unicode-range:${faixa};` : ""}}`
        );
      } catch {
        /* sem essa fonte, a arte usa a reserva (Georgia/Arial) */
      }
    }
  }
  return pedacos.join("\n");
}

// Monta o CSS das fontes. Antes de ler, pede ao navegador que carregue as duas fontes (isso também garante que a arte
// será "fotografada" com a letra certa) e, se as regras ainda não apareceram, tenta de novo por alguns instantes.
// Resultado vazio nunca fica guardado: a próxima geração tenta outra vez.
function montarCssDasFontes(): Promise<string> {
  if (cssDasFontes) return cssDasFontes;
  const trabalho = (async () => {
    await Promise.allSettled([document.fonts.load('600 20px "Playfair Display"'), document.fonts.load('400 14px "Jost"')]);
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const css = await lerCssDasFontes();
      if (css) return css;
      await new Promise((r) => setTimeout(r, 150));
    }
    return "";
  })();
  cssDasFontes = trabalho;
  trabalho.then((css) => {
    if (!css) cssDasFontes = null;
  });
  return trabalho;
}

// Pode ser chamada quando a tela abre, para a primeira imagem sair sem espera.
export function prepararFontesDasArtes() {
  void montarCssDasFontes();
}

export async function artePng(no: HTMLElement, larguraFinal: number): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const razao = larguraFinal / no.offsetWidth;
  // Aguarda as fontes do site carregarem antes de "fotografar", senão a arte sai com a letra padrão.
  if (document.fonts?.ready) await document.fonts.ready;
  const fontEmbedCSS = await montarCssDasFontes();
  const blob = await toBlob(no, { pixelRatio: razao, ...(fontEmbedCSS ? { fontEmbedCSS } : {}), backgroundColor: "#FAF7F4" });
  if (!blob) throw new Error("Não consegui gerar a imagem. Tente de novo.");
  return blob;
}

export const baixarPng = (blob: Blob, nome: string) => baixarBlob(blob, nome.endsWith(".png") ? nome : `${nome}.png`);

// Em celulares com compartilhamento nativo, abre a lista de apps (Instagram, WhatsApp…) com a imagem pronta.
export function podeCompartilharImagem(blob: Blob, nome: string) {
  try {
    const arquivo = new File([blob], nome, { type: "image/png" });
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [arquivo] });
  } catch {
    return false;
  }
}

export async function compartilharImagem(blob: Blob, nome: string, texto?: string) {
  const arquivo = new File([blob], nome.endsWith(".png") ? nome : `${nome}.png`, { type: "image/png" });
  await navigator.share({ files: [arquivo], text: texto });
}
