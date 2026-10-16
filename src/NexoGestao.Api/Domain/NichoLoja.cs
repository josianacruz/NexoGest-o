namespace NexoGestao.Api.Domain;

// Nicho da loja: decide quais campos o cadastro de itens mostra (adicionais e tamanhos, cores e grade, duração).
// É separado do TipoNegocio (que escolhe os módulos na criação da empresa) para o Dono poder mudar sem mexer em módulos.
public enum NichoLoja { Alimentos, Moda, BelezaServicos, Outros }

public static class Nichos
{
    // Empresa que ainda não escolheu o nicho recebe um padrão a partir do tipo de negócio com que foi criada.
    public static NichoLoja Padrao(TipoNegocio? tipo) => tipo switch
    {
        TipoNegocio.Alimentacao => NichoLoja.Alimentos,
        TipoNegocio.Beleza or TipoNegocio.Saude or TipoNegocio.Servicos => NichoLoja.BelezaServicos,
        _ => NichoLoja.Outros,
    };

    public static NichoLoja Efetivo(Empresa e) => e.Nicho ?? Padrao(e.TipoNegocio);
}
