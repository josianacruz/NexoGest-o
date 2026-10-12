# NexoWorker: instalação e uso

O worker é o programa que **gera os vídeos no seu computador**. Ele pega a tarefa no Nexo, monta o vídeo
(fotos, narração, legendas e música) e deixa o MP4 numa pasta do próprio computador. O Nexo online guarda só o
texto e os dados; **nenhum vídeo vai para o servidor ou para o banco**.

Ele só faz conexões de **saída** (HTTPS) até o Nexo. **Nenhuma porta é aberta** no roteador e o computador não
fica exposto na internet.

## O que precisa ter instalado (tudo gratuito)

| Item | Para quê | Como instalar (Windows) |
|---|---|---|
| Python 3 | roda o gerador de vídeo | https://www.python.org/downloads/ (marque "Add python.exe to PATH") |
| edge-tts | voz em português | `pip install edge-tts` |
| FFmpeg | monta o vídeo | `winget install Gyan.FFmpeg` |
| Fonte Arial Bold | legendas | já vem no Windows (`C:\Windows\Fonts\arialbd.ttf`) |

Observações honestas:
- A voz usa o serviço gratuito da Microsoft Edge pela internet (a biblioteca `edge-tts` é **não oficial**; pode mudar
  ou parar de funcionar). Precisa de internet na hora de gerar.
- Para ler as fotos o worker acessa a página pública do anúncio na Shopee. Veja a seção "Regras da Shopee" no final.

## Instalar

1. Copie `NexoWorker.zip` para o computador e extraia numa pasta (ex.: `C:\NexoWorker`).
2. Copie `config.exemplo.json` para `config.json` e preencha:
   - `apiUrl`: o endereço da API do Nexo (https). Para testar no mesmo PC: `http://localhost:5104`.
   - `pastaSaida`: onde os vídeos ficam (padrão do exemplo: `C:\NexoVideos`). Escolha um disco com espaço.
3. No Nexo (Afiliados > **Worker de vídeo**), clique em **Criar credencial** e copie o código (ele só aparece uma vez).
4. No computador do worker, defina o código **só nesta máquina** (não coloque em arquivo do projeto):
   ```
   setx NEXO_WORKER_TOKEN "nxw_...o código copiado..."
   ```
   Feche e abra o terminal depois do `setx`.
5. Dê dois cliques em `verificar.bat`. Tem de aparecer tudo `[ok]` (Python, FFmpeg, edge-tts, conexão e token).
6. Dê dois cliques em `iniciar-worker.bat`. Deixe a janela aberta. Os vídeos pedidos no Nexo começam a ser gerados.

## Dia a dia

1. No Nexo: importe o CSV, filtre/ordene, marque os produtos e clique em **Gerar vídeos**.
2. No computador do worker, cada vídeo pronto aparece na pasta `pastaSaida\<empresa>\nome-do-produto_<id>.mp4`,
   com um `.txt` ao lado (legenda, hashtags, link original e link de afiliada).
3. Na tela "Vídeos" do Nexo cada cartão mostra o **caminho exato** do arquivo, a legenda e as hashtags para copiar.
4. Para publicar: copie o MP4 para o computador/celular de publicação (cabo USB, Google Drive ou WhatsApp para você
   mesma), publique na Shopee Vídeo e **adicione o produto ao vídeo** lá. O Nexo não publica nada sozinho.

Se o worker estiver desligado, os vídeos ficam na fila e são gerados quando ele ligar.

## Limites e consumo (medido num PC atual, 3 vídeos em sequência)

- Um vídeo por vez; no máximo 30 por hora (`maximoPorHora`); 2 tentativas por vídeo; tempo limite de 6 min por vídeo.
- Tempo: cerca de 60 a 72 s por vídeo. Tamanho: 1,2 a 1,9 MB por vídeo.
- Memória: **pico de ~960 MB** somando worker + Python + FFmpeg. Na máquina com 4 GB de RAM deve caber, mas **isso ainda
  não foi medido nela**; teste lá antes de depender.
- Espaço: nada é apagado automaticamente. O Nexo mostra o espaço ocupado e livre. A pasta `_trabalho` (temporária) é
  limpa a cada vídeo.

## Segurança

- O token é de **uma empresa só** e pode ser **revogado** a qualquer momento no Nexo (o worker para na hora).
- Se o token vazar, revogue e crie outro. Ele não dá acesso a nenhuma outra tela do Nexo.
- O log fica em `%LOCALAPPDATA%\NexoWorker\worker.log` (sem token).

## Regras da Shopee (leia)

Os Termos do Programa de Afiliados (atualização de 17/08/2026) proíbem raspagem automatizada de dados (cláusula 4.4(d))
e exigem autorização para usar propriedade intelectual de terceiros (cláusulas 2.2 e 4.3(b)). O worker lê **apenas a
página pública de cada produto que você escolheu**, um por vez, só para pegar título e fotos daquele anúncio, sem
login e sem percorrer listas. Mesmo assim, **o reuso das fotos dos anúncios em vídeo não está confirmado pela Shopee**:
confirme com o suporte do programa antes de publicar em escala.
