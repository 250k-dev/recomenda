// Superfície pública de @recomenda/domain — a lógica de negócio da Recomenda:
// cálculo de custo, janelas de timing, listas de compra, cotações,
// recomendações, relatórios e documentos imprimíveis.
//
// A lista é nominal (e não `export *`) de propósito: este é o pacote que um
// segundo app — mobile, worker, BFF — consumiria de verdade, então a superfície
// vale como documentação. Símbolo novo aqui é decisão consciente, não efeito
// colateral de um arquivo novo.
//
// Regra do pacote: nada aqui conhece camada de UI. Sem React, sem Next, sem
// React Query. Ver `print/print-core` para a única parte browser-only.

// ---- permissões --------------------------------------------------------
// Espelho no cliente da camada de acesso do backend. Mora aqui porque é regra
// de negócio pura (quem pode o quê) e porque `@recomenda/api-hooks` precisa
// dela — deixá-la no app faria um pacote importar de `apps/`.
export type { Permission, Principal } from "./auth/permissions";
export { can, isManager, isConsultant } from "./auth/permissions";

// ---- catálogo ----------------------------------------------------------
export type {
  PurchaseListCrop,
  PurchaseListCatalogProduct,
} from "./catalog/purchase-list-catalog";
export {
  buildPurchaseListCatalog,
  productsForPurchaseListCategory,
  purchaseListProductLabel,
} from "./catalog/purchase-list-catalog";

// ---- plano de custo ----------------------------------------------------
export type {
  CostPerHaMode,
  CalcRule,
  CostItemInput,
  CostParams,
  CostLineResult,
  CategoryBreakdown,
  CostSummary,
} from "./cost-plan/calculate";
export {
  CATEGORY_ORDER,
  seedQuantityFromPopulation,
  calculateLine,
  calculateSummary,
} from "./cost-plan/calculate";
export { CATEGORY_LABELS, CATEGORY_COLORS } from "./cost-plan/categories";

// ---- impressão (browser-only) ------------------------------------------
export {
  escapeHtml,
  fmtBrl,
  LOGO_SVG,
  CORE_CSS,
  htmlShell,
  headerHtml,
  footerHtml,
  printHtml,
} from "./print/print-core";

// ---- lista de compra ---------------------------------------------------
export type { ListItem } from "./purchase-list/list-item";
export {
  areaFactorOf,
  DEFAULT_SPACING_M,
  populationFromSeeds,
  SEED_CATEGORIES,
  isSeedItem,
  seedQuantityUnitLabel,
  seedsPerUnit,
  areaFromBags,
  seedPlanOutputs,
  listItemRequired,
  hasBagsOverride,
  listItemQuantity,
  listItemToBuy,
  listItemsToBuyByKey,
  listItemToPayload,
  validateListItems,
  applyStockPrefill,
} from "./purchase-list/list-item";
export type { ProducerStockPrefillEntry } from "./purchase-list/list-item";
export type { PurchaseListMetrics } from "./purchase-list/breakdown";
export {
  detailItemToListItem,
  computePurchaseListMetrics,
} from "./purchase-list/breakdown";
export {
  isPurchaseListFullyPriced,
  computePortfolioPriceCoverage,
} from "./purchase-list/metrics";
export type { PurchaseListPrintContext } from "./purchase-list/purchase-list-print-document";
export {
  printPurchaseList,
  buildPurchaseListHtml,
  buildPurchaseListWhatsappMessage,
} from "./purchase-list/purchase-list-print-document";

// ---- cotações ----------------------------------------------------------
export type {
  QuotePrintContext,
  QuoteExportMode,
} from "./quotes/quote-print-document";
export {
  printQuoteComparison,
  buildQuoteComparisonHtml,
  buildQuoteWhatsappMessage,
} from "./quotes/quote-print-document";

// ---- recomendações -----------------------------------------------------
export type { RecommendationDisplayStatus } from "./recommendations/format";
export {
  RECOMMENDATION_STATUS_LABELS,
  fmtDate,
  isDesiccationRec,
  displayRecStatus,
  recommendationStatusLabel,
} from "./recommendations/format";
export type { RecommendationShareData } from "./recommendations/share-message";
export {
  buildWhatsappMessage,
  buildMultiWhatsappMessage,
} from "./recommendations/share-message";
export {
  buildRecommendationHtml,
  buildRecommendationsHtml,
  printRecommendation,
  printRecommendations,
} from "./recommendations/print-document";
export type { FormulationKey, FormulationOption } from "./recommendations/formulation-mix-order";
export {
  FORMULATION_MIX_OPTIONS,
  DEFAULT_FORMULATION_MIX_ORDER,
  resolveFormulationKey,
  formulationMixIndex,
  formulationMixScore,
  normalizeFormulationMixOrder,
  formulationOptionLabel,
  formulationEquivalenceGroup,
  formulationShortLabel,
} from "./recommendations/formulation-mix-order";

// ---- relatórios --------------------------------------------------------
export {
  seasonDisplayLabel,
  buildReportMetrics,
  formatReportCurrency,
  formatReportMargin,
} from "./reports/metrics";

// ---- estoque -----------------------------------------------------------
export type {
  StockExportItem,
  StockExportData,
} from "./stock/stock-export";
export {
  printStock,
  buildStockHtml,
  buildStockWhatsappMessage,
  downloadStockCsv,
} from "./stock/stock-export";

// ---- timing ------------------------------------------------------------
export type { StageProductDraft } from "./timing/types";
export type { PurchaseListBudgetOverage } from "./timing/purchase-list-budget";
export {
  aggregatePurchaseListDosePerHa,
  aggregateRecommendedDosePerHa,
  findPurchaseListOverages,
  formatDosePerHa,
} from "./timing/purchase-list-budget";
export {
  isStageProductPersistable,
  mapMixItemsToStageProducts,
  planStageProducts,
} from "./timing/sync-stage-products";
export {
  TIMING_WINDOW_TOLERANCE_DAYS,
  TIMING_REFERENCE_YMD,
  dayOffsetToIsoDate,
  isoDateToDayOffset,
  todayLocalYmd,
  windowDatesFromRecommendedYmd,
  targetDayToWindow,
  recommendedYmdToWindow,
  windowToRecommendedYmd,
  windowToTargetDay,
  recommendationWindowSpanDays,
} from "./timing/window-days";
