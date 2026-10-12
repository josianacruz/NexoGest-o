<#
  Confere se a branch de backup do Neon é uma cópia fiel da produção: compara estrutura (tabelas e colunas), histórico
  de migrations e a contagem exata de linhas de cada tabela. SÓ LÊ (SELECT); não altera nada em nenhum dos dois.
  Roda no seu computador. As connection strings ficam em variáveis da sessão e nunca são impressas.

  Uso (PowerShell, na raiz do repositório):
    1) Abra o PowerShell na pasta do projeto e rode:  ./tools/dev/conferir-backup.ps1
    2) Ele pede, uma de cada vez, a connection string da branch `production` e a da branch `backup-antes-afiliados`.
       No Neon: Connection details > escolha a branch > botão de copiar. Cole quando ele pedir (não aparece na tela).
  (Alternativa: definir $env:NEXO_PROD_CONNECTION e $env:NEXO_BACKUP_CONNECTION antes, com a string real entre aspas simples.)
  Não cole as strings em chat, e-mail ou arquivos.
#>
param(
    [string]$SslMode = "require"
)

$ErrorActionPreference = "Stop"

function Ler-Conexao([string]$nomeVariavel, [string]$descricao) {
    $bruta = [Environment]::GetEnvironmentVariable($nomeVariavel)
    if ([string]::IsNullOrWhiteSpace($bruta)) {
        # Sem variável definida: pergunta aqui no terminal (o que você cola não aparece na tela).
        $segura = Read-Host "Cole a connection string da branch '$descricao' e aperte Enter" -AsSecureString
        $bruta = [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))
    }
    $colado = $bruta
    # Aceita a string pura ou embrulhada (psql '...', DATABASE_URL="...", com aspas, espaços ou quebra de linha).
    $achou = [regex]::Match($bruta, 'postgres(?:ql)?://[^\s''"`]+')
    $bruta = if ($achou.Success) { $achou.Value } else { $bruta.Trim() }
    if ($bruta -match '://[^@/]*:(\*+|•+|x+)@') {
        throw "A senha veio escondida (asteriscos). No Neon, ative 'Show password' (mostrar senha) em Connection details e copie de novo."
    }
    if ($bruta -notmatch '^postgres(ql)?://[^/\s]+@[^/\s]+/[^/\s?]+') {
        $inicio = $colado.Trim().Substring(0, [Math]::Min(12, $colado.Trim().Length))
        throw "O texto colado não parece uma connection string completa (recebi $($colado.Trim().Length) caracteres, começando com '$inicio'). Ela deve começar com postgresql:// e ter usuário, senha, @, o servidor e o nome do banco. Copie de novo pelo botão de copiar do Neon (Connection details)."
    }
    try { $u = [System.Uri]$bruta } catch { throw "Não consegui ler o endereço dessa connection string. Copie de novo, inteira, no botão de copiar do Neon." }
    $p = $u.UserInfo.Split(':', 2)
    [pscustomobject]@{
        Host = $u.Host
        Porta = $(if ($u.Port -gt 0) { $u.Port } else { 5432 })
        Banco = $u.AbsolutePath.TrimStart('/')
        Usuario = [System.Uri]::UnescapeDataString($p[0])
        Senha = $(if ($p.Length -gt 1) { [System.Uri]::UnescapeDataString($p[1]) } else { "" })
    }
}

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { throw "psql não encontrado (instale o cliente do PostgreSQL)." }

function Consulta($c, [string]$sql) {
    $env:PGPASSWORD = $c.Senha
    $env:PGSSLMODE = $SslMode
    try {
        # O SQL vai pela entrada padrão: assim as aspas duplas dos nomes de tabela chegam intactas no Windows PowerShell 5.1.
        $saida = $sql | & $psql -h $c.Host -p $c.Porta -U $c.Usuario -d $c.Banco -v ON_ERROR_STOP=1 -At -F "|"
        if ($LASTEXITCODE -ne 0) { throw "Consulta falhou em $($c.Host)." }
        return @($saida)
    }
    finally { Remove-Item Env:PGPASSWORD, Env:PGSSLMODE -ErrorAction SilentlyContinue }
}

$prod = Ler-Conexao "NEXO_PROD_CONNECTION" "production"
$bkp = Ler-Conexao "NEXO_BACKUP_CONNECTION" "backup-antes-afiliados"
if ($prod.Host -eq $bkp.Host -and $prod.Banco -eq $bkp.Banco) {
    throw "As duas strings apontam para o MESMO banco ($($prod.Host)/$($prod.Banco)). A do backup deve ser a da branch backup-antes-afiliados."
}
Write-Host "Produção: $($prod.Host) / $($prod.Banco)"
Write-Host "Backup:   $($bkp.Host) / $($bkp.Banco)"

# Estrutura: nome da coluna, tipo e se aceita nulo, de todas as tabelas.
$sqlEstrutura = "SELECT table_name||'.'||column_name||':'||data_type||':'||is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY 1"
$estP = Consulta $prod $sqlEstrutura
$estB = Consulta $bkp $sqlEstrutura
if ($estP.Count -eq 0) { throw "O banco de PRODUÇÃO não tem nenhuma tabela: confira se a string é da branch production e do banco certo." }
if ($estB.Count -eq 0) { throw "O banco do BACKUP não tem nenhuma tabela (vazio ou banco errado): confira se a string é da branch backup-antes-afiliados." }
$dif = Compare-Object $estP $estB
Write-Host ""
if ($dif) { Write-Host "ESTRUTURA: DIFERENTE ($(@($dif).Count) diferença(s))" -ForegroundColor Red; $dif | Select-Object -First 10 | ForEach-Object { Write-Host "   $($_.SideIndicator) $($_.InputObject)" } }
else { Write-Host "ESTRUTURA: igual ($($estP.Count) colunas em todas as tabelas)" -ForegroundColor Green }

# Migrations já aplicadas.
$sqlMig = 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1'
$migP = Consulta $prod $sqlMig
$migB = Consulta $bkp $sqlMig
if (Compare-Object $migP $migB) { Write-Host "MIGRATIONS: DIFERENTES" -ForegroundColor Red }
else { Write-Host "MIGRATIONS: iguais ($($migP.Count); a última é $($migP[-1]))" -ForegroundColor Green }

# Contagem EXATA de linhas de cada tabela.
$tabelas = Consulta $prod "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
$partes = $tabelas | ForEach-Object { "SELECT '$_' AS t, count(*) AS n FROM public.`"$_`"" }
$sqlContagem = ($partes -join " UNION ALL ") + " ORDER BY 1"
$cP = @{}; Consulta $prod $sqlContagem | ForEach-Object { $x = $_.Split('|'); $cP[$x[0]] = [int64]$x[1] }
$cB = @{}; Consulta $bkp $sqlContagem | ForEach-Object { $x = $_.Split('|'); $cB[$x[0]] = [int64]$x[1] }

Write-Host ""
Write-Host ("{0,-34} {1,10} {2,10}  {3}" -f "Tabela", "Produção", "Backup", "")
$diferentes = 0
foreach ($t in ($cP.Keys | Sort-Object)) {
    $b = if ($cB.ContainsKey($t)) { $cB[$t] } else { -1 }
    $igual = ($cP[$t] -eq $b)
    if (-not $igual) { $diferentes++ }
    Write-Host ("{0,-34} {1,10} {2,10}  {3}" -f $t, $cP[$t], $(if ($b -ge 0) { $b } else { "falta" }), $(if ($igual) { "ok" } else { "DIFERENTE" }))
}

$totalP = ($cP.Values | Measure-Object -Sum).Sum
Write-Host ""
if (-not $dif -and $diferentes -eq 0) {
    Write-Host "RESULTADO: o backup é igual à produção ($totalP linhas em $($cP.Count) tabelas)." -ForegroundColor Green
}
else {
    Write-Host "RESULTADO: há diferenças. Se a produção recebeu vendas/agendamentos depois que a branch foi criada, algumas contagens podem estar maiores na produção; isso é normal. Estrutura diferente ou tabela faltando NÃO é normal." -ForegroundColor Yellow
}
