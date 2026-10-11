using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;

namespace NexoGestao.Api.Afiliados;

public record WorkerContato(string? Versao, string? Maquina, string? Pasta, long? EspacoUsadoBytes, long? EspacoLivreBytes);

public record WorkerConcluirRequest(
    string RoteiroJson, string Legenda, string Hashtags, string Categoria, string VersaoRoteiro,
    string? MateriaisJson, DateTime? MateriaisLidosEm, string? MusicaCredito,
    double? DuracaoSegundos, long? TamanhoBytes, double? TempoProcessamentoSegundos,
    string? ArquivoRelativo, string? ArquivoLocal, string? Mensagem,
    string? NomeProduto, string? ImagemUrl, string? CategoriaProduto);

// Tipo: "SemMateriais" ou "Erro".
public record WorkerFalharRequest(string Tipo, string Mensagem);

// Lado do WORKER local: ele só faz conexões de saída até aqui (nenhuma porta aberta no PC dele).
// Autentica por um token próprio da empresa (X-Worker-Token), revogável; não usa o login de usuário.
// Toda consulta passa pelo filtro global de empresa (EmpresaAtualId definido a partir do token),
// então um worker nunca enxerga tarefas, produtos ou arquivos de outra empresa.
[ApiController]
[Route("api/worker")]
[AllowAnonymous]
[EnableRateLimiting("worker")]
public class WorkerController : ControllerBase
{
    public const int MinutosDeLease = 3;
    public const int TentativasMaximas = 2;

    private readonly AppDbContext _db;

    public WorkerController(AppDbContext db) => _db = db;

    public static string HashDoToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task<WorkerCredencial?> AutenticarAsync()
    {
        if (!Request.Headers.TryGetValue("X-Worker-Token", out var valor)) return null;
        var token = valor.ToString();
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return null;

        var hash = HashDoToken(token);
        var credencial = await _db.WorkerCredenciais.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TokenHash == hash && c.RevogadaEm == null);
        if (credencial is null) return null;

        _db.EmpresaAtualId = credencial.EmpresaId;
        return credencial;
    }

    private static string? Corta(string? texto, int max) =>
        texto is null ? null : (texto.Length <= max ? texto : texto[..max]);

    private IActionResult NaoAutorizado() =>
        Unauthorized(new { mensagem = "Credencial do worker inválida ou revogada." });

    // Confere se o token vale (usado por "NexoWorker --verificar"); não mexe em tarefas.
    [HttpGet("ping")]
    public async Task<IActionResult> Ping()
    {
        var credencial = await AutenticarAsync();
        if (credencial is null) return NaoAutorizado();
        credencial.UltimoContato = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("proxima")]
    public async Task<IActionResult> Proxima(WorkerContato contato)
    {
        var credencial = await AutenticarAsync();
        if (credencial is null) return NaoAutorizado();

        var agora = DateTime.UtcNow;
        credencial.UltimoContato = agora;
        credencial.Versao = Corta(contato.Versao, 40);
        credencial.Maquina = Corta(contato.Maquina, 80);
        credencial.Pasta = Corta(contato.Pasta, 300);
        credencial.EspacoUsadoBytes = contato.EspacoUsadoBytes;
        credencial.EspacoLivreBytes = contato.EspacoLivreBytes;

        // Recupera tarefas interrompidas: o worker parou de renovar a "locação" (PC desligou, processo morreu).
        var vencidas = await _db.VideosAfiliados
            .Where(v => v.Status == StatusVideoAfiliado.Processando && v.LeaseAte != null && v.LeaseAte < agora)
            .ToListAsync();
        foreach (var v in vencidas)
        {
            v.LeaseAte = null;
            v.AtualizadoEm = agora;
            if (v.Tentativas >= TentativasMaximas)
            {
                v.Status = StatusVideoAfiliado.Erro;
                v.Mensagem = "A geração foi interrompida (o worker parou de responder) e as tentativas acabaram. Use \"Tentar de novo\".";
            }
            else
            {
                v.Status = StatusVideoAfiliado.Pendente;
                v.Mensagem = "A execução anterior foi interrompida; a tarefa voltou para a fila.";
            }
        }
        await _db.SaveChangesAsync();

        for (var tentativa = 0; tentativa < 3; tentativa++)
        {
            var candidato = await _db.VideosAfiliados
                .Where(v => v.Status == StatusVideoAfiliado.Pendente)
                .OrderBy(v => v.Id)
                .Select(v => v.Id)
                .FirstOrDefaultAsync();
            if (candidato == 0) return Ok(new { tarefa = (object?)null, motivo = "vazia" });

            // Reivindicação atômica: só um chamador consegue mudar Pendente -> Processando.
            var lease = agora.AddMinutes(MinutosDeLease);
            var linhas = await _db.VideosAfiliados
                .Where(v => v.Id == candidato && v.Status == StatusVideoAfiliado.Pendente)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(v => v.Status, StatusVideoAfiliado.Processando)
                    .SetProperty(v => v.Tentativas, v => v.Tentativas + 1)
                    .SetProperty(v => v.Mensagem, (string?)null)
                    .SetProperty(v => v.LeaseAte, lease)
                    .SetProperty(v => v.AtualizadoEm, agora));
            if (linhas != 1) continue;

            var video = await _db.VideosAfiliados.AsNoTracking().FirstAsync(v => v.Id == candidato);
            var produto = await _db.ProdutosAfiliados.AsNoTracking().FirstAsync(p => p.Id == video.ProdutoAfiliadoId);
            return Ok(new
            {
                tarefa = new
                {
                    video.Id,
                    video.EmpresaId,
                    video.Tentativas,
                    video.ObservacaoRevisao,
                    Produto = new { produto.Id, produto.Nome, produto.LinkOriginal, produto.LinkAfiliado, produto.ItemId, produto.ImagemUrl, produto.Categoria },
                },
                motivo = (string?)null,
            });
        }

        return Ok(new { tarefa = (object?)null, motivo = "vazia" });
    }

    // O worker avisa que está vivo (renova a locação).
    [HttpPost("{videoId:int}/batimento")]
    public async Task<IActionResult> Batimento(int videoId)
    {
        if (await AutenticarAsync() is null) return NaoAutorizado();

        var video = await _db.VideosAfiliados.FirstOrDefaultAsync(v => v.Id == videoId);
        // "cancelar" fica reservado: se a tarefa não está mais em andamento, o worker deve parar.
        if (video is null || video.Status != StatusVideoAfiliado.Processando)
            return Ok(new { cancelar = true });

        video.LeaseAte = DateTime.UtcNow.AddMinutes(MinutosDeLease);
        await _db.SaveChangesAsync();
        return Ok(new { cancelar = false });
    }

    [HttpPost("{videoId:int}/concluir")]
    public async Task<IActionResult> Concluir(int videoId, WorkerConcluirRequest r)
    {
        if (await AutenticarAsync() is null) return NaoAutorizado();

        var video = await _db.VideosAfiliados.FirstOrDefaultAsync(v => v.Id == videoId);
        if (video is null) return NotFound(new { mensagem = "Tarefa não encontrada." });
        // Cancelada (ou já resolvida) enquanto o worker trabalhava: o resultado é descartado.
        if (video.Status != StatusVideoAfiliado.Processando)
            return Ok(new { descartado = true });

        if (r.ArquivoRelativo is not null &&
            (Path.IsPathRooted(r.ArquivoRelativo) || r.ArquivoRelativo.Contains("..")))
            return BadRequest(new { mensagem = "Caminho de arquivo inválido." });
        if (r.RoteiroJson.Length > 60_000)
            return BadRequest(new { mensagem = "Roteiro grande demais." });

        video.CategoriaDetectada = Corta(r.Categoria, 40);
        video.VersaoRoteiro = Corta(r.VersaoRoteiro, 60);
        video.RoteiroJson = r.RoteiroJson;
        video.Legenda = Corta(r.Legenda, 600);
        video.Hashtags = Corta(r.Hashtags, 600);
        video.MateriaisJson = Corta(r.MateriaisJson, 8000);
        video.MateriaisLidosEm = r.MateriaisLidosEm;
        video.MusicaCredito = Corta(r.MusicaCredito, 300);
        video.DuracaoSegundos = r.DuracaoSegundos;
        video.TamanhoBytes = r.TamanhoBytes;
        video.TempoProcessamentoSegundos = r.TempoProcessamentoSegundos;
        video.ArquivoRelativo = Corta(r.ArquivoRelativo, 300);
        video.ArquivoLocal = Corta(r.ArquivoLocal, 500);
        video.Mensagem = Corta(r.Mensagem, 600);
        video.Status = StatusVideoAfiliado.Pronto;
        video.LeaseAte = null;
        video.AtualizadoEm = DateTime.UtcNow;

        // Dados que o worker leu da página pública do anúncio completam o cadastro do produto (só campos vazios/truncados).
        var produto = await _db.ProdutosAfiliados.FirstOrDefaultAsync(p => p.Id == video.ProdutoAfiliadoId);
        if (produto is not null)
        {
            if (!string.IsNullOrWhiteSpace(r.NomeProduto) && r.NomeProduto.Length <= 300 &&
                r.NomeProduto.Length > produto.Nome.Trim().Length &&
                r.NomeProduto.StartsWith(produto.Nome.Trim(), StringComparison.OrdinalIgnoreCase))
                produto.Nome = r.NomeProduto;
            if (produto.ImagemUrl is null && Uri.TryCreate(r.ImagemUrl, UriKind.Absolute, out var u) &&
                u.Scheme == Uri.UriSchemeHttps && u.Host.EndsWith("susercontent.com", StringComparison.OrdinalIgnoreCase))
                produto.ImagemUrl = r.ImagemUrl;
            if (produto.Categoria is null && !string.IsNullOrWhiteSpace(r.CategoriaProduto))
                produto.Categoria = Corta(r.CategoriaProduto, 120);
        }

        await _db.SaveChangesAsync();
        return Ok(new { video.Id, Status = video.Status.ToString() });
    }

    [HttpPost("{videoId:int}/falhar")]
    public async Task<IActionResult> Falhar(int videoId, WorkerFalharRequest r)
    {
        if (await AutenticarAsync() is null) return NaoAutorizado();

        var video = await _db.VideosAfiliados.FirstOrDefaultAsync(v => v.Id == videoId);
        if (video is null) return NotFound(new { mensagem = "Tarefa não encontrada." });
        if (video.Status != StatusVideoAfiliado.Processando)
            return Ok(new { descartado = true });

        var mensagem = Corta(r.Mensagem, 600);
        switch (r.Tipo)
        {
            case "SemMateriais":
                video.Status = StatusVideoAfiliado.SemMateriais;
                video.Mensagem = mensagem;
                break;
            default:
                var final = video.Tentativas >= TentativasMaximas;
                video.Status = final ? StatusVideoAfiliado.Erro : StatusVideoAfiliado.Pendente;
                video.Mensagem = (final ? "Falhou após as tentativas: " : $"Tentativa {video.Tentativas} falhou, vai tentar de novo: ") + mensagem;
                break;
        }

        video.LeaseAte = null;
        video.AtualizadoEm = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { video.Id, Status = video.Status.ToString() });
    }
}
