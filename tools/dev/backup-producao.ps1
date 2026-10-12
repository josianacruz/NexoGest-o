<#
  Backup do banco de PRODUÇÃO (Neon) para um arquivo no SEU computador, antes de qualquer deploy com migrations.
  Roda só na sua máquina: a connection string fica numa variável da sessão e nunca é impressa nem gravada.

  Uso (PowerShell, na raiz do repositório):
    1) No Neon, abra o projeto de PRODUÇÃO > Connection details e copie a connection string (formato URL).
    2) $env:NEXO_PROD_CONNECTION = "<cole aqui>"
    3) ./tools/dev/backup-producao.ps1 -HostEsperado <início do host de produção, ex.: ep-nome-123456>
  O arquivo vai para %USERPROFILE%\NexoBackups\ (fora do repositório). Ele contém dados de clientes: não envie
  a ninguém e não suba para o GitHub. Feche a janela do PowerShell depois para apagar a variável.
#>
param(
    [Parameter(Mandatory = $true)][string]$HostEsperado
)

$ErrorActionPreference = "Stop"

$bruta = $env:NEXO_PROD_CONNECTION
if ([string]::IsNullOrWhiteSpace($bruta)) { throw "Defina primeiro: `$env:NEXO_PROD_CONNECTION = '<connection string de produção>'." }
if ($bruta -notmatch '^postgres(ql)?://') { throw "Use a connection string no formato URL (postgres://usuario:senha@host/banco?sslmode=require)." }

$uri = [System.Uri]$bruta
$partes = $uri.UserInfo.Split(':', 2)
$usuario = [System.Uri]::UnescapeDataString($partes[0])
$senha = if ($partes.Length -gt 1) { [System.Uri]::UnescapeDataString($partes[1]) } else { "" }
$banco = $uri.AbsolutePath.TrimStart('/')
$porta = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

if ($uri.Host -notlike "*$HostEsperado*") {
    throw "Parei por segurança: o host ($($uri.Host)) não contém '$HostEsperado'. Nada foi feito."
}
Write-Host "Banco de produção: host = $($uri.Host), database = $banco"

$pgdump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgdump) {
    $pgdump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgdump) { throw "pg_dump não encontrado. Instale o PostgreSQL (cliente) ou use o backup por branch no console do Neon." }
$pgrestore = Join-Path (Split-Path $pgdump) "pg_restore.exe"

$pasta = Join-Path $env:USERPROFILE "NexoBackups"
New-Item -ItemType Directory -Force $pasta | Out-Null
$arquivo = Join-Path $pasta ("nexo-producao-{0:yyyyMMdd-HHmm}.dump" -f (Get-Date))

$env:PGPASSWORD = $senha
$env:PGSSLMODE = "require"
try {
    & $pgdump -h $uri.Host -p $porta -U $usuario -d $banco --no-owner --no-privileges -Fc -f $arquivo
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (veja a mensagem acima; se falou de versão, instale um PostgreSQL cliente igual ou mais novo que o do Neon)." }
}
finally {
    Remove-Item Env:PGPASSWORD, Env:PGSSLMODE -ErrorAction SilentlyContinue
}

# Confere que o arquivo é legível e lista o que há nele.
$itens = & $pgrestore --list $arquivo | Measure-Object -Line
$tam = [math]::Round((Get-Item $arquivo).Length / 1MB, 2)
if ($tam -lt 0.01 -or $itens.Lines -lt 20) { throw "O backup parece vazio ou incompleto ($tam MB, $($itens.Lines) itens)." }
Write-Host "Backup pronto e verificado: $arquivo ($tam MB, $($itens.Lines) itens). Guarde em lugar seguro."
