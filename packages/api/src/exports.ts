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

export interface ExportRecommendationBlock {
  seasonId?: string;
  id?: string;
  label?: string;
  title: string;
  plotName: string | null;
  plantingDate: string | null;
  statusLabel: string | null;
  recommendations: Recommendation[];
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
  stock?: { items: ExportStockItem[] };
  quotes?: {
    listName: string | null;
    comparison: QuoteComparison;
  };
}
