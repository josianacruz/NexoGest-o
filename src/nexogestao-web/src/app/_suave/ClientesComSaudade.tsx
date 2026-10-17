"use client";

import { useEffect, useState } from "react";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import { separarNomeEslogan } from "../../lib/modulos";
import { useEmpresa } from "./EmpresaContext";
import Folha from "./Folha";
import { SUAVE } from "./tokens";

interface Sumido {
  id: number;
  nome: string;
  telefone: string;
  diasSemVir: number;
}

const DIAS = 45;
const chaveChamado = (empresaId: number, id: number) => `nexo_saudade_${empresaId}_${id}`;

// Chamado hoje? Guarda a data para o cartão não insistir no mesmo cliente no mesmo dia.
function chamadoHoje(empresaId: number, id: number) {
  try {
    return localStorage.getItem(chaveChamado(empresaId, id)) === new Date().toDateString();
  } catch {
    return false;
  }
}

function marcarChamado(empresaId: number, id: number) {
  try {
    localStorage.setItem(chaveChamado(empresaId, id), new Date().toDateString());
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

// Clientes que não voltam há mais de 45 dias: um toque abre o WhatsApp com a mensagem pronta e o link para agendar.
// Nada é enviado sozinho (sem custo): a dona confere e envia no próprio WhatsApp.
export default function ClientesComSaudade() {
  const { empresa, api } = useEmpresa();
  const [lista, setLista] = useState<Sumido[]>([]);
  const [aberto, setAberto] = useState(false);
  const [chamados, setChamados] = useState<Set<number>>(new Set());
  const tem = empresa?.modulos.includes("Clientes");

  useEffect(() => {
    if (!empresa || !tem) return;
    (async () => {
      try {
        const r = await api(`/clientes/sumidos?dias=${DIAS}`);
        if (!r.ok) return;
        const dados: Sumido[] = await r.json();
        setLista(dados);
        setChamados(new Set(dados.filter((c) => chamadoHoje(empresa.id, c.id)).map((c) => c.id)));
      } catch {
        /* o cartão só não aparece */
      }
    })();
  }, [empresa?.id]);

  if (!empresa || !tem || lista.length === 0) return null;

  const nomeLoja = separarNomeEslogan(empresa.nome).nome;
  const temAgenda = empresa.modulos.includes("Agenda");
  const linkAgendar = typeof window !== "undefined" ? `${window.location.origin}/agendar/${empresa.id}` : "";

  function mensagem(c: Sumido) {
    const primeiro = c.nome.split(" ")[0];
    return `Oi, ${primeiro}! Aqui é do ${nomeLoja}. Estamos com saudade de você 💖${temAgenda && linkAgendar ? `\n\nQuando quiser voltar, é só escolher o melhor horário aqui: ${linkAgendar}` : "\n\nQuando quiser voltar, é só me chamar por aqui."}`;
  }

  return (
    <section aria-label="Clientes com saudade">
      <button type="button" onClick={() => setAberto(true)} className={`${SUAVE.cartaoClicavel} flex w-full items-center gap-3 p-4 text-left`}>
        <span className="text-2xl" aria-hidden="true">
          💌
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Clientes com saudade</span>
          <span className={`block text-sm ${SUAVE.textoSuave}`}>
            {lista.length} {lista.length === 1 ? "cliente não volta" : "clientes não voltam"} há mais de {DIAS} dias
          </span>
        </span>
        <span className={`${SUAVE.selo} ${SUAVE.seloInfo}`}>Chamar</span>
      </button>

      {aberto && (
        <Folha titulo="Clientes com saudade" subtitulo={`Não voltam há mais de ${DIAS} dias · toque em Chamar`} aoFechar={() => setAberto(false)}>
          <ul className="grid gap-2 overflow-y-auto px-5 pb-5 pt-3">
            {lista.map((c) => {
              const link = criarLinkWhatsApp(c.telefone, mensagem(c));
              const feito = chamados.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nome}</p>
                    <p className={`text-sm ${SUAVE.textoSuave}`}>Última vez há {c.diasSemVir} dias</p>
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        marcarChamado(empresa!.id, c.id);
                        setChamados((s) => new Set(s).add(c.id));
                      }}
                      className={`${SUAVE.botaoPequeno} shrink-0 ${feito ? SUAVE.seloNeutro : SUAVE.seloOk}`}
                    >
                      {feito ? "Chamada hoje" : "Chamar"}
                    </a>
                  ) : (
                    <span className={`${SUAVE.selo} shrink-0 ${SUAVE.seloAviso}`}>Telefone inválido</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Folha>
      )}
    </section>
  );
}
