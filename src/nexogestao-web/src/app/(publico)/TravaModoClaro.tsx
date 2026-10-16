"use client";

import { useEffect } from "react";

// Mantém o modo claro enquanto a pessoa está nas páginas públicas e devolve o tema dela ao sair
// (navegação interna do sistema, sem recarregar a página).
export default function TravaModoClaro() {
  useEffect(() => {
    const html = document.documentElement;
    const estavaEscuro = html.classList.contains("dark") || html.dataset.temaEscuro === "1";
    html.classList.remove("dark");
    html.style.colorScheme = "light";
    return () => {
      html.style.colorScheme = "";
      delete html.dataset.temaEscuro;
      if (estavaEscuro) html.classList.add("dark");
    };
  }, []);
  return null;
}
