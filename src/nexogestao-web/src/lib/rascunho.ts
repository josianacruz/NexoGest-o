"use client";

import { useEffect, useRef } from "react";

// Rascunho automático de formulário: o que a pessoa digita é guardado no próprio aparelho (a cada pausa de 0,5 s) e só
// é apagado quando ela salva ou descarta. Assim, se o celular fechar o navegador, a bateria acabar ou a internet cair,
// o cadastro não precisa ser digitado de novo. Nada disso vai para o servidor.

const PREFIXO = "nexo_rascunho_";
const VALIDADE_MS = 3 * 24 * 60 * 60 * 1000; // rascunho esquecido some depois de 3 dias

export function lerRascunho<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const { quando, valor } = JSON.parse(bruto) as { quando: number; valor: T };
    if (Date.now() - quando > VALIDADE_MS) {
      localStorage.removeItem(PREFIXO + chave);
      return null;
    }
    return valor;
  } catch {
    return null;
  }
}

export function guardarRascunho<T>(chave: string, valor: T) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ quando: Date.now(), valor }));
  } catch {
    /* sem armazenamento (navegador privado/cheio): só não guarda */
  }
}

export function apagarRascunho(chave: string) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch {
    /* ignora */
  }
}

// Guarda `valor` enquanto `ativo` (formulário aberto) e `vazio(valor)` for falso. Não guarda formulário em branco.
export function useRascunho<T>(chave: string, valor: T, ativo: boolean, vazio: (v: T) => boolean) {
  const vazioRef = useRef(vazio);
  vazioRef.current = vazio;
  useEffect(() => {
    if (!ativo) return;
    const t = setTimeout(() => {
      if (vazioRef.current(valor)) apagarRascunho(chave);
      else guardarRascunho(chave, valor);
    }, 500);
    return () => clearTimeout(t);
  }, [chave, valor, ativo]);
}
