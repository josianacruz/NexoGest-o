"use client";

import { useEffect, useRef, useState } from "react";
import {
  abrirWhatsApp,
  mensagemAgradecerCompra,
  mensagemCobrarFiado,
  mensagemPromocaoPadrao,
  mensagemLinkAgendamento,
} from "../../lib/whatsapp";

interface WhatsAppMenuProps {
  nome: string;
  telefone?: string | null;
  saldoDevedor?: number | null;
  /** Se informado, mostra a opção "Enviar link de agendamento". */
  empresaId?: number | null;
  /** Chamado quando a ação não pode ser concluída (ex: sem telefone cadastrado). */
  onErro?: (mensagem: string) => void;
}

const itemStyle =
  "w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

export default function WhatsAppMenu({ nome, telefone, saldoDevedor, empresaId, onErro }: WhatsAppMenuProps) {
  const [aberto, setAberto] = useState(false);
  const [posicaoMenu, setPosicaoMenu] = useState({ top: 0, left: 0 });
  const [modalPromocaoAberto, setModalPromocaoAberto] = useState(false);
  const [textoPromocao, setTextoPromocao] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const temFiado = !!saldoDevedor && saldoDevedor > 0;

  useEffect(() => {
    function fecharAoClicarFora(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        botaoRef.current &&
        !botaoRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  function alternarMenu() {
    if (!aberto && botaoRef.current) {
      const rect = botaoRef.current.getBoundingClientRect();
      // Posição fixa (não "absolute") pra não ficar preso pelo scroll da tabela.
      setPosicaoMenu({ top: rect.bottom + 4, left: Math.max(8, rect.right - 208) });
    }
    setAberto((v) => !v);
  }

  function tentarAbrirWhatsApp(mensagem?: string) {
    setAberto(false);
    const abriu = abrirWhatsApp(telefone, mensagem);
    if (!abriu) {
      onErro?.("Este cliente não possui telefone cadastrado.");
    }
  }

  function confirmarPromocao() {
    setModalPromocaoAberto(false);
    tentarAbrirWhatsApp(textoPromocao.trim() || mensagemPromocaoPadrao(nome));
    setTextoPromocao("");
  }

  return (
    <div className="inline-block">
      <button
        ref={botaoRef}
        type="button"
        onClick={alternarMenu}
        title={`Chamar ${nome} no WhatsApp`}
        aria-label={`Chamar ${nome} no WhatsApp`}
        className="w-8 h-8 flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
      >
        <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M16.001 3C9.096 3 3.5 8.596 3.5 15.5c0 2.316.63 4.484 1.727 6.35L3 29l7.32-2.19a12.44 12.44 0 0 0 5.68 1.44h.001c6.905 0 12.5-5.596 12.5-12.5S22.906 3 16.001 3zm0 22.7h-.001a10.2 10.2 0 0 1-5.2-1.43l-.373-.222-3.87 1.159 1.176-3.77-.243-.387a10.17 10.17 0 0 1-1.59-5.55c0-5.632 4.578-10.2 10.203-10.2 5.624 0 10.199 4.568 10.199 10.2 0 5.633-4.575 10.2-10.201 10.2zm5.593-7.638c-.306-.153-1.81-.893-2.09-.994-.28-.102-.484-.153-.688.152-.204.306-.79.994-.968 1.198-.178.204-.356.23-.663.077-.306-.153-1.293-.477-2.463-1.52-.91-.812-1.525-1.815-1.703-2.121-.178-.306-.019-.471.134-.623.137-.137.306-.357.459-.535.153-.178.204-.306.306-.51.102-.204.05-.383-.026-.535-.077-.153-.688-1.658-.943-2.271-.248-.596-.5-.515-.688-.524l-.586-.01c-.204 0-.535.077-.815.383-.28.306-1.068 1.043-1.068 2.545s1.093 2.953 1.246 3.157c.153.204 2.152 3.286 5.213 4.607.728.314 1.296.502 1.739.642.731.232 1.396.199 1.922.121.586-.088 1.81-.74 2.065-1.454.255-.714.255-1.326.178-1.454-.076-.128-.28-.204-.586-.357z" />
        </svg>
      </button>

      {aberto && (
        <div
          ref={menuRef}
          style={{ top: posicaoMenu.top, left: posicaoMenu.left }}
          className="fixed w-52 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md shadow-lg z-20 overflow-hidden"
        >
          <button type="button" onClick={() => tentarAbrirWhatsApp()} className={itemStyle}>
            Conversar
          </button>
          <button
            type="button"
            onClick={() => tentarAbrirWhatsApp(mensagemCobrarFiado(nome, saldoDevedor ?? 0))}
            disabled={!temFiado}
            title={temFiado ? undefined : "Este cliente não tem valores pendentes"}
            className={itemStyle}
          >
            Cobrar fiado
          </button>
          <button
            type="button"
            onClick={() => tentarAbrirWhatsApp(mensagemAgradecerCompra(nome))}
            className={itemStyle}
          >
            Agradecer compra
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              setModalPromocaoAberto(true);
            }}
            className={itemStyle}
          >
            Enviar promoção
          </button>
          {empresaId && (
            <button
              type="button"
              onClick={() =>
                tentarAbrirWhatsApp(
                  mensagemLinkAgendamento(nome, `${window.location.origin}/agendar/${empresaId}`)
                )
              }
              className={itemStyle}
            >
              Enviar link de agendamento
            </button>
          )}
        </div>
      )}

      {modalPromocaoAberto && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-30 p-4"
          onClick={() => setModalPromocaoAberto(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl p-5 w-full max-w-sm shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">Mensagem para {nome}</h3>
            <textarea
              autoFocus
              value={textoPromocao}
              onChange={(e) => setTextoPromocao(e.target.value)}
              placeholder={mensagemPromocaoPadrao(nome)}
              rows={4}
              className="w-full px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalPromocaoAberto(false)}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarPromocao}
                className="px-4 py-1.5 text-sm rounded-md bg-green-600 text-white font-medium hover:bg-green-700"
              >
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
