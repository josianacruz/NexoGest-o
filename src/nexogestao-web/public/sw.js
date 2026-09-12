// Service worker mínimo: só existe pra deixar o site instalável (PWA).
// Não guarda nada em cache de propósito — os dados são sempre buscados
// direto da API, pra nunca mostrar informação desatualizada de vendas,
// clientes ou estoque.
self.addEventListener("fetch", () => {});
