# Deploy do módulo Afiliados (dev → main)

Este roteiro vale para a publicação do módulo Afiliados, do worker de vídeo e do Radar. Nada aqui altera dados de
clientes: as migrations só **criam tabelas novas** (Afiliados, vídeos, credenciais do worker, Radar). O ensaio feito
numa cópia local no estado da `main` aplicou as 9 migrations novas sem alterar nenhuma linha nem coluna das tabelas
que já existem (`tools/dev/testar-migrations-em-copia.py`).

## Ordem

1. **Backup de produção (você)**: `tools/dev/backup-producao.ps1` (instruções no topo do arquivo). É obrigatório antes
   de qualquer migration. Alternativa no console do Neon: criar uma *branch* do projeto de produção (cópia instantânea).
2. **Publicar (eu, depois do seu aviso de que o backup existe)**: merge da `dev` na `main` e push. Isso dispara:
   - **Render**: reconstrói a API e, ao subir, aplica sozinho as migrations pendentes (`Database.Migrate()`).
   - **Vercel**: reconstrói o site.
   O plano grátis do Render pode levar alguns minutos para subir.
3. **Conferir** (eu): a API responde, as rotas novas existem (o worker sem token recebe 401 e o gatilho do Radar sem
   chave recebe 404), o site abre e o menu dos clientes continua igual.
4. **Ligar o Afiliados na sua empresa (você)**: `tools/dev/habilitar-afiliados.ps1 -ApiUrl <endereço da API>`.
   Nenhuma outra empresa recebe o módulo.
5. **Worker (você)**: no Nexo, Afiliados > Worker de vídeo > Criar credencial; instalar e iniciar o worker apontando
   para a API de produção (`tools/worker/INSTALACAO.md`).

## O que muda para os clientes existentes

Nada. O módulo Afiliados não aparece para empresas sem ligação explícita (inclusive as sem configuração de módulos,
que antes recebiam todos). Os demais módulos seguem exatamente como estão.

## Rollback

- **Código**: no Render, Deploys > escolher o deploy anterior > *Redeploy*; no Vercel, Deployments > anterior >
  *Promote to Production*; e `git revert` do merge na `main`. As tabelas novas ficam no banco sem uso (o código antigo
  as ignora), então voltar o código **não exige** mexer no banco.
- **Banco (só se for preciso remover as tabelas novas)**: `tools/dev/rollback-afiliados.sql`. Ele apaga apenas as
  tabelas e colunas do Afiliados e as linhas dessas 9 migrations em `__EFMigrationsHistory`. É destrutivo para os dados
  do Afiliados; use só depois de ter o backup e de reverter o código.
- **Restauração total**: `pg_restore` do arquivo gerado no passo 1 (ou restaurar a branch do Neon).

## Cuidados conhecidos

- No Render, as chaves de criptografia do ASP.NET (Data Protection) ficam no disco do contêiner e se perdem a cada
  reinício. Por isso **não guarde App ID/Secret da Shopee pelo cadastro criptografado em produção**: quando a Shopee
  liberar, use as variáveis de ambiente do Render (`Shopee__Affiliate__AppId` e `Shopee__Affiliate__AppSecret`).
- O agendamento das 8h (workflow do GitHub) só começa a valer com a `main` e com a variável `RADAR_ATIVO=true`;
  sem isso nada é disparado.
- `login` e `registrar` ainda não têm limite de tentativas, e Gerente/Atendente não têm permissões próprias
  (pendências já conhecidas, fora deste deploy).
