using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Midias;
using NexoGestao.Api.Produtos;
using NexoGestao.Api.Stories;
using Xunit;

namespace NexoGestao.Tests;

// Biblioteca de fotos, nicho da loja e atributos por nicho.
public class MidiasENichoTests
{
    private const string Mini = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

    private static AppDbContext Banco() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ControllerContext Como(string usuario) => new()
    {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuario) }, "teste")) },
    };

    private static MidiasController Midias(AppDbContext db, string usuario) => new(db) { ControllerContext = Como(usuario) };
    private static StoriesController Stories(AppDbContext db, string usuario) => new(db) { ControllerContext = Como(usuario) };

    private static async Task<AppDbContext> Cenario()
    {
        var db = Banco();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Loja Um" });
        db.Empresas.Add(new Empresa { Id = 2, Nome = "Loja Dois" });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono1", EmpresaId = 1, Papel = PapelUsuario.Dono });
        db.MembrosEmpresa.Add(new MembroEmpresa { UsuarioId = "dono2", EmpresaId = 2, Papel = PapelUsuario.Dono });
        await db.SaveChangesAsync();
        return db;
    }

    private static byte[] Jpeg(int semente = 0, int tamanho = 200)
    {
        var b = new byte[tamanho];
        b[0] = 0xFF; b[1] = 0xD8; b[2] = 0xFF;
        for (var i = 3; i < tamanho; i++) b[i] = (byte)(i + semente);
        return b;
    }

    private static EnviarMidiaRequest Foto(byte[] bytes, string nome = "foto") => new(nome, Convert.ToBase64String(bytes), Mini);

    // ---------- biblioteca ----------

    [Fact]
    public async Task Envia_foto_e_ela_aparece_na_biblioteca_sem_os_bytes_na_lista()
    {
        var db = await Cenario();
        Assert.IsType<OkObjectResult>(await Midias(db, "dono1").Enviar(1, Foto(Jpeg())));

        var lista = Assert.IsType<OkObjectResult>(await Midias(db, "dono1").Recentes(1));
        var json = System.Text.Json.JsonSerializer.Serialize(lista.Value);
        Assert.Contains(Mini, json);
        Assert.DoesNotContain("Dados", json); // a lista só leva a miniatura
    }

    [Fact]
    public async Task A_mesma_foto_nao_entra_duas_vezes_e_volta_para_o_topo()
    {
        var db = await Cenario();
        var c = Midias(db, "dono1");
        await c.Enviar(1, Foto(Jpeg(1)));
        await c.Enviar(1, Foto(Jpeg(2)));
        var repetida = Assert.IsType<OkObjectResult>(await c.Enviar(1, Foto(Jpeg(1))));

        Assert.Equal(2, await db.MidiasLoja.IgnoreQueryFilters().CountAsync());
        Assert.Contains("jaExistia = True", repetida.Value!.ToString());
        var primeira = (await db.MidiasLoja.IgnoreQueryFilters().OrderByDescending(m => m.UltimoUsoEm).FirstAsync()).Hash;
        Assert.Equal(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Jpeg(1))).ToLowerInvariant(), primeira);
    }

    [Theory]
    [InlineData("texto qualquer, não é imagem")]
    [InlineData("<svg onload=alert(1)></svg>")]
    public async Task Recusa_arquivo_que_nao_e_foto_mesmo_com_nome_de_imagem(string conteudo)
    {
        var db = await Cenario();
        var r = await Midias(db, "dono1").Enviar(1, Foto(System.Text.Encoding.UTF8.GetBytes(conteudo), "foto.jpg"));
        Assert.IsType<BadRequestObjectResult>(r);
        Assert.Empty(await db.MidiasLoja.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Recusa_foto_grande_demais_e_miniatura_invalida_e_base64_quebrado()
    {
        var db = await Cenario();
        var c = Midias(db, "dono1");
        Assert.IsType<BadRequestObjectResult>(await c.Enviar(1, Foto(Jpeg(0, MidiaLoja.MaxBytes + 1))));
        Assert.IsType<BadRequestObjectResult>(await c.Enviar(1, new EnviarMidiaRequest("x", Convert.ToBase64String(Jpeg()), "data:text/html;base64,PHNjcmlwdD4=")));
        Assert.IsType<BadRequestObjectResult>(await c.Enviar(1, new EnviarMidiaRequest("x", "isso não é base64!!", Mini)));
        Assert.Empty(await db.MidiasLoja.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Biblioteca_de_outra_loja_e_invisivel_e_intocavel()
    {
        var db = await Cenario();
        await Midias(db, "dono1").Enviar(1, Foto(Jpeg()));
        var id = (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync()).Id;

        Assert.IsType<ForbidResult>(await Midias(db, "dono2").Recentes(1));
        Assert.IsType<ForbidResult>(await Midias(db, "dono2").Arquivo(1, id));
        Assert.IsType<NotFoundResult>(await Midias(db, "dono2").Arquivo(2, id));
        Assert.IsType<NotFoundResult>(await Midias(db, "dono2").Apagar(2, id));
        Assert.Equal(1, await db.MidiasLoja.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Biblioteca_cheia_remove_a_mais_antiga_que_nao_esta_em_uso()
    {
        var db = await Cenario();
        for (var i = 0; i < MidiaLoja.MaxNaBiblioteca; i++)
            db.MidiasLoja.Add(new MidiaLoja { EmpresaId = 1, Nome = $"f{i}", Dados = Jpeg(i), Miniatura = Mini, Hash = $"h{i}", UltimoUsoEm = DateTime.UtcNow.AddMinutes(-100 + i) });
        await db.SaveChangesAsync();
        // a mais antiga (f0) está numa novidade no ar: não pode sair; sai a seguinte (f1)
        var f0 = await db.MidiasLoja.IgnoreQueryFilters().SingleAsync(m => m.Nome == "f0");
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "no ar", MidiaId = f0.Id, ExpiraEm = DateTime.UtcNow.AddHours(3) });
        await db.SaveChangesAsync();

        Assert.IsType<OkObjectResult>(await Midias(db, "dono1").Enviar(1, Foto(Jpeg(99, 300), "nova")));

        var nomes = await db.MidiasLoja.IgnoreQueryFilters().Select(m => m.Nome).ToListAsync();
        Assert.Equal(MidiaLoja.MaxNaBiblioteca, nomes.Count);
        Assert.Contains("f0", nomes);
        Assert.DoesNotContain("f1", nomes);
        Assert.Contains("nova", nomes);
    }

    // ---------- stories com foto ----------

    [Fact]
    public async Task Story_com_foto_da_biblioteca_conta_o_uso_e_recusa_foto_de_outra_loja()
    {
        var db = await Cenario();
        await Midias(db, "dono1").Enviar(1, Foto(Jpeg(1)));
        await Midias(db, "dono2").Enviar(2, Foto(Jpeg(2)));
        var minha = (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync(m => m.EmpresaId == 1)).Id;
        var alheia = (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync(m => m.EmpresaId == 2)).Id;

        Assert.IsType<BadRequestObjectResult>(await Stories(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", "oi", alheia)));
        Assert.IsType<OkObjectResult>(await Stories(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", "olha a foto", minha)));

        Assert.Equal(1, (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync(m => m.Id == minha)).Usos);
        Assert.Equal(minha, (await db.StoriesLoja.IgnoreQueryFilters().SingleAsync()).MidiaId);
    }

    [Fact]
    public async Task Imagem_publica_so_de_novidade_no_ar_da_empresa_certa()
    {
        var db = await Cenario();
        await Midias(db, "dono1").Enviar(1, Foto(Jpeg(1)));
        var m = (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync()).Id;
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "no ar", MidiaId = m, ExpiraEm = DateTime.UtcNow.AddHours(3) });
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "expirada", MidiaId = m, ExpiraEm = DateTime.UtcNow.AddHours(-1) });
        db.StoriesLoja.Add(new StoryLoja { EmpresaId = 1, Texto = "sem foto", ExpiraEm = DateTime.UtcNow.AddHours(3) });
        await db.SaveChangesAsync();
        var ids = await db.StoriesLoja.IgnoreQueryFilters().OrderBy(s => s.Id).Select(s => s.Id).ToListAsync();

        var pub = new StoriesPublicosController(db) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        var ok = Assert.IsType<FileContentResult>(await pub.Imagem(1, ids[0]));
        Assert.Contains("max-age", pub.Response.Headers.CacheControl.ToString());
        Assert.Equal("image/jpeg", ok.ContentType);
        Assert.IsType<NotFoundResult>(await new StoriesPublicosController(db).Imagem(1, ids[1])); // expirada
        Assert.IsType<NotFoundResult>(await new StoriesPublicosController(db).Imagem(1, ids[2])); // sem foto
        Assert.IsType<NotFoundResult>(await new StoriesPublicosController(db).Imagem(2, ids[0])); // empresa errada
    }

    [Fact]
    public async Task Apagar_a_foto_nao_apaga_a_novidade()
    {
        var db = await Cenario();
        await Midias(db, "dono1").Enviar(1, Foto(Jpeg(1)));
        var m = (await db.MidiasLoja.IgnoreQueryFilters().SingleAsync()).Id;
        await Stories(db, "dono1").Criar(1, new CriarStoryRequest("Novidade", "texto fica", m));

        Assert.IsType<NoContentResult>(await Midias(db, "dono1").Apagar(1, m));
        // (o provedor em memória não aplica SET NULL; no PostgreSQL a FK faz isso — aqui só garantimos que a novidade segue existindo)
        Assert.Equal(1, await db.StoriesLoja.IgnoreQueryFilters().CountAsync());
    }

    // ---------- nicho e atributos ----------

    [Theory]
    [InlineData(TipoNegocio.Alimentacao, NichoLoja.Alimentos)]
    [InlineData(TipoNegocio.Beleza, NichoLoja.BelezaServicos)]
    [InlineData(TipoNegocio.Saude, NichoLoja.BelezaServicos)]
    [InlineData(TipoNegocio.Servicos, NichoLoja.BelezaServicos)]
    [InlineData(TipoNegocio.Comercio, NichoLoja.Outros)]
    public void Nicho_padrao_vem_do_tipo_de_negocio(TipoNegocio tipo, NichoLoja esperado) => Assert.Equal(esperado, Nichos.Padrao(tipo));

    [Fact]
    public void Nicho_escolhido_vale_mais_que_o_padrao()
    {
        Assert.Equal(NichoLoja.Moda, Nichos.Efetivo(new Empresa { TipoNegocio = TipoNegocio.Alimentacao, Nicho = NichoLoja.Moda }));
        Assert.Equal(NichoLoja.Outros, Nichos.Efetivo(new Empresa()));
    }

    [Fact]
    public void Atributos_de_alimentos_sao_limpos_e_guardados()
    {
        var (erro, json) = AtributosProdutoRegras.Sanitizar(new AtributosProduto(
            Adicionais: new() { new("  Bacon ", 3m), new("bacon", 9m), new("", 1m) },
            Ingredientes: " pão, carne ",
            Tamanhos: new() { new("Grande", 32m) }));
        Assert.Null(erro);
        var lido = AtributosProdutoRegras.Ler(json)!;
        Assert.Single(lido.Adicionais!);            // duplicado e vazio saíram
        Assert.Equal("Bacon", lido.Adicionais![0].Nome);
        Assert.Equal("pão, carne", lido.Ingredientes);
        Assert.Equal(32m, lido.Tamanhos![0].Preco);
    }

    [Fact]
    public void Atributos_de_moda_ordenam_a_grade_e_recusam_tamanho_fora_da_lista()
    {
        var (erro, json) = AtributosProdutoRegras.Sanitizar(new AtributosProduto(Cores: new() { "Preto", "preto", "Azul" }, Grade: new() { "g", "PP", "M" }));
        Assert.Null(erro);
        var lido = AtributosProdutoRegras.Ler(json)!;
        Assert.Equal(new[] { "PP", "M", "G" }, lido.Grade);
        Assert.Equal(new[] { "Preto", "Azul" }, lido.Cores);

        Assert.NotNull(AtributosProdutoRegras.Sanitizar(new AtributosProduto(Grade: new() { "XXXG" })).erro);
    }

    [Theory]
    [InlineData(4, false)]
    [InlineData(5, true)]
    [InlineData(600, true)]
    [InlineData(601, false)]
    public void Duracao_entre_5_e_600_minutos(int minutos, bool valido) =>
        Assert.Equal(valido, AtributosProdutoRegras.Sanitizar(new AtributosProduto(DuracaoMinutos: minutos)).erro is null);

    [Fact]
    public void Atributos_vazios_viram_nulo_e_limites_sao_respeitados()
    {
        Assert.Null(AtributosProdutoRegras.Sanitizar(new AtributosProduto()).json);
        Assert.Null(AtributosProdutoRegras.Sanitizar(null).json);

        var muitos = Enumerable.Range(0, 21).Select(i => new OpcaoComPreco($"a{i}", 1m)).ToList();
        Assert.NotNull(AtributosProdutoRegras.Sanitizar(new AtributosProduto(Adicionais: muitos)).erro);
        Assert.NotNull(AtributosProdutoRegras.Sanitizar(new AtributosProduto(Ingredientes: new string('x', 301))).erro);
        Assert.NotNull(AtributosProdutoRegras.Sanitizar(new AtributosProduto(Adicionais: new() { new("x", -1m) })).erro);
    }
}
