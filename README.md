# NexoGestão

Sistema de gestão SaaS multi-tenant (por empresa) para pequenos negócios:
clientes, produtos, vendas e comandas (mesas/pedidos abertos).

## Stack

- **Backend:** ASP.NET Core (`src/NexoGestao.Api`) + Entity Framework Core + PostgreSQL + ASP.NET Identity (JWT)
- **Frontend:** Next.js (`src/nexogestao-web`) + Tailwind CSS

## Pré-requisitos

- .NET SDK 10
- Node.js 20+
- PostgreSQL rodando localmente (ou acessível via connection string)

## Configuração inicial

### 1. Backend

O backend usa [User Secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets)
para dados sensíveis — nada disso fica no Git. Configure a partir de
`src/NexoGestao.Api`:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=nexogestao;Username=postgres;Password=SUASENHA"
dotnet user-secrets set "Jwt:Key" "uma-chave-secreta-bem-longa-e-aleatoria"
dotnet user-secrets set "Jwt:Issuer" "NexoGestao"
dotnet user-secrets set "Jwt:Audience" "NexoGestaoUsuarios"
dotnet user-secrets set "Jwt:ExpiresInMinutes" "60"
```

Depois, aplique as migrations para criar as tabelas no banco:

```bash
dotnet ef database update
```

Rodar a API:

```bash
dotnet run
```

Por padrão sobe em `http://localhost:5104` (perfil `http` do `launchSettings.json`).

### 2. Frontend

```bash
cd src/nexogestao-web
cp .env.local.example .env.local
npm install
npm run dev
```

Sobe em `http://localhost:3000`. A variável `NEXT_PUBLIC_API_URL` em
`.env.local` controla para qual API o frontend aponta — ajuste para a URL
de produção quando fizer deploy.

## Estrutura

```
src/NexoGestao.Api/    # API ASP.NET Core
  Auth/                # Registro e login (JWT)
  Empresas/             # Cadastro de empresa e membros (multi-tenant)
  Clientes/, Produtos/, Vendas/, Comandas/
  Domain/               # Entidades do banco
  Migrations/           # Migrations do EF Core

src/nexogestao-web/     # Frontend Next.js
  src/app/              # Uma pasta por tela (rota)
  src/app/_components/  # Componentes compartilhados (Nav)
  src/lib/              # Configuração (URL da API)
```

## Isolamento multi-tenant

Todo dado (clientes, produtos, vendas, comandas) pertence a uma empresa.
O acesso é sempre verificado via `TenantControllerBase.ObterEmpresaAutorizadaAsync`,
que confirma que o usuário logado é membro da empresa antes de liberar
qualquer operação, e o `AppDbContext` aplica um filtro global por empresa
nas consultas.

## Deploy

Veja [DEPLOY.md](DEPLOY.md) para colocar o projeto no ar gratuitamente
(Neon + Render + Vercel).

## Estado atual / limitações conhecidas

- Sem testes automatizados ainda.
- Sem pipeline de CI/CD.
- Sem tela de cadastro de usuário no frontend (só existe via API).
