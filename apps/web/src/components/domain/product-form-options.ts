import { FORMULATION_MIX_OPTIONS } from "@recomenda/domain/recommendations/formulation-mix-order";

/** Opções do select "Tipo de formulação" (catálogo e cadastro rápido). */
export const FORMULATION_SELECT_OPTIONS = FORMULATION_MIX_OPTIONS.map((o) => ({
  value: o.key,
  label: o.label,
}));

/** Categorias cuja unidade é fixa: soja→bag, milho→sacos, fertilizante→t/ha. */
export function fixedDoseUnitForCategory(category: string | null | undefined): string | null {
  if (category === "CULTIVAR_SOJA") return "BAG";
  if (category === "HIBRIDO_MILHO") return "SACA";
  if (category === "FERTILIZER") return "T_HA";
  return null;
}

/** Unidade padrão por categoria (a fixa, ou "Dose" nas demais). */
export function defaultDoseUnitForCategory(category: string | null | undefined): string {
  return fixedDoseUnitForCategory(category) ?? "DOSE";
}

/** Semente e fertilizante não têm formulação — o campo nem aparece. */
export function categoryHasFormulation(category: string | null | undefined): boolean {
  return (
    category !== "CULTIVAR_SOJA" &&
    category !== "HIBRIDO_MILHO" &&
    category !== "SEED" &&
    category !== "FERTILIZER"
  );
}
