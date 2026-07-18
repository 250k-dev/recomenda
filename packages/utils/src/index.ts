// Superfície pública de @recomenda/utils.
// Lista explícita por decisão de arquitetura: `export *` cego transforma o
// pacote em depósito e esconde o acoplamento real dos consumidores.

export { cn } from "./cn";

export { deactivateOutlineButtonClass } from "./action-button-styles";

export {
  BRAZIL_STATES,
  fetchCitiesByState,
  formatFarmLocation,
  type BrazilState,
} from "./brazil-locations";

export {
  DOSE_UNIT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type GlobalDoseUnit,
  type GlobalProductCategory,
} from "./catalog-global-options";

export {
  categoryBarClass,
  categoryDotClass,
  categorySoftClass,
  categoryToken,
  type CategoryToken,
} from "./categories";

export {
  dateToLocalYmd,
  formatDateBR,
  formatTimingPreviewDate,
  localYmdToDate,
  maskBrazilianDateInput,
  parseBrazilianDate,
} from "./dates";

export { formatPhoneBR, maskPhoneBR, phoneDigitsBR } from "./phone";

export { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "./season-constants";
