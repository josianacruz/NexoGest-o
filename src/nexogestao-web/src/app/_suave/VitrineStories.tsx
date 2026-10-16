"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { separarNomeEslogan } from "../../lib/modulos";
import { Anel, VerStory, tipoDaApi, type StoryVista } from "./StoriesVisual";
import { SUAVE } from "./tokens";

// Faixa de novidades que o CLIENTE vê na página pública da loja. Sem login; só lê o que o Dono publicou.
export default function VitrineStories({
  empresaId,
  textoBotao = "Agendar um horário",
  aoAgendar,
  mostrarNome = true,
  classeBotao,
}: {
  empresaId: number;
  textoBotao?: string;
  aoAgendar?: () => void;
  mostrarNome?: boolean; // a página que já mostra o nome da loja pode esconder o daqui
  classeBotao?: string; // estilo do botão do visualizador (padrão: botão do visual suave)
}) {
  const [nome, setNome] = useState<{ nome: string; slogan: string | null } | null>(null);
  const [lista, setLista] = useState<StoryVista[]>([]);
  const [vendo, setVendo] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    fetch(`${API_URL}/api/publico/empresas/${empresaId}/stories`)
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json();
        setNome(separarNomeEslogan(d.empresaNome ?? ""));
        setLista((d.stories as { id: number; tipo: string; texto: string; temImagem?: boolean }[]).map((s) => ({ id: String(s.id), tipo: tipoDaApi(s.tipo), texto: s.texto, imagemUrl: s.temImagem ? `${API_URL}/api/publico/empresas/${empresaId}/stories/${s.id}/imagem` : undefined })));
      })
      .catch(() => {
        /* sem novidades: a página segue normal */
      });
  }, [empresaId]);

  if (!nome) return null;

  return (
    <section aria-label="Novidades da loja" className="mb-6">
      {mostrarNome && nome.nome && (
        <div className="mb-3">
          <p className="text-base font-bold">{nome.nome}</p>
          {nome.slogan && <p className={`text-xs ${SUAVE.textoSuave}`}>{nome.slogan}</p>}
        </div>
      )}
      {lista.length > 0 && (
        <>
          <ul className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
            {lista.map((s, i) => (
              <li key={s.id} className="snap-start shrink-0">
                <Anel s={s} aoAbrir={() => setVendo(i)} />
              </li>
            ))}
          </ul>
          {vendo !== null && lista[vendo] && (
            <VerStory
              todos={lista}
              indice={vendo}
              aoMudar={setVendo}
              aoFechar={() => setVendo(null)}
              rodape={() =>
                aoAgendar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVendo(null);
                      aoAgendar();
                    }}
                    className={classeBotao ?? `${SUAVE.botaoPrimario} w-full`}
                  >
                    {textoBotao}
                  </button>
                ) : null
              }
            />
          )}
        </>
      )}
    </section>
  );
}
