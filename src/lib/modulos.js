export const MODULOS = {
  calculadora: {
    id: "calculadora",
    nome: "Precificação",
    descricao: "Calcula o preço de venda por peça e em lote, com custo de material, energia, depreciação, mão de obra, taxa de falha, margem, marketplaces e imposto.",
    icone: "🧮",
    precoUnico: 19.90,
    precoAtualizacao: 9.90,   // assinatura mensal opcional de atualizações
    precoMensal: null,        // não tem mensalidade obrigatória
    integraCom: ["catalogo"],
    standalone: true,
  },
  catalogo: {
    id: "catalogo",
    nome: "Catálogo & Vitrine",
    descricao: "Gestão de produtos com custo/preço/margem, preços de varejo e faixas de atacado, importação/exportação CSV e PDF, e uma vitrine pública para o cliente montar pedidos.",
    icone: "📦",
    precoUnico: null,
    precoAtualizacao: null,
    precoMensal: 19.90,       // apenas mensalidade
    integraCom: ["calculadora", "orcamentos"],
    standalone: true,
  },
  orcamentos: {
    id: "orcamentos",
    nome: "Orçamentos",
    descricao: "Gera propostas em PDF para o cliente, controla ganhos e perdidos com motivo, calcula taxa de conversão e converte orçamento ganho em venda.",
    icone: "📄",
    precoUnico: 19.90,
    precoAtualizacao: null,
    precoMensal: null,
    integraCom: ["catalogo", "financeiro"],
    standalone: true,
  },
  financeiro: {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Registra vendas e despesas, fluxo de caixa diário, despesas por categoria e indicadores do mês (receita, lucro, ticket médio).",
    icone: "💰",
    precoUnico: 29.90,
    precoAtualizacao: 9.90,
    precoMensal: null,
    integraCom: ["catalogo", "orcamentos"],
    standalone: true,
  },
  estoque: {
    id: "estoque",
    nome: "Estoque",
    descricao: "Controle de filamentos com barra de consumo, produtos acabados com alertas de reposição e insumos como insertos, tintas e embalagens.",
    icone: "📊",
    precoUnico: 19.90,
    precoAtualizacao: 9.90,
    precoMensal: null,
    integraCom: ["catalogo"],
    standalone: true,
  },
  producao: {
    id: "producao",
    nome: "Produção",
    descricao: "Fila de impressão com status por job, atribuição de impressora e saída automática para estoque de produtos acabados ao concluir.",
    icone: "🏭",
    precoUnico: 19.90,
    precoAtualizacao: 9.90,
    precoMensal: null,
    integraCom: ["orcamentos", "estoque", "impressoras"],
    standalone: false,
  },
  impressoras: {
    id: "impressoras",
    nome: "Impressoras",
    descricao: "Cadastro do parque de máquinas com vida útil, custo de depreciação por hora e rastreamento de horas acumuladas por impressora.",
    icone: "🖨️",
    precoUnico: 0,
    precoAtualizacao: 0,
    precoMensal: null,
    integraCom: ["producao"],
    standalone: true,
  },
};

export const ORDEM_MODULOS = ["calculadora", "catalogo", "orcamentos", "financeiro", "estoque", "producao", "impressoras"];

// Licença
const LICENCA_KEY = "app3d:licenca";
export function carregarLicenca() {
  try {
    const raw = localStorage.getItem(LICENCA_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { modulos: [...ORDEM_MODULOS], plano: "completo" };
}
export function salvarLicenca(licenca) {
  try { localStorage.setItem(LICENCA_KEY, JSON.stringify(licenca)); } catch (e) {}
}
export function temModulo(licenca, id) {
  return !!licenca?.modulos?.includes(id);
}
