"use client";

import { useEffect } from "react";
import { configurarRenovacaoDeSessao } from "../../lib/sessao";

// Liga a renovação automática de sessão (ver lib/sessao.ts) uma única vez, assim que o app carrega —
// é o que faz a pessoa continuar logada ao reabrir o site depois do access token expirar.
export default function GerenciadorDeSessao() {
  useEffect(() => {
    configurarRenovacaoDeSessao();
  }, []);

  return null;
}
