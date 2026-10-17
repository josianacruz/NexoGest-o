namespace NexoGestao.Api.Domain;

// Promoção de um serviço, criada pela dona no painel e mostrada às clientes na página de agendamento enquanto estiver
// "no ar" (ativa e dentro da validade). O preço promocional vale de verdade: quem agenda paga esse valor.
public class PromocaoServico
{
    public const int MaxTitulo = 40;
    public const int MaxDescricao = 80;
    public const int MaxNoAr = 5;

    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public int ServicoId { get; set; }
    public Servico Servico { get; set; } = null!;
    public string Titulo { get; set; } = "Promoção";
    public string? Descricao { get; set; }
    public decimal PrecoPromocional { get; set; }
    public DateTime InicioEm { get; set; } = DateTime.UtcNow;
    public DateTime FimEm { get; set; }
    public bool Ativa { get; set; } = true;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
}
