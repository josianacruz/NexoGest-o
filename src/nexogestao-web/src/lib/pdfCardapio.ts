import { CHIC, brl, type ServicoPublico } from "./chic";

// PDF vertical da tabela de serviços, feito no próprio navegador (nenhum custo para o servidor).
// Página estreita (105 x 187 mm, proporção de tela de celular) para ler sem dar zoom; várias páginas se a lista for grande.
// A biblioteca só é carregada quando a pessoa clica em baixar.

const L = 105;
const A = 187;
const M = 10; // margem

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export interface DadosPdf {
  nomeSalao: string;
  slogan?: string | null;
  servicos: Pick<ServicoPublico, "nome" | "duracaoMinutos" | "preco">[];
  link: string; // endereço para agendar (aparece no rodapé)
  instagram?: string | null;
  mostrarDuracao?: boolean;
}

export async function gerarPdfCardapio(d: DadosPdf): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [L, A], orientation: "portrait" });
  doc.setProperties({ title: `Tabela de serviços — ${d.nomeSalao}`, author: d.nomeSalao });

  let pagina = 1;
  const fundo = () => {
    doc.setFillColor(...rgb(CHIC.fundo));
    doc.rect(0, 0, L, A, "F");
    doc.setDrawColor(...rgb(CHIC.douradoLinha));
    doc.setLineWidth(0.25);
    doc.roundedRect(4, 4, L - 8, A - 8, 3, 3, "S");
  };

  const cabecalho = (primeira: boolean) => {
    let y = 20;
    doc.setTextColor(...rgb(CHIC.chumbo));
    doc.setFont("times", "bold");
    const nomeMaiusculo = d.nomeSalao.toUpperCase();
    const ESPACO = 0.6; // espaçamento entre letras (mm)
    const larguraUtil = L - 2 * M - 2;
    let tam = primeira ? 19 : 12;
    // Encolhe a letra até o nome caber numa linha (a medida precisa incluir o espaçamento entre as letras).
    const largura = () => {
      doc.setFontSize(tam);
      return doc.getTextWidth(nomeMaiusculo) + ESPACO * (nomeMaiusculo.length - 1);
    };
    while (largura() > larguraUtil && tam > 11) tam -= 1;
    const nomeLinhas = largura() > larguraUtil ? doc.splitTextToSize(nomeMaiusculo, larguraUtil * 0.85) : [nomeMaiusculo];
    doc.text(nomeLinhas, L / 2, y, { align: "center", charSpace: ESPACO });
    y += nomeLinhas.length * (tam > 14 ? 7.5 : 5);
    if (primeira) {
      if (d.slogan) {
        doc.setFont("times", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...rgb(CHIC.cinza));
        const sl = doc.splitTextToSize(d.slogan, L - 2 * M);
        doc.text(sl, L / 2, y, { align: "center" });
        y += sl.length * 4.2;
      }
      y += 2;
      doc.setDrawColor(...rgb(CHIC.douradoLinha));
      doc.setLineWidth(0.4);
      doc.line(L / 2 - 10, y, L / 2 + 10, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...rgb(CHIC.douradoTexto));
      doc.text("TABELA DE SERVIÇOS", L / 2, y, { align: "center", charSpace: 1.2 });
      y += 7;
    } else {
      y += 4;
    }
    return y;
  };

  const rodape = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(CHIC.cinza));
    doc.text("Agende pelo celular:", L / 2, A - 17, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(CHIC.douradoTexto));
    const link = d.link.replace(/^https?:\/\//, "");
    doc.text(doc.splitTextToSize(link, L - 2 * M), L / 2, A - 13, { align: "center" });
    if (d.instagram) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...rgb(CHIC.cinza));
      doc.text(d.instagram.startsWith("@") ? d.instagram : `@${d.instagram}`, L / 2, A - 9, { align: "center" });
    }
  };

  fundo();
  let y = cabecalho(true);
  const limite = A - 24;

  for (const s of d.servicos) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const larguraPreco = 24;
    const linhas = doc.splitTextToSize(s.nome, L - 2 * M - larguraPreco);
    const altura = linhas.length * 4.6 + (d.mostrarDuracao === false ? 0 : 4) + 3.2;
    if (y + altura > limite) {
      rodape();
      doc.addPage([L, A], "portrait");
      pagina++;
      fundo();
      y = cabecalho(false);
    }
    doc.setTextColor(...rgb(CHIC.chumbo));
    doc.text(linhas, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(CHIC.douradoTexto));
    doc.text(brl(s.preco), L - M, y, { align: "right" });
    let yy = y + (linhas.length - 1) * 4.6;
    if (d.mostrarDuracao !== false) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...rgb(CHIC.cinza));
      yy += 4;
      doc.text(`${s.duracaoMinutos} min`, M, yy);
    }
    yy += 2.6;
    doc.setDrawColor(...rgb(CHIC.quartzo));
    doc.setLineWidth(0.25);
    doc.line(M, yy, L - M, yy);
    y = yy + 4.6;
  }

  if (d.servicos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...rgb(CHIC.cinza));
    doc.text("Nenhum serviço cadastrado.", L / 2, y + 6, { align: "center" });
  }

  rodape();
  return doc.output("blob");
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
