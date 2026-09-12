# Deploy gratuito do NexoGestão

Guia para colocar o NexoGestão no ar usando só camadas gratuitas:
**Neon** (banco PostgreSQL), **Render** (API ASP.NET Core) e **Vercel**
(frontend Next.js). Nenhum passo aqui pede cartão de crédito.

> No plano gratuito do Render, a API "dorme" depois de ~15 min sem uso — a
> primeira requisição depois disso demora uns 30-50s pra responder (ela está
> "acordando"). É normal na fase de teste; some quando você migrar pro plano
> pago do Render mais pra frente.

## 0. Contas necessárias (grátis)

Crie uma conta em cada um, se ainda não tiver:

- [GitHub](https://github.com/signup)
- [Neon](https://neon.tech) — pode entrar direto com a conta do GitHub
- [Render](https://render.com) — idem
- [Vercel](https://vercel.com) — idem

## 1. Subir o código pro GitHub

1. No GitHub, crie um repositório novo, **vazio** (sem README/gitignore).
2. Me passa a URL do repositório (algo como
   `https://github.com/seu-usuario/nexogestao.git`) que eu conecto e
   subo o código daqui.

## 2. Banco de dados (Neon)

1. Crie um projeto novo no Neon.
2. No painel do projeto, copie a **connection string** — o Neon mostra
   algo como:
   ```
   postgres://usuario:senha@ep-xxxxx.região.aws.neon.tech/neondb?sslmode=require
   ```
3. Converta para o formato que o Npgsql (biblioteca do backend) entende —
   troque os campos pelos mesmos valores da URL acima:
   ```
   Host=ep-xxxxx.região.aws.neon.tech;Database=neondb;Username=usuario;Password=senha;Ssl Mode=Require
   ```
   Guarde essa string — ela vai virar uma variável de ambiente no Render
   no próximo passo. (Você não vai rodar nenhuma migration manualmente: a
   API aplica as migrations pendentes sozinha ao iniciar.)

## 3. Backend (Render)

1. No Render, **New → Web Service**, conecte o repositório do GitHub.
2. Render deve detectar o `Dockerfile` em `src/NexoGestao.Api` automaticamente
   pela opção "Docker". Se pedir o caminho do Dockerfile, aponte para
   `src/NexoGestao.Api/Dockerfile` com contexto `src/NexoGestao.Api`.
3. Plano: **Free**.
4. Em **Environment**, adicione as variáveis (mesmos nomes usados nos seus
   User Secrets locais, mas com `__` no lugar de `:`):

   | Nome | Valor |
   |---|---|
   | `ConnectionStrings__DefaultConnection` | a connection string do Neon (passo 2) |
   | `Jwt__Key` | uma chave secreta longa e aleatória (pode gerar em https://generate-secret.vercel.app/32) |
   | `Jwt__Issuer` | `NexoGestao` |
   | `Jwt__Audience` | `NexoGestaoUsuarios` |
   | `Jwt__ExpiresInMinutes` | `60` |
   | `Cors__AllowedOrigins` | por enquanto deixe `http://localhost:3000` — você atualiza no passo 4 depois de ter a URL do Vercel |
   | `ASPNETCORE_ENVIRONMENT` | `Production` |

5. Deploy. Quando terminar, o Render te dá uma URL tipo
   `https://nexogestao-api.onrender.com` — guarde ela.

## 4. Frontend (Vercel)

1. No Vercel, **Add New → Project**, importe o mesmo repositório do GitHub.
2. Em **Root Directory**, selecione `src/nexogestao-web`.
3. Em **Environment Variables**, adicione:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | a URL do Render do passo 3 (sem barra no final) |

4. Deploy. O Vercel te dá uma URL tipo `https://nexogestao.vercel.app`.

## 5. Fechar o CORS

Volte no Render, edite a variável `Cors__AllowedOrigins` para a URL do
Vercel (ex: `https://nexogestao.vercel.app`), sem barra no final. Salvar
a variável reinicia o serviço automaticamente.

## Pronto

Acesse a URL do Vercel, registre um usuário (`/login` não tem link de
cadastro ainda — use a rota da API diretamente por enquanto, veja abaixo)
e comece a usar.

**Criar o primeiro usuário** (a tela de cadastro ainda não existe no
frontend — é uma boa próxima melhoria):
```bash
curl -X POST https://SUA-URL-DO-RENDER.onrender.com/api/auth/registrar \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com","senha":"SuaSenha123!"}'
```
Depois entre normalmente pela tela de login do Vercel.

## Dar acesso técnico a sócios

Se um sócio for ajudar de verdade no código, no backend, no banco — não é
acesso de usuário do sistema (login normal), é acesso de desenvolvedor
mesmo. São 4 lugares separados, um convite em cada:

1. **GitHub (código)** — no repositório, **Settings → Collaborators and
   teams → Add people**, com o usuário ou email do GitHub do sócio.
2. **Render (backend)** — clique no nome do workspace (canto superior
   esquerdo) → configurações do workspace/team → **Invite Member**.
3. **Vercel (site)** — no projeto, **Settings → Members** (pode pedir pra
   criar um "Team", já que hoje a conta é pessoal).
4. **Neon (banco de dados)** — no projeto, **Settings → People**.

Cada sócio precisa da própria conta gratuita em cada serviço — não dá pra
usar a mesma conta/senha de todo mundo.

> No Vercel, dependendo das regras do momento, colaborar num projeto às
> vezes empurra pra um plano "Team" que pode pedir cartão. Se isso
> acontecer na hora de convidar, é melhor combinar que só uma pessoa mexe
> no Vercel e os outros ficam com GitHub/Render/Neon.

## Monitorar o site com clientes de verdade usando

Quando tiver gente de verdade usando (ex: 5 clientes testando), os lugares
pra acompanhar se está tudo funcionando são:

- **Render → aba "Logs"** do serviço: mostra cada requisição e qualquer
  erro do backend em tempo real. É o primeiro lugar pra olhar se alguém
  reclamar de algo não funcionando.
- **Render → aba "Events"**: histórico de deploys e reinícios do serviço
  (útil pra saber se ele caiu sozinho em algum momento).
- **Neon → aba "Monitoring"**: uso de armazenamento e de "compute" do
  banco — vale checar de vez em quando pra não estourar o limite do plano
  gratuito conforme os clientes forem cadastrando dados de verdade.
- **Um monitor de "site no ar" gratuito** (recomendado): crie uma conta
  grátis no [UptimeRobot](https://uptimerobot.com) e cadastre a URL da API
  do Render (`https://nexogestao.onrender.com`) como um monitor HTTP(S).
  Ele testa o site a cada alguns minutos e te avisa por email/WhatsApp se
  cair — assim você fica sabendo antes do cliente reclamar, sem precisar
  ficar checando manualmente.

**Ponto de atenção real com clientes usando:** o plano gratuito do Render
"dorme" a API depois de ~15 min sem uso. Se um cliente abrir o site depois
de um tempo parado, a primeira ação demora uns 30-50s (ele está
"acordando"). Com 5 clientes testando, isso pode acontecer bastante e
parecer que "travou". Se virar reclamação constante, esse é o sinal de que
vale migrar o Render pro plano pago (a partir de uns $7/mês) — que remove
esse soninho.

## Se algo der errado

Me manda a mensagem de erro (ou um print) e de onde ela apareceu — os
logs do Render (aba "Logs" do serviço) e do Vercel (aba "Deployments" →
clique no deploy → "Logs") mostram a causa na maioria dos casos. Eu não
tenho acesso a esses painéis, então preciso que você copie o conteúdo.
