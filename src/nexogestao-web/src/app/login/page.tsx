"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, textoDoErro } from "../../lib/api";
import ThemeToggle from "../_components/ThemeToggle";
import AvisoDeConexao from "../_components/AvisoDeConexao";
import { SUAVE } from "../_suave/tokens";

const CHAVE_EMAIL = "nexo_email_lembrado"; // só o e-mail fica neste aparelho; a senha nunca é guardada pelo sistema

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  // Já preenche o e-mail de quem entrou antes neste aparelho.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_EMAIL);
      if (salvo) setEmail(salvo);
    } catch {
      /* sem armazenamento: digita */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    setCarregando(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      if (res.status === 429) throw new Error("Muitas tentativas. Aguarde um instante e tente de novo.");
      if (!res.ok) throw new Error("E-mail ou senha inválidos.");
      const data = await res.json();
      localStorage.setItem("nexo_token", data.token);
      try {
        if (lembrar) localStorage.setItem(CHAVE_EMAIL, email.trim());
        else localStorage.removeItem(CHAVE_EMAIL);
      } catch {
        /* ignora */
      }

      // Pede ao navegador/gerenciador de senhas do aparelho para oferecer "Salvar senha?". O sistema não guarda a senha:
      // quem guarda (e protege) é o próprio celular. Em navegadores sem essa função, o aviso normal do navegador aparece
      // porque o formulário está identificado como login (autocomplete username/current-password).
      try {
        const W = window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential };
        if (W.PasswordCredential && navigator.credentials?.store) {
          await navigator.credentials.store(new W.PasswordCredential({ id: email.trim(), password: senha, name: email.trim() }));
        }
      } catch {
        /* a pessoa recusou ou o navegador não suporta: segue o login */
      }
      router.push("/inicio");
    } catch (err) {
      setErro(textoDoErro(err, err instanceof Error ? err.message : "Não foi possível entrar. Tente de novo."));
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
          <h1 className="text-2xl font-bold tracking-tight">NexoGestão</h1>
          <p className={`mb-6 mt-1 text-sm ${SUAVE.textoSuave}`}>Entre para continuar</p>

          {/* name/id/autoComplete + method=post: é o que faz o navegador reconhecer o login e oferecer para guardar a senha */}
          <form onSubmit={handleSubmit} method="post" action="#" className="grid gap-4" autoComplete="on">
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
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  name="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
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
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-violet-500" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
              Lembrar meu e-mail neste aparelho
            </label>

            {erro && (
              <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                {erro}
              </p>
            )}
            <button type="submit" disabled={carregando} className={SUAVE.botaoPrimario}>
              {carregando ? "Entrando…" : "Entrar"}
            </button>
            <p className={`text-center text-xs ${SUAVE.textoFraco}`}>Depois de entrar, o celular pergunta se você quer guardar a senha.</p>
          </form>
        </div>
      </div>
    </main>
  );
}
