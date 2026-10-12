<#
  Aplica as migrations do NexoGestão num banco de DESENVOLVIMENTO remoto (ex.: um projeto Neon
  separado do de produção), sem que a connection string apareça em comando, tela ou arquivo.

  Como usar (no PowerShell, na raiz do repositório):
    1) Guarde a connection string só na sessão do seu terminal (ela some ao fechar a janela):
         $env:NEXO_DEV_CONNECTION = "<cole aqui a connection string do projeto DEV>"
       Aceita o formato URL do Neon (postgres://usuario:senha@ep-xxx.../neondb?sslmode=require)
       ou o formato Npgsql (Host=...;Database=...;Username=...;Password=...;Ssl Mode=Require).
    2) Veja o que seria aplicado, sem tocar no banco:
         ./tools/dev/aplicar-migrations-dev.ps1 -HostEsperado ep-xxxxx -SoGerarSql
    3) Aplique:
         ./tools/dev/aplicar-migrations-dev.ps1 -HostEsperado ep-xxxxx

  -HostEsperado é um pedaço do endereço do banco DEV (por exemplo, "ep-quiet-sky-123456"). Se o
  host da connection string não contiver esse texto, o script para antes de tocar em qualquer coisa.
  Assim, colar por engano a string de produção é barrado, desde que você use o trecho do host de DEV.
#>
param(
    [Parameter(Mandatory = $true)][string]$HostEsperado,
    [switch]$SoGerarSql
)

$ErrorActionPreference = "Stop"

$bruta = $env:NEXO_DEV_CONNECTION
if ([string]::IsNullOrWhiteSpace($bruta)) {
    throw "Defina primeiro: `$env:NEXO_DEV_CONNECTION = '<connection string do banco DEV>' (veja o topo deste arquivo)."
}

# Converte o formato URL (postgres://...) para o formato Npgsql.
if ($bruta -match '^postgres(ql)?://') {
    $uri = [System.Uri]$bruta
    $partes = $uri.UserInfo.Split(':', 2)
    $usuario = [System.Uri]::UnescapeDataString($partes[0])
    $senha = if ($partes.Length -gt 1) { [System.Uri]::UnescapeDataString($partes[1]) } else { "" }
    $banco = $uri.AbsolutePath.TrimStart('/')
    $porta = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $conexao = "Host=$($uri.Host);Port=$porta;Database=$banco;Username=$usuario;Password=$senha;Ssl Mode=Require"
    $hostBanco = $uri.Host
}
else {
    $conexao = $bruta
    $hostBanco = (($bruta -split ';' | Where-Object { $_ -match '^\s*Host\s*=' }) -replace '^\s*Host\s*=', '').Trim()
    $banco = (($bruta -split ';' | Where-Object { $_ -match '^\s*Database\s*=' }) -replace '^\s*Database\s*=', '').Trim()
}

if ([string]::IsNullOrWhiteSpace($hostBanco)) { throw "Não consegui ler o host da connection string." }
if ($hostBanco -notlike "*$HostEsperado*") {
    throw "Parei por segurança: o host da connection string ($hostBanco) não contém '$HostEsperado'. Nada foi alterado."
}

# Só host e nome do banco são mostrados; usuário e senha nunca.
Write-Host "Banco alvo: host = $hostBanco, database = $banco"

$projeto = "src/NexoGestao.Api"
if ($SoGerarSql) {
    $saida = Join-Path $env:TEMP "nexogestao-migrations-dev.sql"
    dotnet ef migrations script --idempotent --project $projeto --output $saida
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível gerar o script (veja a mensagem acima)." }
    Write-Host "Script SQL (idempotente) gerado em: $saida. Nada foi executado no banco."
    return
}

dotnet ef database update --project $projeto --connection $conexao
if ($LASTEXITCODE -ne 0) { throw "As migrations NÃO foram aplicadas (veja a mensagem acima)." }
Write-Host "Migrations aplicadas no banco DEV ($hostBanco)."
