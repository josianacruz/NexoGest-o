using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public int? EmpresaAtualId { get; set; }

    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<MembroEmpresa> MembrosEmpresa => Set<MembroEmpresa>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<Venda> Vendas => Set<Venda>();
    public DbSet<ItemVenda> ItensVenda => Set<ItemVenda>();
    public DbSet<Comanda> Comandas => Set<Comanda>();
    public DbSet<ItemComanda> ItensComanda => Set<ItemComanda>();
    public DbSet<ContaReceber> ContasReceber => Set<ContaReceber>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Cliente>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<Produto>().HasQueryFilter(p => EmpresaAtualId != null && p.EmpresaId == EmpresaAtualId);
        builder.Entity<Venda>().HasQueryFilter(v => EmpresaAtualId != null && v.EmpresaId == EmpresaAtualId);
        builder.Entity<Comanda>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<ContaReceber>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
    }
}
