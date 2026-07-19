/**
 * Rótulos e cores das categorias de insumo — compartilhados entre o plano de custo
 * e a lista de compra (gráfico de distribuição por categoria).
 */

export const CATEGORY_LABELS: Record<string, string> = {
  SEED: "Variedade / Híbrido",
  CULTIVAR_SOJA: "Cultivar de soja",
  HIBRIDO_MILHO: "Híbrido de milho",
  FERTILIZER: "Adubação",
  HERBICIDE: "Herbicida",
  FUNGICIDE: "Fungicida",
  INSECTICIDE: "Inseticida",
  BIOLOGICAL: "Biológico",
  SEED_TREATMENT: "Tratamento de sementes",
  FOLIAR: "Foliar",
  ADJUVANT: "Adjuvante",
  OTHER: "Outros",
};

export const CATEGORY_COLORS: Record<string, string> = {
  SEED: "#3F7D3D",
  CULTIVAR_SOJA: "#3F7D3D",
  HIBRIDO_MILHO: "#C9A227",
  FERTILIZER: "#D9A441",
  HERBICIDE: "#B85C38",
  FUNGICIDE: "#4A7A99",
  INSECTICIDE: "#B5453A",
  BIOLOGICAL: "#7BAE3F",
  SEED_TREATMENT: "#8B5A2B",
  FOLIAR: "#9A9E7E",
  ADJUVANT: "#6B7155",
  OTHER: "#6B7155",
};
