"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:5104/weatherforecast")
      .then((res) => res.json())
      .then((data) => setDados(data))
      .catch((err) => setErro(err.message));
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Teste de conexão com o backend</h1>
      {erro && <p>Erro: {erro}</p>}
      {dados && <pre>{JSON.stringify(dados, null, 2)}</pre>}
      {!dados && !erro && <p>Carregando...</p>}
    </main>
  );
}