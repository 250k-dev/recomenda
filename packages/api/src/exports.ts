import type { PurchaseListDetail } from "./purchase-lists";
import type { QuoteComparison } from "./quotes";
import type { Recommendation } from "./seasons";

export type ExportLinkType =
  | "purchase_list"
  | "recommendation"
  | "season"
  | "stock"
  | "quotes";

export interface ExportStockItem {
  product_name: string;
  category: string;
  category_label: string;
  quantity: number;
  dose_unit: string;
  price_brl: number | null;
  value_brl: number | null;
}

/** Ficha técnica do talhão no documento exportado (campo ausente sai como "—"). */
export interface ExportPlotSpec {
  farmName: string | null;
  farmLocation: string | null;
  cycleName: string | null;
  cropLabel: string | null;
  areaHa: number | null;
  plantedAreaHa: number | null;
  varieties: Array<{
    variety: string;
    plantedAreaHa: number | null;
    thousandPlantsPerHa: number | null;
  }>;
  spacingM: number | null;
  cycleDays: number | null;
  desiccationDate: string | null;
}

export interface ExportRecommendationBlock {
  seasonId?: string;
  id?: string;
  label?: string;
  title: string;
  plotName: string | null;
  plantingDate: string | null;
  statusLabel: string | null;
  recommendations: Recommendation[];
  spec?: ExportPlotSpec | null;
}

export interface ExportByTokenResponse {
  typ: ExportLinkType;
  showPrices: boolean;
  producerName: string | null;
  agronomistName: string | null;
  expiresAt: string;
  purchaseList?: PurchaseListDetail;
  recommendation?: ExportRecommendationBlock;
  season?: {
    cycleId: string;
    cycleName: string;
    items: ExportRecommendationBlock[];
  };
  /**
   * Preço unitário em R$ por `local_product_id`, da lista de compra da safra.
   * Só vem quando o solicitante tem PRICE_VIEW (`showPrices`).
   */
  unitPriceByProduct?: Record<string, number>;
  stock?: { items: ExportStockItem[] };
  quotes?: {
    listName: string | null;
    comparison: QuoteComparison;
  };
}
