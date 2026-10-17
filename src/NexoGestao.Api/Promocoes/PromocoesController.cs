using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;

namespace NexoGestao.Api.Promocoes;

public record CriarPromocaoRequest(int ServicoId, decimal PrecoPromocional, int Dias = 7, string? Titulo = null, string? Descricao = null);

// Promoções da loja: só a dona (Dono) cria e encerra; a cliente apenas VÊ as que estão no ar, pela página pública.
[ApiController]
[Route("api/empresas/{empresaId:int}/promocoes")]
[Authorize]
public class PromocoesController : TenantControllerBase
{
    public PromocoesController(AppDbContext context) : base(context) { }

    [HttpGet]
    public async Task<IActionResult> Listar(int empresaId)
    {
        if (await ObterEmpresaAutorizadaAsync(empresaId, Modulo.Servicos) is null)
            return Forbid();

        var agora = DateTime.UtcNow;
        var recentes = agora.AddDays(-7);
        var lista = await Context.PromocoesServico
            .AsNoTracking()
            .Where(p => p.FimEm > recentes || p.Ativa)
            .OrderByDescending(p => p.DataCriacao)
            .Select(p => new
            {
                p.Id,
                p.ServicoId,
                ServicoNome = p.Servico.Nome,
                PrecoNormal = p.Servico.Preco,
                p.PrecoPromocional,
                p.Titulo,
                p.Descricao,
                p.InicioEm,
                p.FimEm,
                p.Ativa,
                NoAr = p.Ativa && p.InicioEm <= agora && p.FimEm > agora,
            })
            .Take(50)
            .ToListAsync();

        return Ok(lista);
    }

    [HttpPost]
    public async Task<IActionResult> Criar(int empresaId, CriarPromocaoRequest request)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Servicos) is null)
            return Forbid();

        var servico = await Context.Servicos.FirstOrDefaultAsync(s => s.Id == request.ServicoId && s.Ativo);
        if (servico is null)
            return NotFound(new { mensagem = "Serviço não encontrado." });
        if (!servico.PermiteAutoagendamento)
            return BadRequest(new { mensagem = "Esse serviço não aceita agendamento pelo link. Ligue “As clientes podem agendar pelo link” no cadastro do serviço para a promoção aparecer." });

        var preco = decimal.Round(request.PrecoPromocional, 2);
        if (preco <= 0)
            return BadRequest(new { mensagem = "Informe o preço promocional." });
        if (preco >= servico.Preco)
            return BadRequest(new { mensagem = $"O preço promocional precisa ser menor que o preço normal ({servico.Preco:0.00})." });
        if (request.Dias < 1 || request.Dias > 30)
            return BadRequest(new { mensagem = "A promoção pode durar de 1 a 30 dias." });

        var titulo = string.IsNullOrWhiteSpace(request.Titulo) ? "Promoção" : request.Titulo.Trim();
        var descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim();
        if (titulo.Length > PromocaoServico.MaxTitulo)
            return BadRequest(new { mensagem = $"O título pode ter no máximo {PromocaoServico.MaxTitulo} letras." });
        if (descricao is { Length: > PromocaoServico.MaxDescricao })
            return BadRequest(new { mensagem = $"A frase pode ter no máximo {PromocaoServico.MaxDescricao} letras." });

        var agora = DateTime.UtcNow;

        // Uma promoção no ar por serviço: a nova substitui a anterior.
        var anteriores = await Context.PromocoesServico.Where(p => p.ServicoId == servico.Id && p.Ativa && p.FimEm > agora).ToListAsync();
        foreach (var a in anteriores)
            a.Ativa = false;

        var noAr = await Context.PromocoesServico.CountAsync(p => p.Ativa && p.FimEm > agora);
        if (noAr >= PromocaoServico.MaxNoAr)
            return BadRequest(new { mensagem = $"Você já tem {PromocaoServico.MaxNoAr} promoções no ar. Encerre uma para criar outra." });

        var promocao = new PromocaoServico
        {
            EmpresaId = empresaId,
            ServicoId = servico.Id,
            Titulo = titulo,
            Descricao = descricao,
            PrecoPromocional = preco,
            InicioEm = agora,
            FimEm = agora.AddDays(request.Dias),
            Ativa = true,
            DataCriacao = agora,
        };
        Context.PromocoesServico.Add(promocao);
        await Context.SaveChangesAsync();

        return Ok(new { promocao.Id, promocao.ServicoId, promocao.PrecoPromocional, promocao.FimEm });
    }

    [HttpPut("{id:int}/encerrar")]
    public async Task<IActionResult> Encerrar(int empresaId, int id)
    {
        if (await ObterEmpresaDonoAsync(empresaId, Modulo.Servicos) is null)
            return Forbid();

        var promocao = await Context.PromocoesServico.FirstOrDefaultAsync(p => p.Id == id);
        if (promocao is null)
            return NotFound(new { mensagem = "Promoção não encontrada." });

        promocao.Ativa = false;
        await Context.SaveChangesAsync();
        return Ok(new { promocao.Id, promocao.Ativa });
    }
}
