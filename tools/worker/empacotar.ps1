<#
  Gera a pasta/zip do NexoWorker para instalar em OUTRO computador (ex.: a máquina antiga).
  Uso (PowerShell, na raiz do repositório):
      ./tools/worker/empacotar.ps1                       # usa a música de %USERPROFILE%\.nexo-worker\musica_fundo.wav
      ./tools/worker/empacotar.ps1 -Musica C:\caminho\musica.wav
  Saída: dist/NexoWorker/ e dist/NexoWorker.zip (dist/ não vai para o Git).
  O pacote NÃO leva token, senha nem connection string: o token é criado no Nexo (Afiliados > Worker)
  e informado só no computador do worker.
#>
param(
    [string]$Musica = (Join-Path $env:USERPROFILE ".nexo-worker\musica_fundo.wav")
)

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$saida = Join-Path $raiz "dist\NexoWorker"
if (Test-Path $saida) { Remove-Item $saida -Recurse -Force }
New-Item -ItemType Directory -Path $saida | Out-Null

if (-not (Test-Path $Musica)) { throw "Música não encontrada: $Musica (use -Musica <arquivo .wav>)." }

# Programa autocontido (não precisa instalar o .NET no outro computador).
dotnet publish (Join-Path $raiz "src\NexoGestao.Worker") -c Release -r win-x64 --self-contained true -o $saida
if ($LASTEXITCODE -ne 0) { throw "dotnet publish falhou." }

New-Item -ItemType Directory -Path (Join-Path $saida "gerador"), (Join-Path $saida "recursos") | Out-Null
Copy-Item (Join-Path $raiz "tools\video-afiliado\gerar_video.py") (Join-Path $saida "gerador\gerar_video.py")
Copy-Item $Musica (Join-Path $saida "recursos\musica_fundo.wav")
Copy-Item (Join-Path $PSScriptRoot "INSTALACAO.md") (Join-Path $saida "INSTALACAO.md")

@"
Música de fundo: "Luau, Hawaiian Ukulele Music" por Mikecolemusic, licença CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/), obtida no Wikimedia Commons. Ao publicar vídeos com essa
música, mantenha o crédito. Se trocar a música, atualize "musicaCredito" no config.json.
"@ | Set-Content (Join-Path $saida "recursos\MUSICA-CREDITO.txt") -Encoding utf8

@"
{
  "apiUrl": "https://COLOQUE-AQUI-O-ENDERECO-DA-API",
  "python": "python",
  "pastaFfmpeg": "",
  "pastaSaida": "C:\\NexoVideos",
  "musicaCredito": "\"Luau, Hawaiian Ukulele Music\" por Mikecolemusic, CC BY-SA 4.0, via Wikimedia Commons",
  "maximoPorHora": 30,
  "timeoutMinutos": 6
}
"@ | Set-Content (Join-Path $saida "config.exemplo.json") -Encoding utf8

@"
@echo off
rem Confere Python, FFmpeg, edge-tts e a conexão com a API. Antes: defina NEXO_WORKER_TOKEN (veja INSTALACAO.md).
set NEXO_WORKER_CONFIG=%~dp0config.json
"%~dp0NexoWorker.exe" --verificar
pause
"@ | Set-Content (Join-Path $saida "verificar.bat") -Encoding ascii

@"
@echo off
rem Liga o worker (uma tarefa por vez). Feche a janela ou use Ctrl+C para parar.
set NEXO_WORKER_CONFIG=%~dp0config.json
"%~dp0NexoWorker.exe"
pause
"@ | Set-Content (Join-Path $saida "iniciar-worker.bat") -Encoding ascii

$zip = Join-Path $raiz "dist\NexoWorker.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $saida "*") -DestinationPath $zip
$tam = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Pacote pronto: $zip ($tam MB). Copie para o outro computador e siga INSTALACAO.md."
