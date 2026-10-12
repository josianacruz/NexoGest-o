# Como voltar ao visual antigo (ou comparar)

A versão com o visual antigo (menu no topo, em todas as telas) está guardada no GitHub de duas formas:

- **Tag** `visual-antigo` e **branch** `backup/visual-antigo` (commit `6cef127`): o sistema exatamente como estava antes do visual suave.
- **Tag** `visual-suave-etapa1`: só Início e Clientes no visual suave.

## Ver o visual antigo rodando (sem perder nada do atual)

```bash
git worktree add ../NexoGestao-visual-antigo visual-antigo
```

Isso cria uma pasta separada com o visual antigo; abra o projeto lá e rode normalmente. Para remover depois:
`git worktree remove ../NexoGestao-visual-antigo`.

## Desistir do visual suave em produção

Enquanto a `main` não recebeu o merge, **basta não fazer o merge**: produção continua no visual antigo.
Depois do merge, no Render/Vercel use *Redeploy* do deploy anterior (como no `DEPLOY-AFILIADOS.md`) ou peça para
reverter o merge com `git revert`. O banco não precisa voltar: as tabelas novas (Stories, mídias etc.) ficam sem uso
e o código antigo as ignora.

## Voltar só algumas telas

As telas do visual suave ficam em `src/nexogestao-web/src/app/(suave)/`. Para devolver uma tela ao visual antigo,
mova a pasta dela para `src/app/` (fora do grupo) e traga a versão antiga do arquivo:
`git checkout visual-antigo -- src/nexogestao-web/src/app/<tela>/page.tsx`.
