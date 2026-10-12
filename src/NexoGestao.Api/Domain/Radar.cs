namespace NexoGestao.Api.Domain;

// Valores do parâmetro de ordenação da consulta de ofertas (conforme material de terceiros;
// confirmar na documentação oficial quando o acesso for liberado).
public enum OrdenacaoRadar
{
    Relevancia = 1,
    Vendas = 2,
    PrecoMaior = 3,
    PrecoMenor = 4,
    Comissao = 5,
}

public enum StatusExecucaoRadar
{
    Executando,
    Concluida,
    ConcluidaComAvisos,
    Falhou,
    NaoConfigurada,
}

// O que o Radar consulta todo dia: uma palavra-chave (nicho) com ordenação e filtros.
public class RadarConsulta
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Nome { get; set; } = string.Empty;
    public string PalavraChave { get; set; } = string.Empty;
    public OrdenacaoRadar Ordenacao { get; set; } = OrdenacaoRadar.Comissao;
    // Filtro aplicado pelo Nexo depois da resposta (a API não garante filtro de comissão mínima).
    public decimal? ComissaoMinimaPercentual { get; set; }
    public int MaximoProdutos { get; set; } = 50;
    public bool Ativa { get; set; } = true;
    public DateTime CriadaEm { get; set; } = DateTime.UtcNow;
}

// Registro de cada atualização (agendada ou manual): o que foi consultado e o que aconteceu.
public class RadarExecucao
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public Empresa Empresa { get; set; } = null!;
    public string Origem { get; set; } = "manual"; // "agendada" | "manual"
    public DateTime Inicio { get; set; } = DateTime.UtcNow;
    public DateTime? Fim { get; set; }
    public StatusExecucaoRadar Status { get; set; } = StatusExecucaoRadar.Executando;
    public int Consultas { get; set; }
    public int Chamadas { get; set; }
    public int Consultados { get; set; }
    public int Novos { get; set; }
    public int Atualizados { get; set; }
    public string? Mensagem { get; set; }
    // Amostra (poucos itens, truncada) da resposta bruta da API, para conferir quais campos ela realmente devolve.
    public string? AmostraBruta { get; set; }
}

// Foto diária dos números de um produto, para mostrar variação (vendas, preço, comissão) com dados
// observados pelo próprio Nexo, nunca estimados.
public class ProdutoAfiliadoSnapshot
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public int ProdutoAfiliadoId { get; set; }
    public ProdutoAfiliado ProdutoAfiliado { get; set; } = null!;
    public DateTime DataConsulta { get; set; } = DateTime.UtcNow;
    public string Fonte { get; set; } = string.Empty;
    public decimal? Preco { get; set; }
    public int? Vendas { get; set; }
    public decimal? ComissaoPercentual { get; set; }
    public decimal? ComissaoValor { get; set; }
    public decimal? ComissaoVendedorPercentual { get; set; }
    public decimal? ComissaoShopeePercentual { get; set; }
    public DateTime? InicioOferta { get; set; }
    public DateTime? FimOferta { get; set; }
}
