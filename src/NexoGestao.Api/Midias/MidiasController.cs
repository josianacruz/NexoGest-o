using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Midias;

public record EnviarMidiaRequest(string? Nome, string DadosBase64, string Miniatura);

// Biblioteca de fotos da loja ("Biblioteca rápida"): as últimas fotos usadas ficam à mão para reaproveitar em 1 toque.
// O navegador reduz a foto antes de enviar; aqui só se confere tamanho e tipo (pelos primeiros bytes, não pelo nome).
[ApiController]
[Route("api/empresas/{empresaId:int}/midias")]
[Authorize]
public class MidiasController : TenantControllerBase
{
    private static readonly Regex MiniaturaValida = new(@"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$", RegexOptions.Compiled);

    public MidiasController(AppDbContext context) : base(context) { }

    // Descobre o tipo olhando os primeiros bytes (JPEG, PNG ou WebP); qualquer outra coisa é recusada.
    public static string? TipoPelosBytes(byte[] b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> Recentes(int empresaId, [FromQuery] int limite = 24)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        var lista = await Context.MidiasLoja
            .OrderByDescending(m => m.UltimoUsoEm)
            .Take(Math.Clamp(limite, 1, MidiaLoja.MaxNaBiblioteca))
            .Select(m => new { m.Id, m.Nome, m.Miniatura, m.Usos, m.UltimoUsoEm })
            .ToListAsync();

        return Ok(lista);
    }

    [HttpPost]
    [RequestSizeLimit(1_000_000)]
    public async Task<IActionResult> Enviar(int empresaId, EnviarMidiaRequest request)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        byte[] dados;
        try { dados = Convert.FromBase64String(request.DadosBase64 ?? ""); }
        catch (FormatException) { return BadRequest(new { mensagem = "Foto inválida." }); }

        if (dados.Length == 0)
            return BadRequest(new { mensagem = "Foto inválida." });
        if (dados.Length > MidiaLoja.MaxBytes)
            return BadRequest(new { mensagem = "A foto ficou grande demais. Escolha outra ou tire de novo." });

        var tipo = TipoPelosBytes(dados);
        if (tipo is null)
            return BadRequest(new { mensagem = "Use uma foto JPG, PNG ou WebP." });

        var miniatura = request.Miniatura ?? "";
        if (miniatura.Length > MidiaLoja.MaxMiniatura || !MiniaturaValida.IsMatch(miniatura))
            return BadRequest(new { mensagem = "Miniatura inválida." });

        var hash = Convert.ToHexString(SHA256.HashData(dados)).ToLowerInvariant();
        var agora = DateTime.UtcNow;

        // A mesma foto não entra duas vezes: só volta para o topo da biblioteca.
        var existente = await Context.MidiasLoja.FirstOrDefaultAsync(m => m.Hash == hash);
        if (existente is not null)
        {
            existente.UltimoUsoEm = agora;
            await Context.SaveChangesAsync();
            return Ok(new { existente.Id, existente.Nome, existente.Miniatura, existente.Usos, existente.UltimoUsoEm, jaExistia = true });
        }

        // Biblioteca cheia: sai a mais antiga que não esteja numa novidade que ainda está no ar.
        var total = await Context.MidiasLoja.CountAsync();
        if (total >= MidiaLoja.MaxNaBiblioteca)
        {
            var precisaSair = total - MidiaLoja.MaxNaBiblioteca + 1;
            var emUso = await Context.StoriesLoja.Where(s => s.ExpiraEm > agora && s.MidiaId != null).Select(s => s.MidiaId!.Value).ToListAsync();
            var sobrar = await Context.MidiasLoja
                .Where(m => !emUso.Contains(m.Id))
                .OrderBy(m => m.UltimoUsoEm)
                .Take(precisaSair)
                .ToListAsync();
            if (sobrar.Count < precisaSair)
                return BadRequest(new { mensagem = "A biblioteca está cheia de fotos em uso. Apague alguma antes de enviar outra." });
            Context.MidiasLoja.RemoveRange(sobrar);
        }

        var nome = (request.Nome ?? "").Trim();
        if (nome.Length > 80) nome = nome[..80];

        var midia = new MidiaLoja
        {
            EmpresaId = empresaId,
            Nome = nome,
            ContentType = tipo,
            Dados = dados,
            Miniatura = miniatura,
            Hash = hash,
            Usos = 0,
            DataCriacao = agora,
            UltimoUsoEm = agora,
        };
        Context.MidiasLoja.Add(midia);
        await Context.SaveChangesAsync();

        return Ok(new { midia.Id, midia.Nome, midia.Miniatura, midia.Usos, midia.UltimoUsoEm, jaExistia = false });
    }

    // Foto inteira (para reaproveitar num produto, por exemplo). Exige login: a biblioteca é privada da loja.
    [HttpGet("{id:int}/arquivo")]
    public async Task<IActionResult> Arquivo(int empresaId, int id)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        var m = await Context.MidiasLoja.Where(x => x.Id == id).Select(x => new { x.Dados, x.ContentType }).FirstOrDefaultAsync();
        return m is null ? NotFound() : File(m.Dados, m.ContentType);
    }

    // Marca como usada (sobe para o começo da lista).
    [HttpPost("{id:int}/usar")]
    public async Task<IActionResult> Usar(int empresaId, int id)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        var m = await Context.MidiasLoja.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null)
            return NotFound();

        m.Usos++;
        m.UltimoUsoEm = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Apagar(int empresaId, int id)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId) is null)
            return Forbid();

        var m = await Context.MidiasLoja.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null)
            return NotFound();

        Context.MidiasLoja.Remove(m); // novidades que usavam a foto ficam sem foto (FK SetNull)
        await Context.SaveChangesAsync();
        return NoContent();
    }
}
