// ── Catálogo de módulos vendáveis ──────────────────────────────
//
// Cada módulo é um "produto" que pode ser vendido isolado ou no pacote completo.
// Este arquivo é a fonte da verdade sobre QUAIS módulos existem, o que cada um
// faz, e como eles se conectam. O app completo e as vendas isoladas leem daqui.
//
// >>> COMO MONETIZAR <<<
// - `precoIsolado`: preço do módulo vendido sozinho.
// - `chaves`: as chaves de storage que o módulo possui (pra exportar/migrar dados).
// - `integraCom`: módulos que ENRIQUECEM este, mas que NÃO são obrigatórios.
//   Se o cliente não tem o módulo integrado, este aqui degrada com elegância
//   (ex.: Financeiro sem Catálogo aceita produto digitado à mão).

export const MODULOS = {
  calculadora: {
    id: "calculadora",
    nome: "Precificação",
    descricao: "Calcula o preço de venda por peça e em lote, com custo de material, energia, depreciação, mão de obra, taxa de falha, margem, marketplaces e imposto.",
    icone: "🧮",
    precoIsolado: 39,
    chaves: ["catalogo"], // escreve produtos no catálogo (se houver)
    integraCom: ["catalogo"],
    standalone: true, // funciona 100% sozinho
  },
  catalogo: {
    id: "catalogo",
    nome: "Catálogo & Vitrine",
    descricao: "Gestão de produtos com custo/preço/margem, preços de varejo e faixas de atacado, importação/exportação CSV e PDF, e uma vitrine para o cliente montar pedidos.",
    icone: "📦",
    precoIsolado: 49,
    chaves: ["catalogo", "orcamentos"], // vitrine cria orçamentos
    integraCom: ["calculadora", "orcamentos"],
    standalone: true,
  },
  orcamentos: {
    id: "orcamentos",
    nome: "Orçamentos",
    descricao: "Gera propostas em PDF para o cliente, controla ganhos e perdidos com motivo, calcula taxa de conversão e converte orçamento ganho em venda.",
    icone: "📄",
    precoIsolado: 39,
    chaves: ["orcamentos", "catalogo", "vendas"],
    integraCom: ["catalogo", "financeiro"],
    standalone: true,
  },
  financeiro: {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Registra vendas e despesas, fluxo de caixa diário, despesas por categoria e indicadores do mês (receita, lucro, ticket médio).",
    icone: "💰",
    precoIsolado: 49,
    chaves: ["vendas", "despesas", "catalogo"],
    integraCom: ["catalogo", "orcamentos"],
    standalone: true,
  },
};

export const ORDEM_MODULOS = ["calculadora", "catalogo", "orcamentos", "financeiro"];

// Preço do pacote completo (com desconto vs. soma dos isolados).
export const PRECO_COMPLETO = 119;

export function somaIsolados() {
  return ORDEM_MODULOS.reduce((s, id) => s + MODULOS[id].precoIsolado, 0);
}

// ── Licença / entitlements ─────────────────────────────────────
//
// Controla QUAIS módulos o cliente comprou. No protótipo, fica no localStorage
// e pode ser editado pela tela de "Planos". No SaaS real, isto vem do seu
// backend de billing (Stripe/Asaas) — troque carregarLicenca/salvarLicenca por
// uma chamada à API que retorna os módulos ativos da conta.

const LICENCA_KEY = "app3d:licenca";

export function carregarLicenca() {
  try {
    const raw = localStorage.getItem(LICENCA_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Padrão do protótipo: tudo liberado (modo "app completo") para você testar.
  // Para simular venda isolada, use a tela de Planos ou troque aqui.
  return { modulos: [...ORDEM_MODULOS], plano: "completo" };
}

export function salvarLicenca(licenca) {
  try {
    localStorage.setItem(LICENCA_KEY, JSON.stringify(licenca));
  } catch (e) {}
}

export function temModulo(licenca, id) {
  return !!licenca?.modulos?.includes(id);
}
