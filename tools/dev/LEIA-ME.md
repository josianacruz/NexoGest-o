# Banco de desenvolvimento (Neon) — passo a passo

Objetivo: testar as migrations da branch `dev` num banco **separado e sem dados de clientes**
antes de qualquer coisa chegar na `main` (que faz deploy sozinho para produção).

## Por que um projeto novo, e não uma "branch" do Neon

Uma branch do Neon é uma **cópia dos dados** do banco de origem. Criar a partir do banco de
produção colocaria dados reais de clientes (nome, telefone, vendas) num ambiente de teste.
Um **projeto novo e vazio** não tem nada disso: o schema vem das migrations e os dados são
fictícios.

## O que só você pode fazer (login e conta)

1. Em https://console.neon.tech, clique em **New project**.
2. Nome: `nexogestao-dev`. Região: a mesma da produção, para ficar parecido. Confirme em **Create**.
   (Confira na tela de criação que o plano continua **Free**. Se o Neon pedir cartão, pare e me avise.)
3. Na tela do projeto, abra **Connection details** e copie a connection string. **Não cole no chat,
   no GitHub nem em arquivo.**
4. Anote só o começo do host (algo como `ep-quiet-sky-123456`). Esse trecho é o seu "cinto de segurança"
   no passo abaixo, e **não é segredo**.

## Aplicar as migrations (no seu terminal, não no meu)

No PowerShell, dentro da pasta do projeto:

```powershell
$env:NEXO_DEV_CONNECTION = "<cole aqui a connection string do projeto DEV>"
./tools/dev/aplicar-migrations-dev.ps1 -HostEsperado ep-quiet-sky-123456 -SoGerarSql   # só mostra o que seria feito
./tools/dev/aplicar-migrations-dev.ps1 -HostEsperado ep-quiet-sky-123456               # aplica
```

- A variável vale só nessa janela do PowerShell e some quando você a fecha.
- Se o host da string não contiver o trecho que você passou em `-HostEsperado`, o script para antes de
  tocar em qualquer coisa. Se você colar a string de **produção** por engano, ele barra (use sempre o
  trecho do host de **dev**).
- O script nunca imprime usuário nem senha, só host e nome do banco.

Depois disso, me avise que as migrations foram aplicadas. Os dados de teste (empresa, usuário e produtos
fictícios) eu crio por uma API apontada para esse banco, sem usar nenhum dado real.

## Atenção: a produção aplica migrations sozinha

`Program.cs` chama `db.Database.Migrate()` ao iniciar. Quando a `dev` for para a `main`, o Render vai
**aplicar automaticamente no banco de produção** as 7 migrations novas do módulo Afiliados (só criam
tabelas e colunas do módulo; não mexem em tabelas existentes). Por isso:

1. Teste primeiro no banco `nexogestao-dev` (acima).
2. Só então faça o merge na `main`, com aviso prévio.
3. Em produção, a Vercel precisa ter `NEXT_PUBLIC_API_URL` apontando para a API de produção, e o
   ambiente Preview não pode apontar para a API de produção se for usado para testes.

## Rotinas automáticas do GitHub (grátis)

- `.github/workflows/verificar.yml`: a cada mudança na `dev` ou `main` roda os testes da API e confere o site (tipos e build). Já vale quando chega na `main`.
- `.github/workflows/backup-diario.yml`: backup diário do Neon, **criptografado**, guardado 7 dias. **Está desligado**: só roda com a variável `BACKUP_ATIVO=true` e os segredos `NEXO_PROD_CONNECTION` e `BACKUP_SENHA`. O repositório é público, então nunca suba backup sem criptografia.
