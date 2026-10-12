"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";
import PageHeader from "../../_components/PageHeader";
import ThemeToggle from "../../_components/ThemeToggle";
import { inputStyle, labelStyle, botaoPrimario, cardStyle } from "../../_components/ui";
import { API_URL } from "../../../lib/api";
import { separarNomeEslogan } from "../../../lib/modulos";

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
        const e = empresas[0];
        setEmpresaId(e.id);
        setEmpresaNome(e.nome);
        setComandasHabilitadas(e.comandasHabilitadas ?? true);
        setPapel(e.papel ?? "");
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
