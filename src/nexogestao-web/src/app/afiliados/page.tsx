"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../_components/Nav";
import PageHeader from "../_components/PageHeader";
import { inputStyle, labelStyle, botaoPrimario, botaoSecundario, botaoTexto, cardStyle } from "../_components/ui";
import { API_URL, MODULO_INDISPONIVEL_MSG, moduloIndisponivel } from "../../lib/api";

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

const formBusca = {
  nicho: "",
  palavraChave: "",
  precoMin: "",
  precoMax: "",
  quantidadeMaxima: "10",
  prioridade: "Relevancia",
  gerarVideosAutomaticamente: false,
  limiteVideosAutomaticos: "3",
};

const formVazio = { linkOriginal: "", linkAfiliado: "", nome: "", categoria: "", imagemUrl: "", preco: "" };

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => null);
  return data?.mensagem ?? padrao;
}

function copiar(texto: string, aviso: (msg: string) => void) {
  navigator.clipboard?.writeText(texto).then(() => aviso("Copiado."));
}

export default function AfiliadosPage() {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<ProdutoAfiliado[]>([]);
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [preparandoId, setPreparandoId] = useState<number | null>(null);
  const [preparandoTodos, setPreparandoTodos] = useState(false);
  const [editandoLinkId, setEditandoLinkId] = useState<number | null>(null);
  const [linkAfiliadoForm, setLinkAfiliadoForm] = useState("");

  const [idAfiliadoForm, setIdAfiliadoForm] = useState("");
  const [appIdForm, setAppIdForm] = useState("");
  const [appSecretForm, setAppSecretForm] = useState("");
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [buscaForm, setBuscaForm] = useState(formBusca);
  const [buscando, setBuscando] = useState(false);
  const [resultadoBusca, setResultadoBusca] = useState<ResultadoBusca | null>(null);

  const [linksLote, setLinksLote] = useState("");
  const [csvArquivo, setCsvArquivo] = useState<File | null>(null);
  const [form, setForm] = useState(formVazio);
  const [mostrarOutrasFormas, setMostrarOutrasFormas] = useState(false);
  const [mostrarFormManual, setMostrarFormManual] = useState(false);

  const router = useRouter();

  function getToken() {
    return typeof window !== "undefined" ? localStorage.getItem("nexo_token") : null;
  }

  function mostrarAviso(msg: string) {
    setAviso(msg);
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
      const primeiraEmpresa = empresas[0];
      setEmpresaId(primeiraEmpresa.id);
      setEmpresaNome(primeiraEmpresa.nome);

      const [resProdutos, resConfig] = await Promise.all([
        fetch(`${API_URL}/api/empresas/${primeiraEmpresa.id}/afiliados/produtos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/empresas/${primeiraEmpresa.id}/afiliados/configuracao`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (moduloIndisponivel(resProdutos, resConfig)) {
        setErro(MODULO_INDISPONIVEL_MSG);
        return;
      }

      setProdutos(await resProdutos.json());
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
          gerarVideosAutomaticamente: buscaForm.gerarVideosAutomaticamente,
          limiteVideosAutomaticos: Number(buscaForm.limiteVideosAutomaticos) || 0,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível buscar produtos."));
        return;
      }
      const resultado: ResultadoBusca = await res.json();
      setResultadoBusca(resultado);
      await carregarTudo();
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
          `. ${resultado.duplicados} já existiam.` +
          (resultado.invalidos.length > 0 ? ` ${resultado.invalidos.length} link(s) fora do domínio da Shopee foram ignorados.` : "")
      );
      await carregarTudo();
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
      await carregarTudo();
    } finally {
      setPreparandoId(null);
    }
  }

  async function prepararTodosPendentes() {
    const token = getToken();
    if (!token || !empresaId) return;
    setPreparandoTodos(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/preparar-conteudo-pendentes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível preparar os conteúdos."));
        return;
      }
      const resultado = await res.json();
      mostrarAviso(`${resultado.preparados} conteúdo(s) preparado(s).`);
      await carregarTudo();
    } finally {
      setPreparandoTodos(false);
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
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  }

  async function importarCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || salvando || !csvArquivo) return;
    const token = getToken();
    if (!token) return;

    setSalvando(true);
    setErro(null);
    try {
      const conteudoCsv = await csvArquivo.text();
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}/afiliados/produtos/importar-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conteudoCsv }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, "Não foi possível importar o CSV."));
        return;
      }
      const resultado = await res.json();
      setCsvArquivo(null);
      mostrarAviso(
        `${resultado.criados} produto(s) importado(s). ${resultado.duplicados} duplicado(s) ignorado(s).` +
          (resultado.erros.length > 0 ? ` ${resultado.erros.length} linha(s) com erro.` : "")
      );
      await carregarTudo();
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
      await carregarTudo();
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
    if (res.ok) await carregarTudo();
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

  const pendentesSemConteudo = produtos.filter((p) => p.ativo && !p.conteudo).length;

  return (
    <>
      <Nav empresaNome={empresaNome} />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0 space-y-8">
        <PageHeader titulo="Afiliados e Conteúdo" />

        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        {aviso && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {aviso}
          </p>
        )}

        {/* Buscar produtos por palavra-chave */}
        <section className={cardStyle}>
          <h2 className="font-semibold mb-1">Buscar produtos e gerar vídeos</h2>
          <p className="text-sm text-gray-500 mb-3">
            Digite uma palavra-chave e o Nexo procura produtos da Shopee que combinem com
            ela (busca pública — a Shopee não deixa buscar direto no site dela sem login),
            importa os que achar e já prepara roteiro, legenda e hashtags.
          </p>
          <form onSubmit={buscarProdutos} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelStyle}>Palavra-chave *</label>
                <input
                  className={inputStyle}
                  required
                  value={buscaForm.palavraChave}
                  onChange={(e) => setBuscaForm({ ...buscaForm, palavraChave: e.target.value })}
                  placeholder="Ex.: calça jeans feminina wide leg"
                />
              </div>
              <div>
                <label className={labelStyle}>Nicho/categoria (opcional)</label>
                <input
                  className={inputStyle}
                  value={buscaForm.nicho}
                  onChange={(e) => setBuscaForm({ ...buscaForm, nicho: e.target.value })}
                  placeholder="Ex.: moda feminina"
                />
              </div>
              <div>
                <label className={labelStyle}>Preço mín. (opcional)</label>
                <input
                  className={inputStyle}
                  type="number"
                  step="0.01"
                  value={buscaForm.precoMin}
                  onChange={(e) => setBuscaForm({ ...buscaForm, precoMin: e.target.value })}
                />
              </div>
              <div>
                <label className={labelStyle}>Preço máx. (opcional)</label>
                <input
                  className={inputStyle}
                  type="number"
                  step="0.01"
                  value={buscaForm.precoMax}
                  onChange={(e) => setBuscaForm({ ...buscaForm, precoMax: e.target.value })}
                />
              </div>
              <div>
                <label className={labelStyle}>Quantidade máxima</label>
                <input
                  className={inputStyle}
                  type="number"
                  min={1}
                  max={20}
                  value={buscaForm.quantidadeMaxima}
                  onChange={(e) => setBuscaForm({ ...buscaForm, quantidadeMaxima: e.target.value })}
                />
              </div>
              <div>
                <label className={labelStyle}>Prioridade</label>
                <select
                  className={inputStyle}
                  value={buscaForm.prioridade}
                  onChange={(e) => setBuscaForm({ ...buscaForm, prioridade: e.target.value })}
                >
                  <option value="Relevancia">Relevância</option>
                  <option value="SinaisVendas">Sinais de vendas</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={buscaForm.gerarVideosAutomaticamente}
                onChange={(e) => setBuscaForm({ ...buscaForm, gerarVideosAutomaticamente: e.target.checked })}
              />
              Gerar automaticamente os vídeos dos primeiros resultados
              {buscaForm.gerarVideosAutomaticamente && (
                <input
                  className={`${inputStyle} w-20`}
                  type="number"
                  min={1}
                  max={10}
                  value={buscaForm.limiteVideosAutomaticos}
                  onChange={(e) => setBuscaForm({ ...buscaForm, limiteVideosAutomaticos: e.target.value })}
                />
              )}
            </label>

            <button type="submit" disabled={buscando} className={botaoPrimario}>
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {resultadoBusca && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-sm">
                <strong>{resultadoBusca.buscados}</strong> encontrado(s) na busca,{" "}
                <strong>{resultadoBusca.importados}</strong> importado(s) agora,{" "}
                {resultadoBusca.duplicadosIgnorados} já estavam cadastrados.
              </p>
              {resultadoBusca.prioridadeSolicitada !== resultadoBusca.prioridadeAplicada && (
                <p className="text-xs text-amber-600">
                  Prioridade aplicada: {resultadoBusca.prioridadeAplicada} (não {resultadoBusca.prioridadeSolicitada}) — ver aviso abaixo.
                </p>
              )}
              {resultadoBusca.limitacoes.map((l, i) => (
                <p key={i} className="text-xs text-amber-600">⚠ {l}</p>
              ))}
            </div>
          )}
        </section>

        {/* Passo 1: colar links */}
        <section className={cardStyle}>
          <h2 className="font-semibold mb-1">1. Colar links da Shopee</h2>
          <p className="text-sm text-gray-500 mb-3">
            Cole um ou vários links de produto, um por linha. O Nexo busca sozinho o nome, a
            foto e a categoria de cada um (dados públicos da própria página do produto — sem
            login). O preço não existe nessa página pública, então fica em branco
            até você preencher ou vincular a API oficial da Shopee (ver configuração abaixo).
          </p>
          <form onSubmit={cadastrarLote} className="space-y-3">
            <textarea
              className={`${inputStyle} h-28`}
              value={linksLote}
              onChange={(e) => setLinksLote(e.target.value)}
              placeholder={"https://shopee.com.br/produto-1\nhttps://shopee.com.br/produto-2"}
            />
            <button type="submit" disabled={salvando} className={botaoPrimario}>
              {salvando ? "Buscando dados..." : "Buscar e adicionar"}
            </button>
          </form>
        </section>

        {/* Passo 2: preparar conteúdo em lote */}
        {produtos.length > 0 && (
          <section className={cardStyle}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold">2. Preparar conteúdos</h2>
                <p className="text-sm text-gray-500">
                  Gera roteiro, legenda, chamada para compra e hashtags pra cada produto que
                  ainda não tem. São rascunhos — revise antes de gravar/publicar, e complete
                  "detalhe confirmado" do roteiro com algo real do anúncio.
                </p>
              </div>
              <button
                onClick={prepararTodosPendentes}
                disabled={preparandoTodos || pendentesSemConteudo === 0}
                className={botaoPrimario}
              >
                {preparandoTodos ? "Preparando..." : `Preparar ${pendentesSemConteudo} pendente(s)`}
              </button>
            </div>
          </section>
        )}

        {/* Configuração (secundária) */}
        <section className={cardStyle}>
          <button onClick={() => setMostrarConfig((v) => !v)} className={`${botaoTexto} font-semibold`}>
            {mostrarConfig ? "▾" : "▸"} Configuração da Shopee (ID de afiliada / API oficial)
          </button>
          {mostrarConfig && (
            <>
              <p className="text-sm text-gray-500 my-3">
                Seu ID de afiliada identifica suas comissões — não é senha nem chave de API.
                App Id e App Secret só são necessários se você já tiver acesso confirmado à API
                oficial de afiliados da Shopee; sem isso, a busca automática por link continua
                funcionando normalmente.
              </p>
              <form onSubmit={salvarConfiguracao} className="space-y-3 max-w-md">
                <div>
                  <label className={labelStyle}>ID de afiliada</label>
                  <input
                    className={inputStyle}
                    value={idAfiliadoForm}
                    onChange={(e) => setIdAfiliadoForm(e.target.value)}
                    placeholder="Ex.: 18351451245"
                  />
                </div>
                <div>
                  <label className={labelStyle}>
                    App Id (opcional — só se tiver acesso à API oficial)
                    {config?.appIdConfigurado && <span className="text-green-600 ml-2">✓ já configurado</span>}
                  </label>
                  <input
                    className={inputStyle}
                    value={appIdForm}
                    onChange={(e) => setAppIdForm(e.target.value)}
                    placeholder={config?.appIdConfigurado ? "Preenchido — deixe em branco para manter" : ""}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className={labelStyle}>
                    App Secret (opcional — só se tiver acesso à API oficial)
                    {config?.appSecretConfigurado && <span className="text-green-600 ml-2">✓ já configurado</span>}
                  </label>
                  <input
                    className={inputStyle}
                    type="password"
                    value={appSecretForm}
                    onChange={(e) => setAppSecretForm(e.target.value)}
                    placeholder={config?.appSecretConfigurado ? "Preenchido — deixe em branco para manter" : ""}
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  App Id/App Secret ficam guardados criptografados e nunca são exibidos de volta aqui.
                </p>
                <button type="submit" disabled={salvando} className={botaoPrimario}>
                  Salvar configuração
                </button>
              </form>
            </>
          )}
        </section>

        {/* Outras formas de cadastrar (secundárias) */}
        <section className={cardStyle}>
          <button onClick={() => setMostrarOutrasFormas((v) => !v)} className={`${botaoTexto} font-semibold`}>
            {mostrarOutrasFormas ? "▾" : "▸"} Outras formas de cadastrar (CSV ou manual)
          </button>
          {mostrarOutrasFormas && (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="font-medium mb-1">Importar CSV</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Colunas (com cabeçalho): LinkOriginal, LinkAfiliado, Nome, Categoria, ImagemUrl, Preco.
                  As quatro últimas podem ficar vazias.
                </p>
                <form onSubmit={importarCsv} className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setCsvArquivo(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                  <button type="submit" disabled={salvando || !csvArquivo} className={botaoSecundario}>
                    Importar
                  </button>
                </form>
              </div>

              <div>
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
                      <input
                        className={inputStyle}
                        required
                        value={form.linkOriginal}
                        onChange={(e) => setForm({ ...form, linkOriginal: e.target.value })}
                        placeholder="https://shopee.com.br/produto"
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Link de afiliada (se já tiver)</label>
                      <input
                        className={inputStyle}
                        value={form.linkAfiliado}
                        onChange={(e) => setForm({ ...form, linkAfiliado: e.target.value })}
                        placeholder="https://shope.ee/..."
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Nome do produto *</label>
                      <input
                        className={inputStyle}
                        required
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Categoria</label>
                      <input
                        className={inputStyle}
                        value={form.categoria}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>URL da imagem</label>
                      <input
                        className={inputStyle}
                        value={form.imagemUrl}
                        onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className={labelStyle}>Preço (se souber)</label>
                        <input
                          className={inputStyle}
                          type="number"
                          step="0.01"
                          value={form.preco}
                          onChange={(e) => setForm({ ...form, preco: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={salvando} className={botaoPrimario}>
                      Cadastrar
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Passo 3: revisar e copiar */}
        <section>
          <h2 className="font-semibold mb-3">3. Revisar e copiar ({produtos.length} produto(s))</h2>
          {produtos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum produto ainda — cole um link acima pra começar.</p>
          ) : (
            <div className="space-y-4">
              {produtos.map((p) => (
                <div key={p.id} className={cardStyle}>
                  <div className="flex flex-wrap items-start gap-3">
                    {p.imagemUrl && (
                      <img src={p.imagemUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{p.linkOriginal}</p>
                      {p.categoria && <p className="text-xs text-gray-500">Categoria: {p.categoria}</p>}

                      {editandoLinkId === p.id ? (
                        <div className="flex gap-2 mt-2 max-w-sm">
                          <input
                            className={inputStyle}
                            value={linkAfiliadoForm}
                            onChange={(e) => setLinkAfiliadoForm(e.target.value)}
                            placeholder="Cole aqui o seu link de afiliada da Shopee"
                          />
                          <button onClick={() => salvarLinkAfiliado(p)} disabled={salvando} className={botaoPrimario}>
                            Salvar
                          </button>
                          <button onClick={() => setEditandoLinkId(null)} className={botaoSecundario}>
                            Cancelar
                          </button>
                        </div>
                      ) : p.linkAfiliado ? (
                        <p className="text-xs text-green-700 mt-1">
                          ✓ Link de afiliada configurado — <button onClick={() => abrirEdicaoLink(p)} className={botaoTexto}>editar</button>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠ Sem link de afiliada ainda — <button onClick={() => abrirEdicaoLink(p)} className={botaoTexto}>associar agora</button>
                        </p>
                      )}

                      {p.preco != null && (
                        <p className="text-xs text-gray-600 mt-1">R$ {p.preco.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {!p.conteudo ? (
                        <button
                          onClick={() => prepararConteudo(p.id)}
                          disabled={preparandoId === p.id}
                          className={botaoPrimario}
                        >
                          {preparandoId === p.id ? "Preparando..." : "Preparar conteúdo"}
                        </button>
                      ) : (
                        <button
                          onClick={() => prepararConteudo(p.id)}
                          disabled={preparandoId === p.id}
                          className={botaoSecundario}
                        >
                          Gerar outra versão
                        </button>
                      )}
                      <button onClick={() => remover(p.id)} className={botaoTexto}>
                        Remover
                      </button>
                    </div>
                  </div>

                  {p.conteudo && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">
                            Roteiro ({p.conteudo.abordagem})
                          </span>
                          <button onClick={() => copiar(p.conteudo!.roteiro, mostrarAviso)} className={botaoTexto}>
                            Copiar
                          </button>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap bg-gray-50 rounded p-2 mt-1">{p.conteudo.roteiro}</pre>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Legenda</span>
                          <button onClick={() => copiar(p.conteudo!.legenda, mostrarAviso)} className={botaoTexto}>
                            Copiar
                          </button>
                        </div>
                        <p className="text-sm bg-gray-50 rounded p-2 mt-1">{p.conteudo.legenda}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Chamada para compra</span>
                          <button onClick={() => copiar(p.conteudo!.chamadaParaCompra, mostrarAviso)} className={botaoTexto}>
                            Copiar
                          </button>
                        </div>
                        <p className="text-sm bg-gray-50 rounded p-2 mt-1">{p.conteudo.chamadaParaCompra}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Hashtags</span>
                          <button onClick={() => copiar(p.conteudo!.hashtags, mostrarAviso)} className={botaoTexto}>
                            Copiar
                          </button>
                        </div>
                        <p className="text-sm bg-gray-50 rounded p-2 mt-1">{p.conteudo.hashtags}</p>
                      </div>
                      <p className="text-xs text-amber-600">
                        Vídeo ainda não é gerado automaticamente (depende de instalar o FFmpeg no
                        ambiente — ver aviso do Nexo). Grave usando este roteiro como guia.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
