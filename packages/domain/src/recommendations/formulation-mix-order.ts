/**
 * Ordem oficial de adição na calda (tanque), baseada em formulação.
 * Fonte: guia "Ordem de adição e mistura de produtos na calda".
 *
 * `equivalence_group` no catálogo traz abreviação (SG, SC…) ou nome completo
 * ("Concentrado Solúvel", "500 g/L · Suspensão Concentrada").
 */

export type FormulationKey =
  | "CONDITIONER"
  | "SG"
  | "SP"
  | "WP"
  | "WG"
  | "MG"
  | "CS"
  | "SC"
  | "OD"
  | "DC"
  | "SE"
  | "EC"
  | "OIL_ADJUVANT"
  | "EO"
  | "EW"
  | "ME"
  | "SL"
  | "SURFACTANT"
  | "FOLIAR"
  | "ANTIFOAM"
  | "OTHER";

export type FormulationOption = {
  key: FormulationKey;
  /** Posição padrão (menor = entra antes). */
  defaultOrder: number;
  label: string;
  hint?: string;
};

/** Opções editáveis pelo agrônomo (água do tanque não entra — não é produto). */
export const FORMULATION_MIX_OPTIONS: FormulationOption[] = [
  {
    key: "CONDITIONER",
    defaultOrder: 20,
    label: "Especiais · corretivos / condicionadores",
    hint: "pH, quelantes, condicionadores de água",
  },
  { key: "SG", defaultOrder: 30, label: "SG · Granulado solúvel" },
  { key: "SP", defaultOrder: 40, label: "SP · Pó solúvel" },
  { key: "WP", defaultOrder: 50, label: "WP · Pó molhável" },
  { key: "WG", defaultOrder: 60, label: "WG · Grânulos dispersíveis" },
  { key: "MG", defaultOrder: 65, label: "MG · Micro granulado" },
  { key: "CS", defaultOrder: 70, label: "CS · Suspensão de encapsulado" },
  {
    key: "SC",
    defaultOrder: 80,
    label: "SC · Suspensão concentrada",
    hint: "Inclui FS (tratamento de sementes)",
  },
  { key: "OD", defaultOrder: 90, label: "OD · Dispersão de óleo" },
  { key: "DC", defaultOrder: 95, label: "DC · Concentrado dispersível" },
  { key: "SE", defaultOrder: 100, label: "SE · Suspo-emulsão" },
  { key: "EC", defaultOrder: 110, label: "EC · Concentrado emulsionável" },
  {
    key: "OIL_ADJUVANT",
    defaultOrder: 120,
    label: "Adjuvantes em óleo",
  },
  { key: "EO", defaultOrder: 130, label: "EO · Emulsão água em óleo" },
  { key: "EW", defaultOrder: 140, label: "EW · Emulsão óleo em água" },
  { key: "ME", defaultOrder: 150, label: "ME · Microemulsão" },
  { key: "SL", defaultOrder: 160, label: "SL · Concentrado solúvel" },
  {
    key: "SURFACTANT",
    defaultOrder: 170,
    label: "Surfactantes / espalhantes / estabilizantes",
  },
  { key: "FOLIAR", defaultOrder: 180, label: "Fertilizantes foliares" },
  { key: "ANTIFOAM", defaultOrder: 190, label: "Redutores de espuma" },
  { key: "OTHER", defaultOrder: 999, label: "Outros / não classificados" },
];

export const DEFAULT_FORMULATION_MIX_ORDER: FormulationKey[] =
  FORMULATION_MIX_OPTIONS.map((o) => o.key);

const OPTION_BY_KEY = new Map(
  FORMULATION_MIX_OPTIONS.map((o) => [o.key, o] as const),
);

/** Extrai a chave de formulação a partir de `equivalence_group`. */
export function resolveFormulationKey(
  equivalenceGroup: string | null | undefined,
): FormulationKey {
  if (!equivalenceGroup?.trim()) return "OTHER";
  const g = equivalenceGroup;

  // Ordem dos testes: códigos curtos e nomes longos (mais específicos primeiro).
  if (/\bCS\b/i.test(g) || /suspens[aã]o\s+de\s+encapsulado/i.test(g)) return "CS";
  if (/\bOD\b/i.test(g) || /dispers[aã]o\s+de\s+[oó]leo/i.test(g)) return "OD";
  if (/\bSE\b/i.test(g) || /suspo-?\s*emuls/i.test(g)) return "SE";
  if (/\bME\b/i.test(g) || /micro\s*-?\s*emuls/i.test(g)) return "ME";
  if (/\bEW\b/i.test(g) || /emuls[aã]o\s+(de\s+)?[oó]leo\s+em\s+[aá]gua/i.test(g))
    return "EW";
  if (/\bEO\b/i.test(g) || /emuls[aã]o\s+(de\s+)?[aá]gua\s+em\s+[oó]leo/i.test(g))
    return "EO";
  if (/\bDC\b/i.test(g) || /concentrado\s+dispers/i.test(g)) return "DC";
  if (/\bMG\b/i.test(g) || /micro\s*-?\s*granulado/i.test(g)) return "MG";
  if (/\bSG\b/i.test(g) || /granulado\s+sol[uú]vel/i.test(g)) return "SG";
  if (/\bSP\b/i.test(g) || /p[oó]\s+sol[uú]vel/i.test(g)) return "SP";
  if (
    /\bWP\b/i.test(g) ||
    /p[oó]\s+molh[aá]vel/i.test(g) ||
    /\bDP\b/i.test(g) ||
    /p[oó]\s+seco/i.test(g)
  )
    return "WP";
  if (
    /\bWG\b/i.test(g) ||
    /gr[aâ]nulos?\s+dispers/i.test(g) ||
    /granulado\s+dispers/i.test(g)
  )
    return "WG";
  if (/\bEC\b/i.test(g) || /concentrado\s+emulsion/i.test(g) || /\bGL\b/i.test(g))
    return "EC";
  if (
    /\bSC\b/i.test(g) ||
    /\bFS\b/i.test(g) ||
    /\bLS\b/i.test(g) ||
    /suspens[aã]o\s+concentrada/i.test(g)
  )
    return "SC";
  if (/\bSL\b/i.test(g) || /concentrado\s+sol[uú]vel/i.test(g)) return "SL";
  if (/adjuvante.*[oó]leo|[oó]leo.*adjuvante/i.test(g)) return "OIL_ADJUVANT";
  if (/surfactante|espalhante|estabilizante/i.test(g)) return "SURFACTANT";
  if (/foliar|fertilizante\s+foliar/i.test(g)) return "FOLIAR";
  if (/antiespumante|redutor\s+de\s+espuma/i.test(g)) return "ANTIFOAM";
  if (/condicionador|corretivo|quelante|pH/i.test(g)) return "CONDITIONER";

  return "OTHER";
}

/** Índice efetivo (0…n) na ordem configurada ou no padrão oficial. */
export function formulationMixIndex(
  key: FormulationKey,
  customOrder?: FormulationKey[] | null,
): number {
  const order =
    customOrder && customOrder.length > 0
      ? customOrder
      : DEFAULT_FORMULATION_MIX_ORDER;
  const idx = order.indexOf(key);
  if (idx >= 0) return idx;
  // Chave fora da lista custom → cai no defaultOrder relativo ao fim.
  return order.length + (OPTION_BY_KEY.get(key)?.defaultOrder ?? 999);
}

/** Score numérico estável para sort (custom ou default). */
export function formulationMixScore(
  equivalenceGroup: string | null | undefined,
  customOrder?: FormulationKey[] | null,
): number {
  const key = resolveFormulationKey(equivalenceGroup);
  return formulationMixIndex(key, customOrder);
}

export function normalizeFormulationMixOrder(
  raw: unknown,
): FormulationKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const allowed = new Set(DEFAULT_FORMULATION_MIX_ORDER);
  const seen = new Set<FormulationKey>();
  const next: FormulationKey[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item as FormulationKey;
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  // Completa com as que faltaram (append no final, na ordem default).
  for (const key of DEFAULT_FORMULATION_MIX_ORDER) {
    if (!seen.has(key)) next.push(key);
  }
  return next;
}

export function formulationOptionLabel(key: FormulationKey): string {
  return OPTION_BY_KEY.get(key)?.label ?? key;
}

const TECHNICAL_SHORT_CODES = new Set<string>([
  "SG",
  "SP",
  "WP",
  "WG",
  "MG",
  "CS",
  "SC",
  "OD",
  "DC",
  "SE",
  "EC",
  "EO",
  "EW",
  "ME",
  "SL",
]);

const COMPOUND_SHORT_LABELS: Record<string, string> = {
  CONDITIONER: "COND",
  OIL_ADJUVANT: "ÓLEO",
  SURFACTANT: "SURF",
  FOLIAR: "FOL",
  ANTIFOAM: "AF",
};

/** Abreviação compacta para badge/UI/export (ex: SC, COND, ÓLEO). */
export function formulationShortLabel(
  key: FormulationKey | string | null | undefined,
): string {
  if (!key) return "—";
  const normalized = key.trim().toUpperCase();
  if (!normalized || normalized === "OTHER") return "—";
  if (TECHNICAL_SHORT_CODES.has(normalized)) return normalized;
  return COMPOUND_SHORT_LABELS[normalized] ?? "—";
}
