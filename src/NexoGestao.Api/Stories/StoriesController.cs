using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Stories;

public record CriarStoryRequest(string Tipo, string Texto, int? MidiaId = null);

// Stories da loja: o Dono publica uma novidade curta (24 h) e os clientes a veem na página pública de agendamento.
// Publicar e apagar é só do Dono (é conteúdo público); qualquer membro da empresa pode ver a lista.
[ApiController]
[Route("api/empresas/{empresaId:int}/stories")]
[Authorize]
public class StoriesController : TenantControllerBase
{
    public StoriesController(AppDbContext context) : base(context) { }

    private static object Projetar(StoryLoja s) => new { s.Id, Tipo = s.Tipo.ToString(), s.Texto, s.DataCriacao, s.ExpiraEm, TemImagem = s.MidiaId != null };

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        var agora = DateTime.UtcNow;
        var lista = await Context.StoriesLoja
            .Where(s => s.ExpiraEm > agora)
            .OrderByDescending(s => s.DataCriacao)
            .ToListAsync();

        return Ok(lista.Select(Projetar));
    }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarStoryRequest request)
    {
        if (await ObterEmpresaDonoAsync(empresaId) is null)
            return Forbid();

        if (!Enum.TryParse<TipoStory>(request.Tipo, true, out var tipo) || !Enum.IsDefined(tipo))
            return BadRequest(new { mensagem = "Tipo de novidade inválido." });

        var texto = (request.Texto ?? string.Empty).Trim();
        if (texto.Length == 0)
            return BadRequest(new { mensagem = "Escreva o texto da novidade." });
        if (texto.Length > StoryLoja.MaxTexto)
            return BadRequest(new { mensagem = $"O texto pode ter no máximo {StoryLoja.MaxTexto} caracteres." });

        var agora = DateTime.UtcNow;

        // Limpeza preguiçosa: o que expirou há mais de uma semana não serve mais para nada.
        var corte = agora.AddDays(-7);
        Context.StoriesLoja.RemoveRange(await Context.StoriesLoja.Where(s => s.ExpiraEm < corte).ToListAsync());

        // Limite para a página pública não virar um mural sem fim.
        var ativos = await Context.StoriesLoja.CountAsync(s => s.ExpiraEm > agora);
        if (ativos >= 10)
            return BadRequest(new { mensagem = "Você já tem 10 novidades no ar. Apague uma para publicar outra." });

        // A foto (opcional) precisa ser da biblioteca da própria loja; o filtro por empresa já garante isso.
        MidiaLoja? midia = null;
        if (request.MidiaId is not null)
        {
            midia = await Context.MidiasLoja.FirstOrDefaultAsync(m => m.Id == request.MidiaId);
            if (midia is null)
                return BadRequest(new { mensagem = "Foto não encontrada na sua biblioteca." });
            midia.Usos++;
            midia.UltimoUsoEm = agora;
        }

        var story = new StoryLoja
        {
            EmpresaId = empresaId,
            Tipo = tipo,
            Texto = texto,
            DataCriacao = agora,
            ExpiraEm = agora + StoryLoja.Validade,
            MidiaId = midia?.Id,
        };
        Context.StoriesLoja.Add(story);
        await Context.SaveChangesAsync();

        return Ok(Projetar(story));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Apagar(int empresaId, int id)
    {
        if (await ObterEmpresaDonoAsync(empresaId) is null)
            return Forbid();

        var story = await Context.StoriesLoja.FirstOrDefaultAsync(s => s.Id == id);
        if (story is null)
            return NotFound();

        Context.StoriesLoja.Remove(story);
        await Context.SaveChangesAsync();
        return NoContent();
    }
}

// Leitura pública (sem login) para a página onde o cliente agenda. Só devolve o que está no ar, sem dados internos.
[ApiController]
[Route("api/publico/empresas/{empresaId:int}/stories")]
[EnableRateLimiting("publico-leitura")]
public class StoriesPublicosController : ControllerBase
{
    private readonly AppDbContext Context;

    public StoriesPublicosController(AppDbContext context)
    {
        Context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        var empresaNome = await Context.Empresas.Where(e => e.Id == empresaId).Select(e => e.Nome).FirstOrDefaultAsync();
        if (empresaNome is null)
            return NotFound(new { mensagem = "Empresa não encontrada." });

        Context.EmpresaAtualId = empresaId;
        var agora = DateTime.UtcNow;
        var lista = await Context.StoriesLoja
            .Where(s => s.ExpiraEm > agora)
            .OrderByDescending(s => s.DataCriacao)
            .Take(10)
            .Select(s => new { s.Id, Tipo = s.Tipo.ToString(), s.Texto, s.DataCriacao, TemImagem = s.MidiaId != null })
            .ToListAsync();

        return Ok(new { empresaNome, stories = lista });
    }

    // Foto de uma novidade que está no ar. Só se acessa pelo id da novidade (nunca pela biblioteca inteira),
    // então não dá para listar as outras fotos da loja.
    [HttpGet("{storyId:int}/imagem")]
    public async Task<IActionResult> Imagem(int empresaId, int storyId)
    {
        Context.EmpresaAtualId = empresaId;
        var agora = DateTime.UtcNow;
        var m = await Context.StoriesLoja
            .Where(s => s.Id == storyId && s.ExpiraEm > agora && s.MidiaId != null)
            .Select(s => new { s.Midia!.Dados, s.Midia.ContentType })
            .FirstOrDefaultAsync();
        if (m is null)
            return NotFound();

        Response.Headers.CacheControl = "public, max-age=300";
        return File(m.Dados, m.ContentType);
    }
}
