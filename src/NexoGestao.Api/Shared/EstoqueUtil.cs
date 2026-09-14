using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;

namespace NexoGestao.Api.Shared;

// Evita a corrida "duas vendas simultâneas levando a última unidade": tranca a
// linha do produto no Postgres (FOR UPDATE) antes de ler o estoque, então uma
// segunda venda concorrente do mesmo produto só lê o valor depois que a
// primeira já commitou sua baixa — nunca as duas leem o mesmo estoque "1" e
// baixam cada uma achando que só ela vendeu.
public static class EstoqueUtil
{
    public static async Task<int> TravarEObterEstoqueAsync(AppDbContext context, int produtoId)
    {
        var valores = await context.Database
            .SqlQuery<int>($"SELECT \"Estoque\" FROM \"Produtos\" WHERE \"Id\" = {produtoId} FOR UPDATE")
            .ToListAsync();
        return valores.Count > 0 ? valores[0] : 0;
    }

    public static Task DefinirEstoqueAsync(AppDbContext context, int produtoId, int novoValor)
    {
        return context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"Produtos\" SET \"Estoque\" = {novoValor} WHERE \"Id\" = {produtoId}");
    }
}
