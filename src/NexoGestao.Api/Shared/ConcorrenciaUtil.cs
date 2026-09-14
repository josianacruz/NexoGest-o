using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;

namespace NexoGestao.Api.Shared;

// Trava consultiva do Postgres (pg_advisory_xact_lock): serializa quem entra
// numa seção crítica pela mesma chave lógica, sem travar uma linha de tabela
// específica. Só libera sozinha no fim da transação (commit/rollback) — por
// isso todo uso precisa estar dentro de uma transação aberta.
public static class ConcorrenciaUtil
{
    public static Task TravarChaveAsync(AppDbContext context, string chave)
    {
        return context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({chave}))");
    }
}
