"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../../lib/api";
import WorkerPanel from "./WorkerPanel";
import RadarPanel from "./RadarPanel";
import { escolherEmpresa } from "../../../lib/empresaAtiva";

interface Conteudo {
  id: number;
  abordagem: string;
  roteiro: string;
  legenda: string;
  chamadaParaCompra: string;
  hashtags: string;
  status: string;
  dataGeracao: string;
}

interface ProdutoAfiliado {
  id: number;
  linkOriginal: string;
  linkAfiliado: string | null;
  nome: string;
  categoria: string | null;
  imagemUrl: string | null;
  preco: number | null;
  nomeLoja: string | null;
  vendas: number | null;
  comissaoPercentual: number | null;
  comissaoValor: number | null;
  comissaoVendedorPercentual: number | null;
  comissaoShopeePercentual: number | null;
  inicioOferta: string | null;
  fimOferta: string | null;
  avaliacao: number | null;
  ultimaConsultaApi: string | null;
  origemDados: string | null;
  dataImportacao: string | null;
  origem: string;
  ativo: boolean;
  dataCadastro: string;
  dataUltimaAtualizacao: string;
  pendenciasDados: string[];
  conteudo: Conteudo | null;
}

interface Configuracao {
  idAfiliado: string | null;
  appIdConfigurado: boolean;
  appSecretConfigurado: boolean;
  apiOficialHabilitada: boolean;
}

interface ResultadoBusca {
  palavraChave: string;
  prioridadeSolicitada: string;
  prioridadeAplicada: string;
  buscados: number;
  importados: number;
  duplicadosIgnorados: number;
  limitacoes: string[];
  produtos: ProdutoAfiliado[];
}

interface ResultadoRelatorio {
  criados: number;
  atualizados: number;
  duplicadosNoArquivo: number;
  linksDeOfertaDiferentes: number;
  erros: string[];
}

interface Video {
  id: number;
  produtoAfiliadoId: number;
  produto: {
    nome: string;
    imagemUrl: string | null;
    linkOriginal: string;
    linkAfiliado: string | null;
    preco: number | null;
    vendas: number | null;
    nomeLoja: string | null;
    comissaoPercentual: number | null;
    comissaoValor: number | null;
    origemDados: string | null;
    dataImportacao: string | null;
  };
  status: "Pendente" | "Processando" | "Pronto" | "Erro" | "SemMateriais";
  mensagem: string | null;
  modo: string;
  categoriaDetectada: string | null;
  observacaoRevisao: string | null;
  versaoRoteiro: string | null;
  legenda: string | null;
  hashtags: string | null;
  musicaCredito: string | null;
  materiaisLidosEm: string | null;
  duracaoSegundos: number | null;
  tamanhoBytes: number | null;
  tempoProcessamentoSegundos: number | null;
  temArquivo: boolean;
  arquivoLocal: string | null;
  arquivoNaApi: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

const MAX_VIDEOS_POR_VEZ = 20;

const filtrosVazios = {
  q: "",
  precoMin: "",
  precoMax: "",
  vendasMin: "",
  vendasMax: "",
  comissaoPercMin: "",
  comissaoValorMin: "",
  ordenar: "",
  direcao: "desc",
};

const formBusca = {
  nicho: "",
  palavraChave: "",
  precoMin: "",
  precoMax: "",
  quantidadeMaxima: "10",
  prioridade: "Relevancia",
};

const formVazio = { linkOriginal: "", linkAfiliado: "", nome: "", categoria: "", imagemUrl: "", preco: "" };

const nomeCategoria: Record<string, string> = {
  Roupa: "Roupa",
  Acessorio: "Acessório",
  Casa: "Casa",
  Autopeca: "Autopeça",
  Outros: "Outras categorias",
};

const statusVideo: Record<Video["status"], { texto: string; classe: string }> = {
  Pendente: { texto: "Na fila", classe: "bg-amber-500/10 text-amber-600" },
  Processando: { texto: "Gerando…", classe: "bg-indigo-500/10 text-indigo-600" },
  Pronto: { texto: "Pronto", classe: "bg-green-500/10 text-green-600" },
  Erro: { texto: "Erro", classe: "bg-red-500/10 text-red-600" },
  SemMateriais: { texto: "Sem fotos suficientes", classe: "bg-red-500/10 text-red-600" },
};

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

function copiar(texto: string, aviso: (msg: string) => void) {
  navigator.clipboard?.writeText(texto).then(() => aviso("Copiado."));
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentual = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const dataBr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
const tamanhoMb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

export default function AfiliadosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<ProdutoAfiliado[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [preparandoId, setPreparandoId] = useState<number | null>(null);
  const [editandoLinkId, setEditandoLinkId] = useState<number | null>(null);
  const [linkAfiliadoForm, setLinkAfiliadoForm] = useState("");
  const [textoAbertoId, setTextoAbertoId] = useState<number | null>(null);

  const [idAfiliadoForm, setIdAfiliadoForm] = useState("");
  const [appIdForm, setAppIdForm] = useState("");
  const [appSecretForm, setAppSecretForm] = useState("");
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [buscaForm, setBuscaForm] = useState(formBusca);
  const [buscando, setBuscando] = useState(false);
  const [resultadoBusca, setResultadoBusca] = useState<ResultadoBusca | null>(null);

  const [linksLote, setLinksLote] = useState("");
  const [csvArquivo, setCsvArquivo] = useState<File | null>(null);
  const [csvChave, setCsvChave] = useState(0); // troca a chave para limpar o campo de arquivo
  const [resultadoRelatorio, setResultadoRelatorio] = useState<ResultadoRelatorio | null>(null);
  const [form, setForm] = useState(formVazio);
  const [mostrarOutrasFormas, setMostrarOutrasFormas] = useState(false);
  const [mostrarFormManual, setMostrarFormManual] = useState(false);

  const [filtros, setFiltros] = useState(filtrosVazios);
  const filtrosAplicados = useRef(filtrosVazios);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [observacoes, setObservacoes] = useState<Record<number, string>>({});
  const [quantidadeSelecionar, setQuantidadeSelecionar] = useState("5");
  const [gerando, setGerando] = useState(false);
  const [avisoWorker, setAvisoWorker] = useState<string | null>(null);
  const [variacoes, setVariacoes] = useState<Record<number, { variacaoVendas: number | null; de: string }>>({});

  const [previas, setPrevias] = useState<Record<number, string>>({});
  const [carregandoArquivoId, setCarregandoArquivoId] = useState<number | null>(null);

  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  function mostrarAviso(msg: string) {
    setAviso(msg);
  }

  function montarQuery(f: typeof filtrosVazios) {
    const p = new URLSearchParams();
    (Object.keys(f) as (keyof typeof f)[]).forEach((k) => {
      const v = f[k].trim();
      if (!v || (k === "direcao" && !f.ordenar)) return;
      // Números aceitam vírgula ("8,5"); o texto da busca não é alterado.
      p.set(k, k === "q" || k === "ordenar" || k === "direcao" ? v : v.replace(",", "."));
    });
    const s = p.toString();
    return s ? `?${s}` : "";
  }

  async function carregarProdutos(id: number, token: string) {
    const res = await fetch(
      `${API_URL}/api/empresas/${id}/afiliados/produtos${montarQuery(filtrosAplicados.current)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) setProdutos(await res.json());
    // Variação de vendas observada entre as consultas diárias (vazio enquanto não há consultas pela API).
    fetch(`${API_URL}/api/empresas/${id}/afiliados/radar/variacoes?dias=7`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { produtoId: number; variacaoVendas: number | null; de: string }[]) =>
        setVariacoes(Object.fromEntries(lista.map((x) => [x.produtoId, { variacaoVendas: x.variacaoVendas, de: x.de }]))))
      .catch(() => undefined);
    return res;
  }

  async function carregarVideos(id: number, token: string) {
    const res = await fetch(`${API_URL}/api/empresas/${id}/afiliados/videos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setVideos(await res.json());
    return res;
  }

  async function carregarTudo() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const resEmpresas = await fetch(`${API_URL}/api/empresas/minhas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmpresas.status === 401) {
        router.push("/login");
        return;
      }
      const empresas = await resEmpresas.json();
      if (empresas.length === 0) {
        setErro("Você ainda não tem nenhuma empresa cadastrada.");
        return;
      }
      const primeiraEmpresa = escolherEmpresa(empresas);
      setEmpresaId(primeiraEmpresa.id);
      setEmpresaNome(primeiraEmpresa.nome);

      const [resProdutos, resConfig, resVideos] = await Promise.all([
        carregarProdutos(primeiraEmpresa.id, token),
        fetch(`${API_URL}/api/empresas/${primeiraEmpresa.id}/afiliados/configuracao`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        carregarVideos(primeiraEmpresa.id, token),
      ]);

      if (moduloIndisponivel(resProdutos, resConfig, resVideos)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }

      const configData = await resConfig.json();
      setConfig(configData);
      setIdAfiliadoForm(configData.idAfiliado ?? "");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  // Enquanto houver vídeo na fila ou sendo gerado, confere a cada poucos segundos.
  const haVideoEmAndamento = videos.some((v) => v.status === "Pendente" || v.status === "Processando");
  // O aviso de "worker desconectado" só vale enquanto há vídeo esperando.
  useEffect(() => {
    if (!haVideoEmAndamento) setAvisoWorker(null);
  }, [haVideoEmAndamento]);
  useEffect(() => {
    if (!haVideoEmAndamento || !empresaId) return;
    const timer = setInterval(() => {
      const token = getToken();
      if (token) carregarVideos(empresaId, token);
    }, 4000);
    return () => clearInterval(timer);
  }, [haVideoEmAndamento, empresaId]);

  // Libera as prévias de vídeo da memória ao sair da página.
  const previasRef = useRef(previas);
  previasRef.current = previas;
  useEffect(() => {
    return () => Object.values(previasRef.current).forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function aplicarFiltros(e?: React.FormEvent) {
    e?.preventDefault();
    const token = getToken();
    if (!token || !empresaId) return;
    filtrosAplicados.current = filtros;
    setErro(null);
    await carregarProdutos(empresaId, token);
  }

  async function limparFiltros() {
    setFiltros(filtrosVazios);
    filtrosAplicados.current = filtrosVazios;
    const token = getToken();
    if (!token || !empresaId) return;
    await carregarProdutos(empresaId, token);
  }

  async function salvarConfiguracao(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || salvando) return;
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/configuracao`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          idAfiliado: idAfiliadoForm,
          appId: appIdForm.length > 0 ? appIdForm : null,
          appSecret: appSecretForm.length > 0 ? appSecretForm : null,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar a configuração."));
        return;
      }
      setConfig(await res.json());
      setAppIdForm("");
      setAppSecretForm("");
      mostrarAviso("Configuração salva.");
    } finally {
      setSalvando(false);
    }
  }

  async function importarRelatorio(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || salvando || !csvArquivo) return;
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    setErro(null);
    setResultadoRelatorio(null);
    try {
      const conteudoCsv = await csvArquivo.text();
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/importar-relatorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conteudoCsv, nomeArquivo: csvArquivo.name }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível importar o arquivo."));
        return;
      }
      setResultadoRelatorio(await res.json());
      setCsvArquivo(null);
      setCsvChave((k) => k + 1);
      await carregarProdutos(empresaId, token);
    } finally {
      setSalvando(false);
    }
  }

  async function buscarProdutos(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || buscando) return;
    const token = getToken();
    if (!token) return;

    if (!buscaForm.palavraChave.trim()) {
      setErro("Informe uma palavra-chave pra buscar.");
      return;
    }

    setBuscando(true);
    setErro(null);
    setResultadoBusca(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/buscar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          palavraChave: buscaForm.palavraChave,
          nicho: buscaForm.nicho || null,
          precoMin: buscaForm.precoMin ? Number(buscaForm.precoMin) : null,
          precoMax: buscaForm.precoMax ? Number(buscaForm.precoMax) : null,
          quantidadeMaxima: Number(buscaForm.quantidadeMaxima) || 10,
          prioridade: buscaForm.prioridade,
          gerarVideosAutomaticamente: false,
          limiteVideosAutomaticos: 0,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível buscar produtos."));
        return;
      }
      setResultadoBusca(await res.json());
      await carregarProdutos(empresaId, token);
    } finally {
      setBuscando(false);
    }
  }

  async function cadastrarLote(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || salvando) return;
    const token = getToken();
    if (!token) return;

    const links = linksLote
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (links.length === 0) {
      setErro("Cole ao menos um link da Shopee.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/lote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ links }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível buscar os links."));
        return;
      }
      const resultado = await res.json();
      setLinksLote("");
      mostrarAviso(
        `${resultado.criados} produto(s) adicionado(s) — ${resultado.comDadosAutomaticos} com nome/foto/categoria encontrados automaticamente` +
          (resultado.semDadosAutomaticos > 0 ? `, ${resultado.semDadosAutomaticos} ficaram pendentes (não deu pra buscar os dados)` : "") +
          (resultado.comLinkDeAfiliada > 0 ? ` ${resultado.comLinkDeAfiliada} já com o seu link de afiliada.` : "") +
          (resultado.atualizados > 0 ? ` ${resultado.atualizados} existente(s) ganhou(aram) o link de afiliada.` : "") +
          ` ${resultado.duplicados} já existiam (mesmo produto, mesmo que o link venha em outro formato).` +
          (resultado.invalidos.length > 0 ? ` ${resultado.invalidos.length} link(s) fora do domínio da Shopee foram ignorados.` : "")
      );
      await carregarProdutos(empresaId, token);
    } finally {
      setSalvando(false);
    }
  }

  async function prepararConteudo(produtoId: number) {
    const token = getToken();
    if (!token || !empresaId) return;
    setPreparandoId(produtoId);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/${produtoId}/preparar-conteudo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível preparar o conteúdo."));
        return;
      }
      await carregarProdutos(empresaId, token);
      setTextoAbertoId(produtoId);
    } finally {
      setPreparandoId(null);
    }
  }

  function abrirEdicaoLink(p: ProdutoAfiliado) {
    setEditandoLinkId(p.id);
    setLinkAfiliadoForm(p.linkAfiliado ?? "");
  }

  async function salvarLinkAfiliado(p: ProdutoAfiliado) {
    const token = getToken();
    if (!token || !empresaId) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          linkAfiliado: linkAfiliadoForm || null,
          nome: p.nome,
          categoria: p.categoria,
          imagemUrl: p.imagemUrl,
          preco: p.preco,
          ativo: p.ativo,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível salvar o link de afiliada."));
        return;
      }
      setEditandoLinkId(null);
      await carregarProdutos(empresaId, token);
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarManual(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || salvando) return;
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          linkOriginal: form.linkOriginal,
          linkAfiliado: form.linkAfiliado || null,
          nome: form.nome,
          categoria: form.categoria || null,
          imagemUrl: form.imagemUrl || null,
          preco: form.preco ? Number(form.preco) : null,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível cadastrar o produto."));
        return;
      }
      setForm(formVazio);
      setMostrarFormManual(false);
      mostrarAviso("Produto cadastrado.");
      await carregarProdutos(empresaId, token);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    if (!empresaId) return;
    const token = getToken();
    if (!token) return;
    if (!confirm("Remover este produto de afiliada?")) return;

    const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSelecionados((s) => s.filter((x) => x !== id));
      await carregarProdutos(empresaId, token);
    }
  }

  // --- Seleção e geração de vídeos ---

  // Produto que já tem vídeo pronto ou na fila não entra de novo (a API também recusa).
  const produtosComVideoAtivo = new Set(
    videos.filter((v) => v.status === "Pendente" || v.status === "Processando" || v.status === "Pronto").map((v) => v.produtoAfiliadoId)
  );
  const elegiveis = produtos.filter((p) => p.ativo && !produtosComVideoAtivo.has(p.id));

  function alternarSelecao(id: number) {
    setSelecionados((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_VIDEOS_POR_VEZ) {
        setErro(`Selecione no máximo ${MAX_VIDEOS_POR_VEZ} produtos por vez.`);
        return s;
      }
      return [...s, id];
    });
  }

  function selecionarPrimeiros() {
    const n = Math.max(1, Math.min(MAX_VIDEOS_POR_VEZ, Number(quantidadeSelecionar) || 1));
    setSelecionados(elegiveis.slice(0, n).map((p) => p.id));
  }

  async function gerarVideos() {
    const token = getToken();
    if (!token || !empresaId || gerando) return;
    const ids = selecionados.filter((id) => !produtosComVideoAtivo.has(id));
    if (ids.length === 0) {
      setErro("Selecione ao menos um produto sem vídeo na fila.");
      return;
    }

    const obs: Record<number, string> = {};
    ids.forEach((id) => {
      const t = observacoes[id]?.trim();
      if (t) obs[id] = t;
    });

    setGerando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/videos/gerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ produtoIds: ids, observacoesRevisao: obs }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível colocar os vídeos na fila."));
        return;
      }
      const r = await res.json();
      setAvisoWorker(r.aviso ?? null);
      mostrarAviso(
        `${r.criadas} vídeo(s) na fila.` +
          (r.ignorados.length > 0 ? ` ${r.ignorados.length} ignorado(s): ${r.ignorados.map((i: { motivo: string }) => i.motivo).join(" ")}` : "")
      );
      setSelecionados([]);
      await carregarVideos(empresaId, token);
    } finally {
      setGerando(false);
    }
  }

  async function tentarDeNovo(videoId: number) {
    const token = getToken();
    if (!token || !empresaId) return;
    const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/videos/${videoId}/tentar-de-novo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setErro(await mensagemDeErro(res, "Não foi possível tentar de novo."));
      return;
    }
    await carregarVideos(empresaId, token);
  }

  // O MP4 só é entregue com login; por isso busca o arquivo com o token e usa uma URL local.
  async function obterArquivo(videoId: number): Promise<string | null> {
    if (previas[videoId]) return previas[videoId];
    const token = getToken();
    if (!token || !empresaId) return null;
    setCarregandoArquivoId(videoId);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/videos/${videoId}/arquivo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível abrir o vídeo."));
        return null;
      }
      const url = URL.createObjectURL(await res.blob());
      setPrevias((p) => ({ ...p, [videoId]: url }));
      return url;
    } finally {
      setCarregandoArquivoId(null);
    }
  }

  async function baixarVideo(v: Video) {
    const url = await obterArquivo(v.id);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${v.id}.mp4`;
    a.click();
  }

  if (carregando) {
    return (
      <>
        <Nav empresaNome={empresaNome} />
        <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">Carregando...</main>
      </>
    );
  }

  if (erro && produtos.length === 0 && !config) {
    return (
      <>
        <Nav empresaNome={empresaNome} />
        <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">
          <p className="text-red-600">{erro}</p>
        </main>
      </>
    );
  }

  const filtrosAtivos = Object.entries(filtrosAplicados.current).some(([k, v]) => k !== "direcao" && v !== "");

  return (
    <>
      <Nav empresaNome={empresaNome} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0 space-y-8">
        <PageHeader titulo="Afiliados e Conteúdo" />

        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        {aviso && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{aviso}</p>
        )}

        {/* 1. Importar produtos */}
        <section className={`${cardStyle} p-4`}>
          <h2 className="font-semibold mb-1">1. Importar produtos</h2>
          <p className="text-sm text-gray-500 mb-3">
            Envie o arquivo CSV exportado do gerador de links em lote do painel de afiliados da Shopee. Ele traz nome,
            preço, vendas, loja, comissão e os dois links de cada produto. O Nexo guarda os links exatamente como vieram
            e não repete o mesmo produto, mesmo que o link venha em outro formato.
          </p>
          <form onSubmit={importarRelatorio} className="flex flex-wrap items-center gap-3">
            <input
              key={csvChave}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvArquivo(e.target.files?.[0] ?? null)}
              className="min-w-0 max-w-full text-sm"
            />
            <button type="submit" disabled={salvando || !csvArquivo} className={botaoPrimario}>
              {salvando ? "Importando..." : "Importar arquivo"}
            </button>
          </form>

          {resultadoRelatorio && (
            <div className="mt-4 pt-4 border-t space-y-1 text-sm">
              <p>
                <strong>{resultadoRelatorio.criados}</strong> produto(s) novo(s),{" "}
                <strong>{resultadoRelatorio.atualizados}</strong> já existiam e tiveram preço, vendas e comissão
                atualizados, {resultadoRelatorio.duplicadosNoArquivo} repetido(s) dentro do arquivo.
              </p>
              {resultadoRelatorio.linksDeOfertaDiferentes > 0 && (
                <p className="text-xs text-amber-600">
                  ⚠ {resultadoRelatorio.linksDeOfertaDiferentes} produto(s) vieram com um link de oferta diferente do que
                  já estava guardado. O link guardado foi mantido.
                </p>
              )}
              {resultadoRelatorio.erros.length > 0 && (
                <div className="text-xs text-red-600">
                  <p>{resultadoRelatorio.erros.length} linha(s) não importada(s):</p>
                  <ul className="list-disc pl-5">
                    {resultadoRelatorio.erros.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {resultadoRelatorio.erros.length > 10 && <p>… e mais {resultadoRelatorio.erros.length - 10}.</p>}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t">
            <h3 className="font-medium mb-1">Ou cole links de produtos</h3>
            <p className="text-sm text-gray-500 mb-3">
              Um por linha. Aceita links de produto e links curtos de afiliada (s.shopee.com.br). O Nexo lê nome, foto e
              categoria na página pública do produto, sem login. Preço e comissão não existem nessa página e ficam em
              branco.
            </p>
            <form onSubmit={cadastrarLote} className="space-y-3">
              <textarea
                className={`${inputStyle} h-24 w-full py-2`}
                value={linksLote}
                onChange={(e) => setLinksLote(e.target.value)}
                placeholder={"https://shopee.com.br/produto-1\nhttps://s.shopee.com.br/abc123"}
              />
              <button type="submit" disabled={salvando} className={botaoSecundario}>
                {salvando ? "Buscando dados..." : "Buscar e adicionar"}
              </button>
            </form>
          </div>
        </section>

        {/* 2. Produtos: filtros, seleção, geração */}
        <section className={`${cardStyle} p-4`}>
          <h2 className="font-semibold mb-1">2. Escolher produtos e gerar vídeos</h2>
          <p className="text-sm text-gray-500 mb-3">
            Filtre e ordene a lista, marque os produtos (ou use “selecionar os primeiros”) e clique em Gerar vídeos. Os
            vídeos entram numa fila e aparecem na seção 3.
          </p>

          <form onSubmit={aplicarFiltros} className="grid sm:grid-cols-4 gap-3 mb-3">
            <div className="sm:col-span-2">
              <label className={labelStyle}>Palavra-chave (nome, loja ou categoria)</label>
              <input
                className={`${inputStyle} w-full`}
                value={filtros.q}
                onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
                placeholder="Ex.: jeans"
              />
            </div>
            <div>
              <label className={labelStyle}>Preço mín. (R$)</label>
              <input className={`${inputStyle} w-full`} inputMode="decimal" value={filtros.precoMin}
                onChange={(e) => setFiltros({ ...filtros, precoMin: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Preço máx. (R$)</label>
              <input className={`${inputStyle} w-full`} inputMode="decimal" value={filtros.precoMax}
                onChange={(e) => setFiltros({ ...filtros, precoMax: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Vendas mín.</label>
              <input className={`${inputStyle} w-full`} inputMode="numeric" value={filtros.vendasMin}
                onChange={(e) => setFiltros({ ...filtros, vendasMin: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Vendas máx.</label>
              <input className={`${inputStyle} w-full`} inputMode="numeric" value={filtros.vendasMax}
                onChange={(e) => setFiltros({ ...filtros, vendasMax: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Comissão mín. (%)</label>
              <input className={`${inputStyle} w-full`} inputMode="decimal" value={filtros.comissaoPercMin}
                onChange={(e) => setFiltros({ ...filtros, comissaoPercMin: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Comissão mín. (R$)</label>
              <input className={`${inputStyle} w-full`} inputMode="decimal" value={filtros.comissaoValorMin}
                onChange={(e) => setFiltros({ ...filtros, comissaoValorMin: e.target.value })} />
            </div>
            <div>
              <label className={labelStyle}>Ordenar por</label>
              <select className={`${inputStyle} w-full`} value={filtros.ordenar}
                onChange={(e) => setFiltros({ ...filtros, ordenar: e.target.value })}>
                <option value="">Mais recentes</option>
                <option value="comissaoPercentual">Comissão (%)</option>
                <option value="comissaoValor">Comissão (R$)</option>
                <option value="vendas">Vendas</option>
                <option value="preco">Preço</option>
              </select>
            </div>
            <div>
              <label className={labelStyle}>Direção</label>
              <select className={`${inputStyle} w-full`} value={filtros.direcao}
                onChange={(e) => setFiltros({ ...filtros, direcao: e.target.value })}>
                <option value="desc">Maior primeiro</option>
                <option value="asc">Menor primeiro</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end gap-2">
              <button type="submit" className={botaoSecundario}>Aplicar</button>
              <button type="button" onClick={limparFiltros} className={botaoTexto}>Limpar filtros</button>
            </div>
          </form>
          <p className="text-xs text-gray-400 mb-4">
            Produto que não tem o dado (por exemplo, sem comissão) não aparece quando você filtra por esse dado e vai para
            o fim da lista ao ordenar. Vendas igual a 0 é um valor real.
          </p>

          <div className="flex flex-wrap items-center gap-3 py-3 border-y">
            <span className="text-sm">
              {produtos.length} produto(s){filtrosAtivos ? " com os filtros aplicados" : ""} · {selecionados.length} selecionado(s)
            </span>
            <span className="flex items-center gap-2 text-sm">
              Selecionar os primeiros
              <input className={`${inputStyle} w-16`} type="number" min={1} max={MAX_VIDEOS_POR_VEZ}
                value={quantidadeSelecionar} onChange={(e) => setQuantidadeSelecionar(e.target.value)} />
              <button type="button" onClick={selecionarPrimeiros} disabled={elegiveis.length === 0} className={botaoSecundario}>
                Selecionar
              </button>
            </span>
            {selecionados.length > 0 && (
              <button type="button" onClick={() => setSelecionados([])} className={botaoTexto}>Limpar seleção</button>
            )}
            <button type="button" onClick={gerarVideos} disabled={gerando || selecionados.length === 0}
              className={`${botaoPrimario} sm:ml-auto`}>
              {gerando ? "Enviando..." : `Gerar vídeos (${selecionados.length})`}
            </button>
          </div>

          {produtos.length === 0 ? (
            <p className="text-sm text-gray-500 mt-4">
              {filtrosAtivos ? "Nenhum produto com esses filtros." : "Nenhum produto ainda — importe o arquivo ou cole links acima."}
            </p>
          ) : (
            <div className="space-y-3 mt-4">
              {produtos.map((p) => {
                const marcado = selecionados.includes(p.id);
                const temVideo = produtosComVideoAtivo.has(p.id);
                return (
                  <div key={p.id} className={`border rounded-lg p-3 ${marcado ? "border-indigo-500 bg-indigo-500/5" : "border-black/10 dark:border-white/10"}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={marcado}
                        disabled={temVideo || !p.ativo}
                        onChange={() => alternarSelecao(p.id)}
                        aria-label={`Selecionar ${p.nome}`}
                      />
                      {p.imagemUrl && (
                        <img src={p.imagemUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.nome}</p>
                        <p className="text-xs text-gray-500">
                          {p.nomeLoja ? `Loja: ${p.nomeLoja}` : ""}
                          {p.nomeLoja && p.categoria ? " · " : ""}
                          {p.categoria ? `Categoria: ${p.categoria}` : ""}
                        </p>
                        <p className="text-xs text-black/70 dark:text-white/70 mt-1">
                          {p.preco != null ? <>Preço {brl(p.preco)}</> : <span className="text-gray-400">Preço não informado</span>}
                          {" · "}
                          {p.vendas != null ? <>{p.vendas.toLocaleString("pt-BR")} vendas</> : <span className="text-gray-400">vendas não informadas</span>}
                          {" · "}
                          {p.comissaoPercentual != null || p.comissaoValor != null ? (
                            <>
                              Comissão{" "}
                              {p.comissaoPercentual != null && percentual(p.comissaoPercentual)}
                              {p.comissaoPercentual != null && p.comissaoValor != null && " · "}
                              {p.comissaoValor != null && brl(p.comissaoValor)}
                            </>
                          ) : (
                            <span className="text-gray-400">comissão não informada</span>
                          )}
                        </p>
                        {(p.comissaoVendedorPercentual != null || p.comissaoShopeePercentual != null) && (
                          <p className="text-xs text-black/70 dark:text-white/70">
                            Taxas informadas pela API:{" "}
                            {p.comissaoVendedorPercentual != null && <>vendedor {percentual(p.comissaoVendedorPercentual)}</>}
                            {p.comissaoVendedorPercentual != null && p.comissaoShopeePercentual != null && " · "}
                            {p.comissaoShopeePercentual != null && <>Shopee {percentual(p.comissaoShopeePercentual)}</>}
                            <span className="text-[11px] text-gray-400"> (o significado de “Comissão Extra” ainda não foi confirmado na documentação oficial)</span>
                          </p>
                        )}
                        {(p.inicioOferta || p.fimOferta || p.avaliacao != null) && (
                          <p className="text-xs text-black/70 dark:text-white/70">
                            {p.inicioOferta || p.fimOferta
                              ? `Validade da oferta: ${p.inicioOferta ? dataBr(p.inicioOferta) : "?"} a ${p.fimOferta ? dataBr(p.fimOferta) : "?"}`
                              : ""}
                            {p.avaliacao != null ? `${p.inicioOferta || p.fimOferta ? " · " : ""}nota ${p.avaliacao.toLocaleString("pt-BR")}` : ""}
                            {variacoes[p.id]?.variacaoVendas != null
                              ? ` · vendas ${variacoes[p.id].variacaoVendas! >= 0 ? "+" : ""}${variacoes[p.id].variacaoVendas} desde ${dataBr(variacoes[p.id].de)}`
                              : ""}
                          </p>
                        )}
                        {p.ultimaConsultaApi && (
                          <p className="text-[11px] text-green-700">
                            ✓ Comissão verificada pela API oficial da Shopee em {new Date(p.ultimaConsultaApi).toLocaleString("pt-BR")}
                          </p>
                        )}
                        {(p.comissaoPercentual != null || p.comissaoValor != null) && !p.ultimaConsultaApi && (
                          <p className="text-[11px] text-gray-400">
                            Informação do arquivo{p.dataImportacao ? `, importado em ${dataBr(p.dataImportacao)}` : ""}.
                            Sujeita às condições da Shopee.
                          </p>
                        )}

                        {editandoLinkId === p.id ? (
                          <div className="flex gap-2 mt-2 max-w-md">
                            <input
                              className={`${inputStyle} flex-1`}
                              value={linkAfiliadoForm}
                              onChange={(e) => setLinkAfiliadoForm(e.target.value)}
                              placeholder="Cole aqui o seu link de afiliada da Shopee"
                            />
                            <button onClick={() => salvarLinkAfiliado(p)} disabled={salvando} className={botaoPrimario}>Salvar</button>
                            <button onClick={() => setEditandoLinkId(null)} className={botaoSecundario}>Cancelar</button>
                          </div>
                        ) : p.linkAfiliado ? (
                          <p className="text-xs text-green-700 mt-1">
                            ✓ Link de afiliada guardado — <button onClick={() => abrirEdicaoLink(p)} className={botaoTexto}>editar</button>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠ Sem link de afiliada — <button onClick={() => abrirEdicaoLink(p)} className={botaoTexto}>associar agora</button>
                          </p>
                        )}
                        {temVideo && <p className="text-xs text-indigo-600 mt-1">Já tem vídeo na fila ou pronto (seção 3).</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <button
                          onClick={() => (p.conteudo ? setTextoAbertoId(textoAbertoId === p.id ? null : p.id) : prepararConteudo(p.id))}
                          disabled={preparandoId === p.id}
                          className={botaoTexto}
                        >
                          {preparandoId === p.id ? "Preparando..." : p.conteudo ? "Ver texto/legenda" : "Preparar texto"}
                        </button>
                        <button onClick={() => remover(p.id)} className={botaoTexto}>Remover</button>
                      </div>
                    </div>

                    {marcado && (
                      <div className="mt-3 pl-7">
                        <label className={labelStyle}>
                          Observação para o vídeo (opcional — só o que for verdade, por exemplo o estado da peça)
                        </label>
                        <input
                          className={`${inputStyle} w-full max-w-xl`}
                          maxLength={200}
                          value={observacoes[p.id] ?? ""}
                          onChange={(e) => setObservacoes({ ...observacoes, [p.id]: e.target.value })}
                          placeholder="Ex.: Peça usada, conforme as fotos"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Essa frase é falada e legendada no vídeo. Sem ela, o Nexo não afirma o estado do produto.
                        </p>
                      </div>
                    )}

                    {p.conteudo && textoAbertoId === p.id && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {([
                          ["Roteiro", p.conteudo.roteiro],
                          ["Legenda", p.conteudo.legenda],
                          ["Chamada para compra", p.conteudo.chamadaParaCompra],
                          ["Hashtags", p.conteudo.hashtags],
                        ] as const).map(([titulo, texto]) => (
                          <div key={titulo}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">{titulo}</span>
                              <button onClick={() => copiar(texto, mostrarAviso)} className={botaoTexto}>Copiar</button>
                            </div>
                            <pre className="text-sm whitespace-pre-wrap bg-black/5 dark:bg-white/10 rounded p-2 mt-1 font-sans">{texto}</pre>
                          </div>
                        ))}
                        <p className="text-xs text-gray-400">
                          Rascunho de texto. O vídeo tem a própria legenda e hashtags, na seção 3.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Vídeos */}
        <section className={`${cardStyle} p-4`}>
          <h2 className="font-semibold mb-1">3. Vídeos ({videos.length})</h2>
          <p className="text-sm text-gray-500 mb-3">
            Cada vídeo é uma montagem das fotos reais do anúncio (vertical 9:16), com narração em português, música de
            fundo e legendas sincronizadas. Revise, baixe e publique você mesma na Shopee Vídeo. Na hora de publicar,
            vincule o produto lá; o link na legenda não substitui o produto marcado.
          </p>
          <div className="text-xs bg-black/5 dark:bg-white/10 rounded-lg p-3 mb-4 space-y-1 text-black/60 dark:text-white/60">
            <p>
              <strong>Modo usado:</strong> fotos com edição dinâmica. Não é uma pessoa ou modelo animado.
            </p>
            <p>
              <strong>Modo com apresentadora/modelo por IA: indisponível.</strong> Exige uma placa de vídeo (GPU) potente
              que este computador não tem, e nenhuma ferramenta gratuita garante que o produto saia sem deformações.
              Enquanto isso não for resolvido, o Nexo não oferece esse modo.
            </p>
            <p>
              Antes de publicar, confira a narração e as legendas e se as fotos mostram o produto certo. Se o anúncio tiver
              versões diferentes (cor, tamanho), o vídeo usa só as fotos enviadas junto com a capa.
            </p>
          </div>

          {avisoWorker && <p className="text-xs text-amber-600 mb-3">⚠ {avisoWorker}</p>}

          {videos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum vídeo ainda. Marque produtos na seção 2 e clique em Gerar vídeos.</p>
          ) : (
            <div className="space-y-4">
              {videos.map((v) => {
                const st = statusVideo[v.status];
                return (
                  <div key={v.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3">
                    <div className="flex flex-wrap items-start gap-3">
                      {v.produto.imagemUrl && (
                        <img src={v.produto.imagemUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{v.produto.nome}</p>
                        <p className="text-xs mt-1">
                          <span className={`inline-block rounded px-2 py-0.5 font-medium ${st.classe}`}>{st.texto}</span>
                          {v.categoriaDetectada && (
                            <span className="text-gray-500 ml-2">
                              Roteiro: {nomeCategoria[v.categoriaDetectada] ?? v.categoriaDetectada}
                            </span>
                          )}
                        </p>
                        {v.mensagem && (
                          <p className={`text-xs mt-1 ${v.status === "Pronto" ? "text-amber-600" : "text-red-600"}`}>{v.mensagem}</p>
                        )}
                        {v.status === "Pendente" && (
                          <p className="text-xs text-gray-400 mt-1">
                            Aguardando o processamento. Cada vídeo leva cerca de 1 minuto quando o worker de vídeo está ligado.
                          </p>
                        )}
                        {v.observacaoRevisao && (
                          <p className="text-xs text-gray-500 mt-1">Observação usada no roteiro: “{v.observacaoRevisao}”</p>
                        )}
                        {v.status === "Pronto" && (
                          <p className="text-xs text-gray-500 mt-1">
                            {v.duracaoSegundos != null && `${v.duracaoSegundos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}
                            {v.tamanhoBytes != null && ` · ${tamanhoMb(v.tamanhoBytes)}`}
                            {v.tempoProcessamentoSegundos != null && ` · gerado em ${Math.round(v.tempoProcessamentoSegundos)} s`}
                            {" · fotos reais do anúncio com edição dinâmica"}
                          </p>
                        )}
                        {(v.produto.comissaoPercentual != null || v.produto.comissaoValor != null) && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            Comissão {v.produto.comissaoPercentual != null && percentual(v.produto.comissaoPercentual)}
                            {v.produto.comissaoPercentual != null && v.produto.comissaoValor != null && " · "}
                            {v.produto.comissaoValor != null && brl(v.produto.comissaoValor)}: informação do arquivo
                            {v.produto.dataImportacao ? ` de ${dataBr(v.produto.dataImportacao)}` : ""}, sujeita às condições da Shopee.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {v.status === "Pronto" && v.temArquivo && v.arquivoNaApi && (
                          <>
                            <button onClick={() => obterArquivo(v.id)} disabled={carregandoArquivoId === v.id} className={botaoSecundario}>
                              {carregandoArquivoId === v.id ? "Abrindo..." : previas[v.id] ? "Vídeo aberto" : "Ver vídeo"}
                            </button>
                            <button onClick={() => baixarVideo(v)} disabled={carregandoArquivoId === v.id} className={botaoPrimario}>
                              Baixar MP4
                            </button>
                          </>
                        )}
                        {(v.status === "Erro" || v.status === "SemMateriais") && (
                          <button onClick={() => tentarDeNovo(v.id)} className={botaoSecundario}>Tentar de novo</button>
                        )}
                      </div>
                    </div>

                    {previas[v.id] && (
                      <video
                        src={previas[v.id]}
                        controls
                        playsInline
                        className="mt-3 rounded-lg bg-black"
                        style={{ width: 270, aspectRatio: "9 / 16", maxWidth: "100%" }}
                      />
                    )}

                    {v.status === "Pronto" && (
                      <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                        {v.arquivoLocal && (
                          <div className="rounded-lg bg-black/5 dark:bg-white/10 p-2 text-xs">
                            <p className="font-medium text-gray-500">Arquivo no computador do worker</p>
                            <p className="break-all mt-1">{v.arquivoLocal}</p>
                            <p className="text-gray-500 mt-1">
                              Ao lado do vídeo há um .txt com a legenda, as hashtags e os links. Para publicar, copie o MP4 para o
                              computador ou celular de publicação (cabo USB, Google Drive ou WhatsApp para si mesma).
                            </p>
                            <button onClick={() => copiar(v.arquivoLocal!, mostrarAviso)} className={botaoTexto}>Copiar caminho</button>
                          </div>
                        )}
                        {v.legenda && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">Legenda para publicar</span>
                              <button onClick={() => copiar(v.legenda!, mostrarAviso)} className={botaoTexto}>Copiar</button>
                            </div>
                            <p className="bg-black/5 dark:bg-white/10 rounded p-2 mt-1 whitespace-pre-wrap">{v.legenda}</p>
                          </div>
                        )}
                        {v.hashtags && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">Hashtags</span>
                              <button onClick={() => copiar(v.hashtags!, mostrarAviso)} className={botaoTexto}>Copiar</button>
                            </div>
                            <p className="bg-black/5 dark:bg-white/10 rounded p-2 mt-1">{v.hashtags}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs">
                          <a href={v.produto.linkOriginal} target="_blank" rel="noopener noreferrer" className={botaoTexto}>
                            Abrir o produto na Shopee
                          </a>
                          {v.produto.linkAfiliado && (
                            <button onClick={() => copiar(v.produto.linkAfiliado!, mostrarAviso)} className={botaoTexto}>
                              Copiar link de afiliada
                            </button>
                          )}
                        </div>
                        {v.musicaCredito && (
                          <p className="text-[11px] text-gray-400">{/^m[úu]sica/i.test(v.musicaCredito) ? "" : "Música: "}{v.musicaCredito}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {empresaId && (
          <>
            <RadarPanel empresaId={empresaId} getToken={getToken} aoAtualizar={carregarTudo} />
            <WorkerPanel empresaId={empresaId} getToken={getToken} />
          </>
        )}

        {/* Buscar por palavra-chave, cadastro manual e configuração (secundários) */}
        <section className={`${cardStyle} p-4`}>
          <button onClick={() => setMostrarOutrasFormas((v) => !v)} className={`${botaoTexto} font-semibold`}>
            {mostrarOutrasFormas ? "▾" : "▸"} Outras formas de achar produtos (busca por palavra-chave ou cadastro manual)
          </button>
          {mostrarOutrasFormas && (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="font-medium mb-1">Buscar por palavra-chave</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Procura produtos da Shopee por uma busca pública na web (a busca do site da Shopee exige login). Os
                  resultados chegam sem preço e sem comissão. Para ter esses dados, use o arquivo do painel de afiliados.
                  A busca pública às vezes é bloqueada por excesso de pedidos; o Nexo avisa quando isso acontece.
                </p>
                <form onSubmit={buscarProdutos} className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Palavra-chave *</label>
                    <input className={`${inputStyle} w-full`} required value={buscaForm.palavraChave}
                      onChange={(e) => setBuscaForm({ ...buscaForm, palavraChave: e.target.value })}
                      placeholder="Ex.: calça jeans feminina wide leg" />
                  </div>
                  <div>
                    <label className={labelStyle}>Nicho/categoria (opcional)</label>
                    <input className={`${inputStyle} w-full`} value={buscaForm.nicho}
                      onChange={(e) => setBuscaForm({ ...buscaForm, nicho: e.target.value })}
                      placeholder="Ex.: moda feminina" />
                  </div>
                  <div>
                    <label className={labelStyle}>Quantidade máxima</label>
                    <input className={`${inputStyle} w-full`} type="number" min={1} max={20}
                      value={buscaForm.quantidadeMaxima}
                      onChange={(e) => setBuscaForm({ ...buscaForm, quantidadeMaxima: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelStyle}>Prioridade</label>
                    <select className={`${inputStyle} w-full`} value={buscaForm.prioridade}
                      onChange={(e) => setBuscaForm({ ...buscaForm, prioridade: e.target.value })}>
                      <option value="Relevancia">Relevância</option>
                      <option value="SinaisVendas">Sinais de vendas</option>
                    </select>
                  </div>
                  <div>
                    <button type="submit" disabled={buscando} className={botaoSecundario}>
                      {buscando ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                </form>

                {resultadoBusca && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-sm">
                      <strong>{resultadoBusca.buscados}</strong> encontrado(s), <strong>{resultadoBusca.importados}</strong>{" "}
                      importado(s) agora, {resultadoBusca.duplicadosIgnorados} já estavam cadastrados.
                    </p>
                    {resultadoBusca.limitacoes.map((l, i) => (
                      <p key={i} className="text-xs text-amber-600">⚠ {l}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Cadastrar um produto manualmente</h3>
                  <button onClick={() => setMostrarFormManual((v) => !v)} className={botaoSecundario}>
                    {mostrarFormManual ? "Fechar" : "+ Novo produto"}
                  </button>
                </div>
                {mostrarFormManual && (
                  <form onSubmit={cadastrarManual} className="space-y-3 mt-4 max-w-md">
                    <div>
                      <label className={labelStyle}>Link original da Shopee *</label>
                      <input className={`${inputStyle} w-full`} required value={form.linkOriginal}
                        onChange={(e) => setForm({ ...form, linkOriginal: e.target.value })}
                        placeholder="https://shopee.com.br/produto" />
                    </div>
                    <div>
                      <label className={labelStyle}>Link de afiliada (se já tiver)</label>
                      <input className={`${inputStyle} w-full`} value={form.linkAfiliado}
                        onChange={(e) => setForm({ ...form, linkAfiliado: e.target.value })}
                        placeholder="https://s.shopee.com.br/..." />
                    </div>
                    <div>
                      <label className={labelStyle}>Nome do produto *</label>
                      <input className={`${inputStyle} w-full`} required value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelStyle}>Categoria</label>
                      <input className={`${inputStyle} w-full`} value={form.categoria}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelStyle}>URL da imagem</label>
                      <input className={`${inputStyle} w-full`} value={form.imagemUrl}
                        onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelStyle}>Preço (se souber)</label>
                      <input className={`${inputStyle} w-full`} type="number" step="0.01" value={form.preco}
                        onChange={(e) => setForm({ ...form, preco: e.target.value })} />
                    </div>
                    <button type="submit" disabled={salvando} className={botaoPrimario}>Cadastrar</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>

        <section className={`${cardStyle} p-4`}>
          <button onClick={() => setMostrarConfig((v) => !v)} className={`${botaoTexto} font-semibold`}>
            {mostrarConfig ? "▾" : "▸"} Configuração da Shopee (ID de afiliada / API oficial)
          </button>
          {mostrarConfig && (
            <>
              <p className="text-sm text-gray-500 my-3">
                Seu ID de afiliada identifica suas comissões — não é senha nem chave de API. App Id e App Secret só são
                necessários se você já tiver acesso confirmado à API oficial de afiliados da Shopee; sem isso, tudo acima
                continua funcionando.
              </p>
              <form onSubmit={salvarConfiguracao} className="space-y-3 max-w-md">
                <div>
                  <label className={labelStyle}>ID de afiliada</label>
                  <input className={`${inputStyle} w-full`} value={idAfiliadoForm}
                    onChange={(e) => setIdAfiliadoForm(e.target.value)} placeholder="Ex.: 18351451245" />
                </div>
                <div>
                  <label className={labelStyle}>
                    App Id (opcional — só se tiver acesso à API oficial)
                    {config?.appIdConfigurado && <span className="text-green-600 ml-2">✓ já configurado</span>}
                  </label>
                  <input className={`${inputStyle} w-full`} value={appIdForm}
                    onChange={(e) => setAppIdForm(e.target.value)}
                    placeholder={config?.appIdConfigurado ? "Preenchido — deixe em branco para manter" : ""}
                    autoComplete="off" />
                </div>
                <div>
                  <label className={labelStyle}>
                    App Secret (opcional — só se tiver acesso à API oficial)
                    {config?.appSecretConfigurado && <span className="text-green-600 ml-2">✓ já configurado</span>}
                  </label>
                  <input className={`${inputStyle} w-full`} type="password" value={appSecretForm}
                    onChange={(e) => setAppSecretForm(e.target.value)}
                    placeholder={config?.appSecretConfigurado ? "Preenchido — deixe em branco para manter" : ""}
                    autoComplete="off" />
                </div>
                <p className="text-xs text-gray-400">
                  App Id/App Secret ficam guardados criptografados e nunca são exibidos de volta aqui.
                </p>
                <button type="submit" disabled={salvando} className={botaoPrimario}>Salvar configuração</button>
              </form>
            </>
          )}
        </section>
      </main>
    </>
  );
}
