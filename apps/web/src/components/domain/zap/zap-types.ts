export type ZapLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export type ZapListItem = {
  id: string;
  productName: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  doseUnit: string;
  dosePerHectare: number;
  nApplications: number;
  stage: string;
  areaPercent: number;
  areaNote: string | null;
  outOfProgram: boolean;
  seedsPerMeter: number | null;
  thousandPlants: number | null;
  seedingArea: number | null;
  bagsOverride: number | null;
  totalBrl: number;
};

export type ZapListDto = {
  typ: "list_edit";
  canWrite: boolean;
  showPrices: boolean;
  expiresAt: number;
  list: {
    id: string;
    name: string;
    crop: string;
    cropLabel?: string;
    totalHectares: number;
    costPerHaBrl: number;
    totalBrl: number;
    sacksPerHa: number;
    totalSacks: number;
    items: ZapListItem[];
  };
};

export type ZapCatalogItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  doseUnit: string;
};

export type ZapTimingTemplate = {
  id: string;
  name: string;
  crop: string;
};

export type ZapTimingStage = {
  id: string;
  name: string;
  triggerType: string;
  windowStartDays: number;
  windowEndDays: number;
  notes: string | null;
  products: Array<{
    id: string;
    name: string;
    category: string;
    dosePerHectare: number;
    doseUnit: string;
  }>;
};

export type ZapSeasonDto = {
  typ: "season_create";
  expiresAt: number;
  canCreateTemplate: boolean;
  quota: { current: number; limit: number | null };
  producerId: string;
  producerName: string;
  producers: Array<{ id: string; name: string }>;
  farms: Array<{ id: string; name: string }>;
  farmId: string;
  farmName: string;
  plots: Array<{ id: string; name: string; areaHectares: number }>;
  templates: ZapTimingTemplate[];
};

/** Cadastro de fazenda pelo Zap: nome, cidade/UF e os talhões, tudo numa tela só. */
export type ZapFarmDto = {
  typ: "farm_create";
  step: "farm";
  expiresAt: number;
  producers: Array<{ id: string; name: string }>;
  producerId: string;
  producerName: string;
};

export type ZapProducerDto = {
  typ: "producer_create";
  step: "producer";
  expiresAt: number;
};

export type ZapReorderDto = {
  typ: "season_reorder";
  expiresAt: number;
  seasonId: string;
  label: string;
  stages: Array<{ id: string; name: string }>;
};

export const SEED_CATEGORIES = ["SEED", "CULTIVAR_SOJA", "HIBRIDO_MILHO"];

export function isSeedCategory(category: string): boolean {
  return SEED_CATEGORIES.includes(category);
}

export function formatZapExpiry(expiresAt: number): string {
  const ms = expiresAt * 1000 - Date.now();
  if (ms <= 0) return "Link expirado";
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `Vale por mais ${hours} h`;
  }
  return `Vale por mais ${minutes} min`;
}
