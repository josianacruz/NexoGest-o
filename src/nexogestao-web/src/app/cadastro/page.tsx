"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, textoDoErro } from "../../lib/api";
import { definirEmpresaAtiva } from "../../lib/empresaAtiva";
import { TIPOS_DE_NEGOCIO } from "../../lib/tiposDeNegocio";
import { salvarSessao } from "../../lib/auth";
import ThemeToggle from "../_components/ThemeToggle";
import AvisoDeConexao from "../_components/AvisoDeConexao";
import { SUAVE } from "../_suave/tokens";

const DIAS_TESTE_GRATIS = 14;

interface ErroIdentity {
  code?: string;
  description?: string;
}

// O Identity (backend) só valida a senha na hora de enviar e devolve a mensagem em inglês
// (ex.: "Passwords must have at least one non alphanumeric character."). Como a pessoa só
// descobre a regra depois de tentar, traduzimos os códigos conhecidos para algo compreensível.
const ERROS_SENHA: Record<string, string> = {
  PasswordTooShort: "A senha precisa ter pelo menos 6 letras ou números.",
  PasswordRequiresNonAlphanumeric: "A senha precisa ter pelo menos um símbolo (ex.: @ ! # $ %).",
  PasswordRequiresDigit: "A senha precisa ter pelo menos um número.",
  PasswordRequiresLower: "A senha precisa ter pelo menos uma letra minúscula.",
  PasswordRequiresUpper: "A senha precisa ter pelo menos uma letra maiúscula.",
  DuplicateUserName: "Já existe uma conta com esse e-mail. Tente entrar em vez de criar outra.",
};

export default function CadastroPage() {
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [tipo, setTipo] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    if (tipo === null) {
      setErro("Escolha o tipo do seu negócio.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const emailLimpo = email.trim();

      const resRegistro = await apiFetch(`${API_URL}/api/auth/registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpo, senha }),
      });
      if (!resRegistro.ok) {
        const corpo: unknown = await resRegistro.json().catch(() => null);
        // Cadastros fechados (limite de contas) e excesso de tentativas respondem com { mensagem }.
        const mensagemDoServidor = corpo && !Array.isArray(corpo) ? (corpo as { mensagem?: string }).mensagem : undefined;
        if (mensagemDoServidor) throw new Error(mensagemDoServidor);
        const erros = Array.isArray(corpo) ? (corpo as ErroIdentity[]) : null;
        const primeiro = erros?.[0];
        const traduzido = primeiro?.code ? ERROS_SENHA[primeiro.code] : undefined;
        throw new Error(traduzido ?? primeiro?.description ?? "Não foi possível criar sua conta. Tente outro e-mail.");
      }

      const resLogin = await apiFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpo, senha }),
      });
      if (!resLogin.ok) throw new Error("Sua conta foi criada, mas não foi possível entrar automaticamente. Faça login.");
      const { token, refreshToken } = await resLogin.json();
      salvarSessao(token, refreshToken);

      const resEmpresa = await apiFetch(`${API_URL}/api/empresas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: nomeNegocio.trim(), tipoNegocio: tipo }),
      });
      if (!resEmpresa.ok) throw new Error("Sua conta foi criada, mas não foi possível configurar seu negócio. Tente novamente em instantes.");
      const empresa = await resEmpresa.json();
      definirEmpresaAtiva(empresa.id);

      router.push("/inicio");
    } catch (err) {
      setErro(textoDoErro(err, err instanceof Error ? err.message : "Não foi possível criar sua conta. Tente de novo."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className={`relative min-h-dvh ${SUAVE.pagina}`}>
      <AvisoDeConexao />
      <ThemeToggle suave className="absolute right-4 top-4" />
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className={`${SUAVE.cartao} w-full max-w-sm p-7`}>
          <h1 className="text-2xl font-bold tracking-tight">Teste grátis</h1>
          <p className={`mb-6 mt-1 text-sm ${SUAVE.textoSuave}`}>
            {DIAS_TESTE_GRATIS} dias grátis, sem necessidade de cartão de crédito.
          </p>

          <form onSubmit={handleSubmit} method="post" action="#" className="grid gap-4" autoComplete="on">
            <div>
              <label htmlFor="nomeNegocio" className={SUAVE.rotulo}>
                Nome do seu negócio
              </label>
              <input
                id="nomeNegocio"
                name="nomeNegocio"
                type="text"
                autoComplete="organization"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                required
                className={SUAVE.campo}
              />
            </div>
            <fieldset>
              <legend className={SUAVE.rotulo}>Qual é o tipo do seu negócio?</legend>
              <div role="radiogroup" aria-label="Tipo de negócio" className="grid gap-2">
                {TIPOS_DE_NEGOCIO.map((t) => {
                  const ativo = tipo === t.tipoNegocio;
                  return (
                    <button
                      key={t.perfil}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setTipo(t.tipoNegocio)}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left transition ${ativo ? "border-violet-300 bg-violet-100 ring-2 ring-violet-300 dark:border-violet-300/40 dark:bg-violet-300/20" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {t.icone}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{t.nome}</span>
                        <span className={`block text-xs ${SUAVE.textoSuave}`}>{t.exemplos}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <label htmlFor="email" className={SUAVE.rotulo}>
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                className={SUAVE.campo}
              />
            </div>
            <div>
              <label htmlFor="senha" className={SUAVE.rotulo}>
                Crie uma senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  name="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  className={`${SUAVE.campo} !pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {mostrarSenha ? "🙈" : "👁️"}
                </button>
              </div>
              <p className={`mt-1.5 text-xs ${SUAVE.textoFraco}`}>Pelo menos 6 caracteres, com letra maiúscula, minúscula, número e um símbolo.</p>
            </div>

            {erro && (
              <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                {erro}
              </p>
            )}
            <button type="submit" disabled={carregando} className={SUAVE.botaoPrimario}>
              {carregando ? "Criando sua conta…" : "Criar minha conta grátis"}
            </button>
            <p className={`text-center text-xs ${SUAVE.textoFraco}`}>
              Já tem conta?{" "}
              <Link href="/login" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
                Entrar
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
