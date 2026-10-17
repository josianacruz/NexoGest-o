// Tipos de negócio que a pessoa escolhe no cadastro e no primeiro acesso. A lista de módulos de cada tipo mora no
// servidor (PerfisDeAcesso): aqui só está o texto para mostrar. O menu lateral exibe o que a empresa tem ligado.
export interface TipoDeNegocio {
  perfil: "Salao" | "Loja" | "Alimentacao" | "ServicosGerais"; // nome do perfil na API
  tipoNegocio: number; // valor do enum TipoNegocio do servidor (Comercio 0, Alimentacao 1, Beleza 2, Servicos 4)
  nome: string;
  exemplos: string;
  icone: string;
  mostra: string;
}

export const TIPOS_DE_NEGOCIO: TipoDeNegocio[] = [
  { perfil: "Salao", tipoNegocio: 2, nome: "Beleza", exemplos: "Salão, barbearia, estética", icone: "💇", mostra: "Agenda, clientes, serviços, cobranças, marketing e relatórios" },
  { perfil: "Alimentacao", tipoNegocio: 1, nome: "Alimentação", exemplos: "Lanchonete, restaurante, marmitaria", icone: "🍔", mostra: "Vendas, comandas, produtos e cardápio, marketing e relatórios" },
  { perfil: "Loja", tipoNegocio: 0, nome: "Varejo", exemplos: "Loja, semijoias, revenda", icone: "🛍️", mostra: "Vendas, produtos, clientes, cobranças, marketing e relatórios" },
  { perfil: "ServicosGerais", tipoNegocio: 4, nome: "Serviços gerais", exemplos: "Autônomos e prestadores de serviços", icone: "🛠️", mostra: "Agenda, clientes, serviços, vendas, cobranças, marketing e relatórios" },
];
