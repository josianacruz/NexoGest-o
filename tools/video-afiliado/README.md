# Gerador de vídeo de afiliado

Monta o vídeo vertical (roteiro falado → narração → cenas sincronizadas →
música de fundo) a partir de um arquivo `roteiro.json`. Mesmo script usado
localmente e (quando autorizado a ir pra `main`) pelo workflow do GitHub
Actions — não existem dois geradores, um só.

## Requisitos

- FFmpeg no PATH (ou `FFMPEG_BIN`/`FFPROBE_BIN` apontando pro binário).
- Python 3 com `pip install edge-tts`.
- Uma fonte `.ttf` (padrão: `fonte.ttf` no diretório de trabalho — no
  Ubuntu do GitHub Actions, `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`
  via `FONTE_TTF`).
- Uma trilha de música de fundo com licença adequada (ver abaixo).

## Uso

```
python gerar_video.py roteiro.json nome_da_saida
# gera nome_da_saida.mp4
```

## Formato do roteiro.json

```json
{
  "cenas": [
    {
      "fala": "Texto que vai ser narrado (frase curta, linguagem falada).",
      "legenda": "Texto da legenda — pode ser igual à fala ou mais curto.",
      "tom": "pergunta | explicacao | fechamento",
      "shots": [
        { "imagem": "foto.jpg", "crop": "W:H:X:Y ou null", "fracao": 0.5 }
      ]
    }
  ]
}
```

Regras de roteiro (não são sugestão, são requisito de uso real):

- Cada `fala` só pode afirmar o que está confirmado no anúncio/fotos do
  produto. Nunca inventar medida, material, desconto, depoimento,
  "últimas unidades", "veste perfeitamente" ou qualquer experiência pessoal.
- A chamada final é sempre uma só, no último trecho (`tom: "fechamento"`),
  variação de "Confira as medidas e opções no produto marcado" — não repetir
  "produto marcado" nas falas anteriores.
- Cada `crop` (recorte de uma foto real) deve corresponder ao que a fala
  daquele trecho está descrevendo (cintura → recorte da cintura, bolso →
  recorte que mostra o bolso). Nunca mostrar um ângulo/detalhe que a foto
  não tem de verdade.
- `tom` controla ritmo/entonação da narração (ver `TOM` no script):
  pergunta = um pouco mais viva; explicação = neutra; fechamento = mais
  pausada. Varie os tons ao longo do roteiro — um vídeo todo em "explicacao"
  soa monótono.
- Prepare pelo menos 2 versões (roteiro diferente, não só cor de texto) por
  produto quando for testar qual abertura performa melhor.

## Música de fundo

O script espera `musica_fundo.wav` (ou `MUSICA_FUNDO`) no diretório de
trabalho — **esse arquivo não fica no repositório** (binário grande, e cada
faixa tem sua própria licença/atribuição). Baixe antes de rodar:

**Faixa usada no teste da calça wide leg:**
"Luau, Hawaiian Ukulele Music" por Mikecolemusic, licença
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), via
Wikimedia Commons.
Origem: https://commons.wikimedia.org/wiki/File:Luau,_Hawaiian_Ukulele_Music.wav
Atribuição obrigatória ao publicar: "Música: Mikecolemusic, CC BY-SA 4.0, via Wikimedia Commons."

Pra trocar de faixa por nicho/produto, confirme sempre no Wikimedia Commons
(ou outra fonte com licença explícita e verificável) antes de usar — nunca
baixar música comercial nem assumir que um áudio popular pode ser
reaproveitado. Se não houver faixa licenciada adequada pro nicho, rode com
`MUSICA_FUNDO` apontando pra um arquivo de silêncio e entregue a versão sem
música.

## O que o script ainda NÃO faz

- Não decide sozinho o `roteiro.json` — hoje alguém escreve/ajusta o roteiro
  por produto (poucos minutos), usando `ConteudoAfiliadoGerador` (backend)
  como ponto de partida do texto.
- Não roda dentro da API do NexoGestão (sem FFmpeg no Render hoje, e não deve
  rodar no mesmo processo que atende clientes em produção).
- Animação de produto por IA (apresentadora virtual) não está implementada:
  exige GPU que o GitHub Actions gratuito não tem, e nenhuma ferramenta
  gratuita avaliada garante fidelidade exata do produto sem revisão manual.
