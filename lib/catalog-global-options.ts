/** Alinhado ao enum `ProductCategory` do servidor. */
export const GLOBAL_PRODUCT_CATEGORIES = [
  "HERBICIDE",
  "FUNGICIDE",
  "INSECTICIDE",
  "ADJUVANT",
  "BIOLOGICAL",
  "FOLIAR",
  "SEED_TREATMENT",
  "FERTILIZER",
  "OTHER",
] as const;

/** Alinhado ao enum `DoseUnit` do servidor. */
export const GLOBAL_DOSE_UNITS = ["L", "KG", "G", "ML", "DOSE"] as const;

export type GlobalProductCategory = (typeof GLOBAL_PRODUCT_CATEGORIES)[number];
export type GlobalDoseUnit = (typeof GLOBAL_DOSE_UNITS)[number];

export const PRODUCT_CATEGORY_LABELS: Record<GlobalProductCategory, string> = {
  HERBICIDE: "Herbicida",
  FUNGICIDE: "Fungicida",
  INSECTICIDE: "Inseticida",
  ADJUVANT: "Adjuvante",
  BIOLOGICAL: "Biológico",
  FOLIAR: "Foliar",
  SEED_TREATMENT: "Tratamento de sementes",
  FERTILIZER: "Fertilizante",
  OTHER: "Outro",
};

export const DOSE_UNIT_LABELS: Record<GlobalDoseUnit, string> = {
  L: "Litros (L)",
  KG: "Quilogramas (kg)",
  G: "Gramas (g)",
  ML: "Mililitros (mL)",
  DOSE: "Dose",
};
