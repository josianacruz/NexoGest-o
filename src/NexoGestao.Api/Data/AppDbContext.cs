using Microsoft.EntityFrameworkCore;

namespace NexoGestao.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
}