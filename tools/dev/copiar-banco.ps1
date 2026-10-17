<#
  Copia TODO o banco de uma conexão para outra (ex.: Neon dos EUA -> Neon de São Paulo) e CONFERE linha por linha, tabela por tabela.
  Roda só na sua máquina. As duas connection strings ficam em variáveis da sessão e nunca são impressas nem gravadas.
  O banco de ORIGEM só é lido (pg_dump): nada é alterado nele. O banco de DESTINO precisa estar VAZIO (recém-criado).

  Uso (PowerShell, na raiz do repositório):
    $env:NEXO_ORIGEM  = "<connection string URL do banco atual>"
    $env:NEXO_DESTINO = "<connection string URL do banco NOVO e vazio>"
    ./tools/dev/copiar-banco.ps1 -HostOrigemEsperado <início do host atual> -HostDestinoEsperado <início do host novo>
  Para testar em bancos do seu computador, acrescente -SemSsl.
  Feche a janela do PowerShell depois para apagar as variáveis. O arquivo temporário é apagado ao final.
#>
param(
    [Parameter(Mandatory = $true)][string]$HostOrigemEsperado,
    [Parameter(Mandatory = $true)][string]$HostDestinoEsperado,
    [switch]$SemSsl
)

$ErrorActionPreference = "Stop"

function Ler-Conexao([string]$nomeVariavel, [string]$hostEsperado) {
    $bruta = [Environment]::GetEnvironmentVariable($nomeVariavel)
    if ([string]::IsNullOrWhiteSpace($bruta)) { throw "Defina primeiro: `$env:$nomeVariavel = '<connection string URL>'." }
    if ($bruta -notmatch '^postgres(ql)?://') { throw "$nomeVariavel precisa estar no formato URL (postgres://usuario:senha@host/banco?sslmode=require)." }
    $uri = [System.Uri]$bruta
    $partes = $uri.UserInfo.Split(':', 2)
    if ($uri.Host -notlike "*$hostEsperado*") { throw "Parei por segurança: o host de $nomeVariavel ($($uri.Host)) não contém '$hostEsperado'. Nada foi feito." }
    [pscustomobject]@{
        Host   = $uri.Host
        Porta  = $(if ($uri.Port -gt 0) { $uri.Port } else { 5432 })
        Usuario = [System.Uri]::UnescapeDataString($partes[0])
        Senha  = $(if ($partes.Length -gt 1) { [System.Uri]::UnescapeDataString($partes[1]) } else { "" })
        Banco  = $uri.AbsolutePath.TrimStart('/')
    }
}

$origem = Ler-Conexao "NEXO_ORIGEM" $HostOrigemEsperado
$destino = Ler-Conexao "NEXO_DESTINO" $HostDestinoEsperado
if ($origem.Host -eq $destino.Host -and $origem.Banco -eq $destino.Banco -and $origem.Porta -eq $destino.Porta) { throw "Origem e destino são o MESMO banco. Nada foi feito." }
Write-Host "Origem : $($origem.Host) / $($origem.Banco)"
Write-Host "Destino: $($destino.Host) / $($destino.Banco)"

function Achar-Ferramenta([string]$nome) {
    $c = (Get-Command $nome -ErrorAction SilentlyContinue).Source
    if (-not $c) { $c = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$nome.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName }
    if (-not $c) { throw "$nome não encontrado. Instale o PostgreSQL (cliente)." }
    $c
}
$pgdump = Achar-Ferramenta "pg_dump"
$pgrestore = Achar-Ferramenta "pg_restore"
$psql = Achar-Ferramenta "psql"

function Consultar($c, [string]$sql) {
    $env:PGPASSWORD = $c.Senha
    $env:PGSSLMODE = $(if ($SemSsl) { "disable" } else { "require" })
    try {
        $r = & $psql -h $c.Host -p $c.Porta -U $c.Usuario -d $c.Banco -v ON_ERROR_STOP=1 -At -c $sql
        if ($LASTEXITCODE -ne 0) { throw "psql falhou em $($c.Host)." }
        $r
    }
    finally { Remove-Item Env:PGPASSWORD, Env:PGSSLMODE -ErrorAction SilentlyContinue }
}

# O destino precisa estar vazio.
$tabelasNoDestino = [int](Consultar $destino "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
if ($tabelasNoDestino -ne 0) { throw "O banco de destino NÃO está vazio ($tabelasNoDestino tabelas). Crie um banco novo e vazio. Nada foi feito." }

$contagem = "SELECT table_name || ' = ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
$antes = @(Consultar $origem $contagem)
Write-Host "Origem tem $($antes.Count) tabelas."

$arquivo = Join-Path ([System.IO.Path]::GetTempPath()) ("nexo-copia-{0:yyyyMMdd-HHmmss}.dump" -f (Get-Date))
try {
    $env:PGPASSWORD = $origem.Senha
    $env:PGSSLMODE = $(if ($SemSsl) { "disable" } else { "require" })
    & $pgdump -h $origem.Host -p $origem.Porta -U $origem.Usuario -d $origem.Banco --no-owner --no-privileges -Fc -f $arquivo
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (se falou de versão, instale um PostgreSQL cliente igual ou mais novo que o do servidor)." }
    Remove-Item Env:PGPASSWORD, Env:PGSSLMODE -ErrorAction SilentlyContinue

    $env:PGPASSWORD = $destino.Senha
    $env:PGSSLMODE = $(if ($SemSsl) { "disable" } else { "require" })
    & $pgrestore -h $destino.Host -p $destino.Porta -U $destino.Usuario -d $destino.Banco --no-owner --no-privileges --exit-on-error $arquivo
    if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou. O banco de origem NÃO foi alterado; apague o banco de destino, crie outro vazio e tente de novo." }
}
finally {
    Remove-Item Env:PGPASSWORD, Env:PGSSLMODE -ErrorAction SilentlyContinue
    if (Test-Path $arquivo) { Remove-Item $arquivo -Force }
}

$depois = @(Consultar $destino $contagem)
$diferencas = Compare-Object $antes $depois
if ($diferencas) {
    Write-Host "DIFERENÇAS ENCONTRADAS:" -ForegroundColor Red
    $diferencas | ForEach-Object { Write-Host "  $($_.SideIndicator) $($_.InputObject)" }
    throw "A cópia NÃO bate com a origem. Não troque o sistema para o banco novo."
}
$total = ($antes | ForEach-Object { [int]($_ -replace '^.* = ', '') } | Measure-Object -Sum).Sum
Write-Host "Cópia conferida: $($antes.Count) tabelas e $total linhas, idênticas à origem (contagem por tabela)." -ForegroundColor Green
