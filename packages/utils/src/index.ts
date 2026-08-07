// Superfície pública de @recomenda/utils.
// Lista explícita por decisão de arquitetura: `export *` cego transforma o
// pacote em depósito e esconde o acoplamento real dos consumidores.

export { cn } from "./cn";

export { deactivateOutlineButtonClass } from "./action-button-styles";

export {
  BRAZIL_STATES,
  fetchCitiesByState,
  formatFarmLocation,
  optionalFarmLocation,
  parseFarmLocation,
  type BrazilState,
} from "./brazil-locations";

export {
  DOSE_UNIT_LABELS,
  DOSE_UNIT_SHORT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type GlobalDoseUnit,
  type GlobalProductCategory,
} from "./catalog-global-options";

export {
  categoryBarClass,
  categoryToken,
  type CategoryToken,
} from "./categories";

export {
  dateToLocalYmd,
  formatTimingPreviewDate,
  localYmdToDate,
  maskBrazilianDateInput,
  parseBrazilianDate,
} from "./dates";

// `phoneDigitsBR` fica fora do barril de propósito: é detalhe interno de
// `maskPhoneBR` e não tem consumidor externo.
export { formatPhoneBR, maskPhoneBR } from "./phone";

export { formatCreatedBy } from "./created-by";

export {
  CROP_LABELS,
  CYCLE_STATUS_LABELS,
  PURCHASE_LIST_STATUS_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  labelStatus,
} from "./season-constants";
