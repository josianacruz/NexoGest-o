<#
  Liga o módulo Afiliados para UMA empresa sua (ele não aparece sozinho para nenhuma empresa).
  Roda no seu computador: pede e-mail e senha aqui no terminal (a senha não aparece na tela e não é guardada).

  Uso:  ./tools/dev/habilitar-afiliados.ps1 -ApiUrl https://SEU-ENDERECO-DA-API [-EmpresaId 1]
  O script lista as empresas da sua conta e mantém TODOS os módulos que ela já tem, só acrescentando Afiliados
  (se mandasse só "Afiliados", a empresa perderia os outros módulos).
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiUrl,
    [int]$EmpresaId = 0
)

$ErrorActionPreference = "Stop"
$ApiUrl = $ApiUrl.TrimEnd('/')
if ($ApiUrl -notmatch '^https://' -and $ApiUrl -notmatch '^http://localhost') { throw "Use o endereço https da API." }

$email = Read-Host "E-mail"
$senhaSegura = Read-Host "Senha" -AsSecureString
$senha = [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura))

$login = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/auth/login" -ContentType "application/json" `
    -Body (@{ email = $email; senha = $senha } | ConvertTo-Json)
$senha = $null
$cab = @{ Authorization = "Bearer $($login.token)" }

$empresas = Invoke-RestMethod -Uri "$ApiUrl/api/empresas/minhas" -Headers $cab
$empresas | ForEach-Object { Write-Host ("  [{0}] {1} (papel: {2}) módulos: {3}" -f $_.id, $_.nome, $_.papel, ($_.modulos -join ", ")) }

if ($EmpresaId -eq 0) {
    if ($empresas.Count -eq 1) { $EmpresaId = $empresas[0].id }
    else { throw "Você tem mais de uma empresa: rode de novo com -EmpresaId <número>." }
}
$empresa = $empresas | Where-Object { $_.id -eq $EmpresaId }
if (-not $empresa) { throw "Empresa $EmpresaId não encontrada na sua conta." }
if ($empresa.papel -ne "Dono") { throw "Só o Dono da empresa pode ligar módulos." }

$modulos = @($empresa.modulos) + @("Afiliados") | Select-Object -Unique
$corpo = @{ modulos = @($modulos | ForEach-Object { @{ modulo = $_; habilitado = $true } }) } | ConvertTo-Json -Depth 4
$res = Invoke-RestMethod -Method Put -Uri "$ApiUrl/api/empresas/$EmpresaId/modulos" -Headers $cab -ContentType "application/json" -Body $corpo
Write-Host "Módulos agora: $($res.modulos -join ', ')"
if ($res.modulos -notcontains "Afiliados") { throw "Não ficou ligado." }
Write-Host "Pronto. Entre no Nexo de novo para o menu 🎥 Afiliados aparecer."
