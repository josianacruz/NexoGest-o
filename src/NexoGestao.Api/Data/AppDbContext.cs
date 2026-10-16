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
    public DbSet<RegistroVendaSemEstoque> RegistrosVendaSemEstoque => Set<RegistroVendaSemEstoque>();
    public DbSet<ModuloEmpresa> ModulosEmpresa => Set<ModuloEmpresa>();
    public DbSet<Servico> Servicos => Set<Servico>();
    public DbSet<Agendamento> Agendamentos => Set<Agendamento>();
    public DbSet<ConfiguracaoAgenda> ConfiguracoesAgenda => Set<ConfiguracaoAgenda>();
    public DbSet<CobrancaAgendamento> CobrancasAgendamento => Set<CobrancaAgendamento>();
    public DbSet<VagaDivulgada> VagasDivulgadas => Set<VagaDivulgada>();
    public DbSet<Notificacao> Notificacoes => Set<Notificacao>();
    public DbSet<ConfiguracaoDiaSemana> ConfiguracoesDiaSemana => Set<ConfiguracaoDiaSemana>();
    public DbSet<Interesse> Interesses => Set<Interesse>();
    public DbSet<Pagamento> Pagamentos => Set<Pagamento>();
    public DbSet<ProdutoAfiliado> ProdutosAfiliados => Set<ProdutoAfiliado>();
    public DbSet<ConfiguracaoAfiliados> ConfiguracoesAfiliados => Set<ConfiguracaoAfiliados>();
    public DbSet<ConteudoAfiliado> ConteudosAfiliados => Set<ConteudoAfiliado>();
    public DbSet<VideoAfiliado> VideosAfiliados => Set<VideoAfiliado>();
    public DbSet<WorkerCredencial> WorkerCredenciais => Set<WorkerCredencial>();
    public DbSet<RadarConsulta> RadarConsultas => Set<RadarConsulta>();
    public DbSet<RadarExecucao> RadarExecucoes => Set<RadarExecucao>();
    public DbSet<ProdutoAfiliadoSnapshot> ProdutoAfiliadoSnapshots => Set<ProdutoAfiliadoSnapshot>();
    public DbSet<StoryLoja> StoriesLoja => Set<StoryLoja>();
    public DbSet<MidiaLoja> MidiasLoja => Set<MidiaLoja>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Cliente>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<Produto>().HasQueryFilter(p => EmpresaAtualId != null && p.EmpresaId == EmpresaAtualId);
        builder.Entity<Venda>().HasQueryFilter(v => EmpresaAtualId != null && v.EmpresaId == EmpresaAtualId);
        builder.Entity<Comanda>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<ContaReceber>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<RegistroVendaSemEstoque>().HasQueryFilter(r => EmpresaAtualId != null && r.EmpresaId == EmpresaAtualId);
        builder.Entity<Servico>().HasQueryFilter(s => EmpresaAtualId != null && s.EmpresaId == EmpresaAtualId);
        builder.Entity<Agendamento>().HasQueryFilter(a => EmpresaAtualId != null && a.EmpresaId == EmpresaAtualId);
        // Agenda do dia e horários livres: filtram por empresa e por faixa de data (e ignoram cancelados).
        builder.Entity<Agendamento>().HasIndex(a => new { a.EmpresaId, a.DataHora, a.Status });
        builder.Entity<ConfiguracaoAgenda>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<CobrancaAgendamento>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<VagaDivulgada>().HasQueryFilter(v => EmpresaAtualId != null && v.EmpresaId == EmpresaAtualId);
        builder.Entity<VagaDivulgada>().HasIndex(v => v.Token).IsUnique();
        builder.Entity<Notificacao>().HasQueryFilter(n => EmpresaAtualId != null && n.EmpresaId == EmpresaAtualId);
        builder.Entity<ConfiguracaoDiaSemana>().HasQueryFilter(d => EmpresaAtualId != null && d.EmpresaId == EmpresaAtualId);
        builder.Entity<Interesse>().HasQueryFilter(i => EmpresaAtualId != null && i.EmpresaId == EmpresaAtualId);
        builder.Entity<Pagamento>().HasQueryFilter(p => EmpresaAtualId != null && p.EmpresaId == EmpresaAtualId);
        builder.Entity<Produto>().HasIndex(p => p.LinkStoryToken).IsUnique();
        builder.Entity<ProdutoAfiliado>().HasQueryFilter(p => EmpresaAtualId != null && p.EmpresaId == EmpresaAtualId);
        // Mesmo link não pode ser cadastrado duas vezes na mesma empresa (evita
        // duplicação do item 1 dos requisitos); empresas diferentes podem
        // divulgar o mesmo produto sem conflito.
        builder.Entity<ProdutoAfiliado>().HasIndex(p => new { p.EmpresaId, p.LinkOriginal }).IsUnique();
        // Mesmo anúncio (loja+item) nunca duas vezes na mesma empresa, mesmo que o link venha em formatos diferentes.
        builder.Entity<ProdutoAfiliado>()
            .HasIndex(p => new { p.EmpresaId, p.ShopId, p.ItemId })
            .IsUnique()
            .HasFilter("\"ItemId\" IS NOT NULL");
        builder.Entity<ConfiguracaoAfiliados>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<ConfiguracaoAfiliados>().HasIndex(c => c.EmpresaId).IsUnique();
        builder.Entity<ConteudoAfiliado>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<ConteudoAfiliado>().HasIndex(c => c.ProdutoAfiliadoId).IsUnique();
        builder.Entity<VideoAfiliado>().HasQueryFilter(v => EmpresaAtualId != null && v.EmpresaId == EmpresaAtualId);
        builder.Entity<VideoAfiliado>().HasIndex(v => new { v.EmpresaId, v.Status });
        // Filtro por empresa nas telas; a autenticação do worker (pelo token) usa IgnoreQueryFilters só para achar a credencial.
        builder.Entity<WorkerCredencial>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<WorkerCredencial>().HasIndex(c => c.TokenHash).IsUnique();
        builder.Entity<RadarConsulta>().HasQueryFilter(c => EmpresaAtualId != null && c.EmpresaId == EmpresaAtualId);
        builder.Entity<RadarExecucao>().HasQueryFilter(e => EmpresaAtualId != null && e.EmpresaId == EmpresaAtualId);
        builder.Entity<RadarExecucao>().HasIndex(e => new { e.EmpresaId, e.Inicio });
        builder.Entity<ProdutoAfiliadoSnapshot>().HasQueryFilter(x => EmpresaAtualId != null && x.EmpresaId == EmpresaAtualId);
        builder.Entity<ProdutoAfiliadoSnapshot>().HasIndex(x => new { x.ProdutoAfiliadoId, x.DataConsulta });
        builder.Entity<Empresa>().Property(e => e.WhatsApp).HasMaxLength(20);
        builder.Entity<StoryLoja>().HasQueryFilter(s => EmpresaAtualId != null && s.EmpresaId == EmpresaAtualId);
        builder.Entity<StoryLoja>().Property(s => s.Texto).HasMaxLength(StoryLoja.MaxTexto);
        builder.Entity<StoryLoja>().HasIndex(s => new { s.EmpresaId, s.ExpiraEm });
        builder.Entity<StoryLoja>().HasOne(s => s.Midia).WithMany().HasForeignKey(s => s.MidiaId).OnDelete(DeleteBehavior.SetNull);
        builder.Entity<MidiaLoja>().HasQueryFilter(m => EmpresaAtualId != null && m.EmpresaId == EmpresaAtualId);
        builder.Entity<MidiaLoja>().HasIndex(m => new { m.EmpresaId, m.Hash }).IsUnique();
        builder.Entity<MidiaLoja>().HasIndex(m => new { m.EmpresaId, m.UltimoUsoEm });
        builder.Entity<MidiaLoja>().Property(m => m.Nome).HasMaxLength(80);
        builder.Entity<MidiaLoja>().Property(m => m.ContentType).HasMaxLength(30);
        builder.Entity<MidiaLoja>().Property(m => m.Hash).HasMaxLength(64);
        builder.Entity<Produto>().Property(p => p.AtributosJson).HasMaxLength(4000);
    }
}
