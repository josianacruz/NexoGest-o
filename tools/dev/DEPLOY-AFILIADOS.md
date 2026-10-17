# Deploy do módulo Afiliados (dev → main)

Este roteiro vale para a publicação do módulo Afiliados, do worker de vídeo, do Radar, dos Stories da loja, da biblioteca de fotos e do nicho da loja. Nada aqui altera dados de
clientes: as migrations só **criam tabelas novas** (Afiliados, vídeos, credenciais do worker, Radar, Stories da loja, biblioteca de fotos) e **duas colunas novas, vazias e opcionais**, em `Empresas` (`Nicho`) e `Produtos` (`AtributosJson`). O ensaio feito
numa cópia local no estado da `main` aplicou as 9 migrations de Afiliados/Radar (a 10ª, `CriaStoriesDaLoja`, a 11ª, `AdicionaMidiasNichoEAtributos`, a 12ª, `AdicionaWhatsAppDaLoja` (coluna nova e vazia em `Empresas`) e a 13ª, `AdicionaIndiceAgendamentosPorDia` (troca o índice de `Agendamentos` por um que também cobre data e status) só criam tabelas, colunas ou índices novos; o ensaio com elas também preservou todas as linhas existentes) sem alterar nenhuma linha nem coluna das tabelas
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
  tabelas e colunas do Afiliados e dos Stories e as linhas dessas 13 migrations em `__EFMigrationsHistory`. É destrutivo para os dados
  do Afiliados, dos Stories, das fotos da biblioteca e do nicho da loja; use só depois de ter o backup e de reverter o código.
- **Restauração total**: `pg_restore` do arquivo gerado no passo 1 (ou restaurar a branch do Neon).

## Cuidados conhecidos

- No Render, as chaves de criptografia do ASP.NET (Data Protection) ficam no disco do contêiner e se perdem a cada
  reinício. Por isso **não guarde App ID/Secret da Shopee pelo cadastro criptografado em produção**: quando a Shopee
  liberar, use as variáveis de ambiente do Render (`Shopee__Affiliate__AppId` e `Shopee__Affiliate__AppSecret`).
- O agendamento das 8h (workflow do GitHub) só começa a valer com a `main` e com a variável `RADAR_ATIVO=true`;
  sem isso nada é disparado.
- `login` e `registrar` ainda não têm limite de tentativas, e Gerente/Atendente não têm permissões próprias
  (pendências já conhecidas, fora deste deploy).

## Desempenho (Render + Neon)

O que já está no código e vai junto com o deploy:

- **Compressão**: a API responde em Brotli/gzip (JSON de 3 a 10 vezes menor).
- **Uma consulta por chamada** nos horários livres, na página pública da loja e na checagem de acesso do painel (antes eram de 3 a 7 idas ao banco por chamada).
- **Índice** `(EmpresaId, DataHora, Status)` em `Agendamentos` e consulta por faixa de datas (usa o índice).
- **Limite de requisições** mais folgado só para leitura pública (120 por minuto por IP); criar agendamento continua em 15 por minuto.
- A página pública guarda a lista de serviços no aparelho (abre na hora na 2ª visita) e adianta os horários dos próximos dias.
- PDF e imagem do Story são gerados no navegador da cliente; o servidor não faz nada disso.

**Conexão com pooler do Neon (`-pooler`)** — é uma configuração do Render, não do código:

1. No Neon: *Connect* > ligar **Connection pooling** > copiar a string (o endereço tem `-pooler`).
2. No Render, em *Environment*, deixe `ConnectionStrings__DefaultConnection` com a string **com pooler** (consultas do dia a dia).
3. Crie também `ConnectionStrings__Migracoes` com a string **direta** (sem `-pooler`). A API usa essa só para aplicar migrations ao subir; o pooler (PgBouncer) não combina com o bloqueio que o EF usa para migrar. Sem essa variável, tudo funciona como antes.
4. Faça uma coisa de cada vez e confira o `/health` depois de cada troca. Para voltar atrás, basta colocar a string antiga.

Limites do plano grátis que **não** dá para resolver só com código: o Render dorme depois de alguns minutos sem uso (a primeira chamada leva de 30 a 60 s) e o Neon suspende o banco ocioso (cerca de 1 s para acordar). Manter os dois acordados com "pings" gasta as horas grátis do Neon, então não foi feito.

## Administradora máster (perfil Josiana) e perfis de acesso

- Quem é administradora: os e-mails da variável **`Admin__Emails`** no Render (separados por vírgula; é o e-mail com que a pessoa entra no sistema). Sem a variável, ninguém é administrador. Tirar um e-mail da lista revoga o acesso na hora, mesmo com o login aberto no celular.
- A administradora vê **todas as empresas** (seletor no topo do painel; empresas que não são dela aparecem como "suporte"), usa **todos os módulos** e tem o menu **Administração** (perfil de cada empresa e "Entrar neste ambiente"). A opção "Ver como a cliente" mostra só os módulos que a empresa realmente tem.
- Perfis por tipo de negócio (fonte única no servidor: `PerfisDeAcesso`). Valem na criação da empresa (escolha no cadastro), no primeiro acesso (janela "Qual é o seu tipo de negócio?", só para empresa nova sem tipo, criada nos últimos 3 dias) e no console **Administração**, que muda empresa a empresa e nunca automaticamente: **Beleza** = Agenda, Clientes, Serviços, Cobranças, Marketing, Relatórios; **Alimentação** = Clientes, Produtos, Vendas, Comandas, Cobranças, Marketing, Relatórios; **Varejo** = Clientes, Produtos, Vendas, Cobranças, Interesses, Marketing, Relatórios; **Serviços gerais** = Agenda, Clientes, Serviços, Vendas, Cobranças, Marketing, Relatórios; **Completo** = todos (menos Afiliados). Antes de aplicar, a tela mostra o que vai deixar de aparecer; nenhum dado é apagado.
- Ordem sugerida: 1) no Render, criar `Admin__Emails` com o seu e-mail; 2) entrar de novo no sistema; 3) abrir **Administração** e conferir as empresas ANTES de aplicar qualquer perfil (aplicar "Loja" ou "Salão" desliga os outros módulos dessa empresa, como Cobranças e Interesses).
