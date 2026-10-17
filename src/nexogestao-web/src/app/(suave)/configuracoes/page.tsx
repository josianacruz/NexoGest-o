"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import ThemeToggle from "../../_components/ThemeToggle";
import { inputStyle, labelStyle, botaoPrimario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";
import { separarNomeEslogan } from "../../../lib/modulos";
import { NICHOS, type Nicho } from "../../_suave/CamposDoNicho";
import HorarioDeTrabalho from "../../_suave/HorarioDeTrabalho";
import { escolherEmpresa } from "../../../lib/empresaAtiva";

// 5511912345678 → (11) 91234-5678 (só para mostrar; a API guarda os dígitos)
function formatarZap(digitos: string) {
  const d = digitos.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

const MAX_NOME = 60;
const MAX_SLOGAN = 80;

// O nome e a frase ficam gravados juntos no campo Nome da empresa ("Nome | frase"), formato que o Nav, as páginas
// públicas e as artes já entendem. Aqui a pessoa edita os dois campos separados e a tela monta o texto.
function tirarBarra(texto: string) {
  return texto.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [comandasHabilitadas, setComandasHabilitadas] = useState(true);
  const [papel, setPapel] = useState<string>("");
  const [nome, setNome] = useState("");
  const [slogan, setSlogan] = useState("");
  const [nicho, setNicho] = useState<Nicho>("Outros");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappSalvo, setWhatsappSalvo] = useState("");
  const [salvandoZap, setSalvandoZap] = useState(false);
  const [avisoZap, setAvisoZap] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvandoNicho, setSalvandoNicho] = useState(false);
  const [avisoNicho, setAvisoNicho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ehDono = papel === "Dono";

  useEffect(() => {
    const token = localStorage.getItem("nexo_token");
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/empresas/minhas`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const empresas = await res.json();
        if (empresas.length === 0) {
          setErro("Você ainda não tem nenhuma empresa cadastrada.");
          return;
        }
        const e = escolherEmpresa(empresas);
        setEmpresaId(e.id);
        setEmpresaNome(e.nome);
        setComandasHabilitadas(e.comandasHabilitadas ?? true);
        setPapel(e.ehAdmin ? "Dono" : (e.papel ?? "")); // administradora máster edita como Dono
        setNicho((e.nicho as Nicho) ?? "Outros");
        setWhatsapp(formatarZap(e.whatsapp ?? ""));
        setWhatsappSalvo(e.whatsapp ?? "");
        const partes = separarNomeEslogan(e.nome);
        setNome(partes.nome);
        setSlogan(partes.slogan ?? "");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empresaId || salvando) return;
    const token = localStorage.getItem("nexo_token");
    if (!token) return;

    const nomeLimpo = tirarBarra(nome);
    const sloganLimpo = tirarBarra(slogan);
    if (nomeLimpo.length === 0) {
      setErro("Escreva o nome da loja.");
      return;
    }

    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const novoNome = sloganLimpo ? `${nomeLimpo} | ${sloganLimpo}` : nomeLimpo;
      // A API troca também "comandas habilitadas" nessa mesma chamada: reenvia o valor atual para não mudar nada além do nome.
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comandasHabilitadas, nome: novoNome }),
      });
      if (res.status === 403) {
        setErro("Só quem é Dono da loja pode mudar o nome.");
        return;
      }
      if (!res.ok) {
        setErro("Não foi possível salvar o nome. Tente de novo.");
        return;
      }
      const dados = await res.json();
      setEmpresaNome(dados.nome);
      setNome(nomeLimpo);
      setSlogan(sloganLimpo);
      setAviso("Nome salvo. Ele já aparece no menu e nas páginas e artes que você criar daqui para frente.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarWhatsapp(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empresaId || !ehDono || salvandoZap) return;
    const token = localStorage.getItem("nexo_token");
    if (!token) return;
    setSalvandoZap(true);
    setAvisoZap(null);
    try {
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comandasHabilitadas, whatsapp }),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        setAvisoZap({ tipo: "erro", texto: dados?.mensagem ?? "Não foi possível salvar. Tente de novo." });
        return;
      }
      setWhatsappSalvo(dados.whatsapp ?? "");
      setWhatsapp(formatarZap(dados.whatsapp ?? ""));
      setAvisoZap({ tipo: "ok", texto: dados.whatsapp ? "Salvo. O botão de WhatsApp já aparece na página de agendamento das clientes." : "WhatsApp removido da página de agendamento." });
    } finally {
      setSalvandoZap(false);
    }
  }

  async function escolherNicho(novo: Nicho) {
    if (!empresaId || !ehDono || salvandoNicho || novo === nicho) return;
    const token = localStorage.getItem("nexo_token");
    if (!token) return;
    const anterior = nicho;
    setNicho(novo);
    setSalvandoNicho(true);
    setAvisoNicho(null);
    try {
      // O nome vai de fora: a API só muda o que vem preenchido.
      const res = await fetch(`${API_URL}/api/empresas/${empresaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comandasHabilitadas, nicho: novo }),
      });
      if (!res.ok) {
        setNicho(anterior);
        setAvisoNicho(res.status === 403 ? "Só o Dono da loja pode mudar o tipo da loja." : "Não foi possível salvar. Tente de novo.");
        return;
      }
      setAvisoNicho("Salvo. O cadastro de produtos já mostra os campos desse tipo de loja.");
    } finally {
      setSalvandoNicho(false);
    }
  }

  if (carregando) {
    return (
      <>
        <Nav />
        <main className="max-w-3xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0">Carregando...</main>
      </>
    );
  }

  const alterado = tirarBarra(nome) !== separarNomeEslogan(empresaNome).nome || tirarBarra(slogan) !== (separarNomeEslogan(empresaNome).slogan ?? "");

  return (
    <>
      <Nav empresaNome={empresaNome} comandasHabilitadas={comandasHabilitadas} />
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-8 w-full min-w-0 space-y-6">
        <PageHeader titulo="Configurações" />

        <section className={`${cardStyle} p-5`}>
          <h2 className="font-semibold mb-1">Nome da loja</h2>
          <p className="text-sm text-black/60 dark:text-white/60 mb-4">
            Aparece no menu, na página onde seus clientes agendam, nas páginas de interesse e de vaga, e nas artes de divulgação que você criar a
            partir de agora. Artes e links que você já baixou ou enviou não mudam.
          </p>

          <form onSubmit={salvar} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="nome-loja" className={labelStyle}>
                Nome da loja
              </label>
              <input
                id="nome-loja"
                className={`${inputStyle} w-full`}
                value={nome}
                maxLength={MAX_NOME}
                disabled={!ehDono}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Studio da Débora"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="frase-loja" className={labelStyle}>
                Frase abaixo do nome (opcional)
              </label>
              <input
                id="frase-loja"
                className={`${inputStyle} w-full`}
                value={slogan}
                maxLength={MAX_SLOGAN}
                disabled={!ehDono}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ex.: Cabelo e unhas com carinho"
                autoComplete="off"
              />
            </div>

            <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-sm">
              <p className="text-xs text-black/60 dark:text-white/60 mb-1">Como vai aparecer</p>
              <p className="font-medium">{tirarBarra(nome) || "Nome da loja"}</p>
              {tirarBarra(slogan) && <p className="text-xs text-black/60 dark:text-white/60">{tirarBarra(slogan)}</p>}
            </div>

            {erro && (
              <p role="alert" className="text-sm text-red-600">
                {erro}
              </p>
            )}
            {aviso && (
              <p role="status" className="text-sm text-green-600">
                {aviso}
              </p>
            )}
            {!ehDono && <p className="text-sm text-black/60 dark:text-white/60">Só o Dono da loja pode mudar o nome.</p>}

            <button type="submit" disabled={!ehDono || salvando || !alterado || tirarBarra(nome).length === 0} className={botaoPrimario}>
              {salvando ? "Salvando..." : "Salvar nome"}
            </button>
          </form>
        </section>

        <HorarioDeTrabalho />

        <section className={`${cardStyle} p-5`}>
          <h2 className="font-semibold mb-1">WhatsApp da loja</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            É o número que recebe a confirmação quando a cliente agenda pela sua página. Se ficar em branco, o botão de WhatsApp não aparece para ela.
          </p>
          <form onSubmit={salvarWhatsapp} className="grid max-w-md gap-3">
            <div>
              <label htmlFor="zap-loja" className={labelStyle}>
                Número com DDD
              </label>
              <input id="zap-loja" className={`${inputStyle} w-full`} type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 91234-5678" value={whatsapp} maxLength={20} disabled={!ehDono} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            {avisoZap && (
              <p role={avisoZap.tipo === "erro" ? "alert" : "status"} className={`rounded-2xl p-3 text-sm ${avisoZap.tipo === "erro" ? "bg-rose-100 text-rose-900 dark:bg-rose-400/20 dark:text-rose-100" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100"}`}>
                {avisoZap.texto}
              </p>
            )}
            {!ehDono && <p className="text-sm text-slate-600 dark:text-slate-300">Só o Dono da loja pode mudar o WhatsApp.</p>}
            <button type="submit" disabled={!ehDono || salvandoZap || whatsapp.replace(/\D/g, "") === whatsappSalvo.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")} className={botaoPrimario}>
              {salvandoZap ? "Salvando..." : "Salvar WhatsApp"}
            </button>
          </form>
        </section>

        <section className={`${cardStyle} p-5`}>
          <h2 className="font-semibold mb-1">Tipo da loja</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Escolha o que mais combina com a sua loja. O cadastro de produtos mostra só os campos que fazem sentido para ela, para você cadastrar mais rápido.
          </p>
          <div role="radiogroup" aria-label="Tipo da loja" className="grid gap-2 sm:grid-cols-2">
            {NICHOS.map((n) => (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={nicho === n.valor}
                disabled={!ehDono || salvandoNicho}
                onClick={() => escolherNicho(n.valor)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  nicho === n.valor ? "border-violet-300 bg-violet-100 ring-2 ring-violet-300 dark:border-violet-300/40 dark:bg-violet-300/20" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {n.icone}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{n.nome}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{n.descricao}</span>
                </span>
              </button>
            ))}
          </div>
          {avisoNicho && (
            <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              {avisoNicho}
            </p>
          )}
          {!ehDono && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Só o Dono da loja pode mudar o tipo da loja.</p>}
        </section>

        <section className={`${cardStyle} p-5`}>
          <h2 className="font-semibold mb-1">Aparência</h2>
          <p className="text-sm text-black/60 dark:text-white/60 mb-4">
            Escolha o modo claro ou o escuro. A escolha fica salva neste aparelho e vale em todas as telas do sistema. As artes de divulgação não
            mudam de cor com este modo.
          </p>
          <ThemeToggle />
        </section>
      </main>
    </>
  );
}
