"use client";

import { useEffect } from "react";

// Registra o service worker que permite "instalar" o NexoGestão na tela
// inicial do celular (PWA). Sem ele, o Android não oferece a opção de
// instalar o site como app.
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falha silenciosa: sem service worker, o site continua funcionando
        // normalmente, só não fica instalável.
      });
    }
  }, []);

  return null;
}
