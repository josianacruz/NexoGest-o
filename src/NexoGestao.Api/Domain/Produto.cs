namespace NexoGestao.Api.Domain;

public class Produto
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Nome { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public decimal Preco { get; set; }
    public decimal Custo { get; set; }
    public int Estoque { get; set; }
    public int EstoqueMinimo { get; set; }
    public bool Ativo { get; set; } = true;

    // Link público da Story (Interesses): token opaco, nunca o Id. Nulo até a
    // primeira geração; LinkStoryAtivo permite desativar sem perder o token.
    public string? LinkStoryToken { get; set; }
    public bool LinkStoryAtivo { get; set; } = true;
    public string? FotoUrl { get; set; }
}
