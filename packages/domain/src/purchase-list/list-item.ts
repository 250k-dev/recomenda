/**
 * O item da lista de compra (estado de formulário) e todo o cálculo em cima
 * dele: quantidade necessária, quanto comprar, conversão de semente em
 * bags/sacos e serialização para o payload da API.
 *
 * Lógica pura — sem React. Vivia em `components/domain/season/_shared.tsx`, mas
 * `lib/` consome estas funções, e a camada de baixo não pode depender da de
 * cima.
 */
import type { PurchaseListItemInput } from "@recomenda/api/purchase-lists";
import { seedQuantityFromPopulation } from "../cost-plan/calculate";

/** Item da lista de compra (estado de formulário). */
export type ListItem = {
  key: string;
  category: string;
  productId: string;
  productName: string;
  stage: string;
  dose: string;
  unit: string;
  nApps: string;
  stock: string;
  /** Preço unitário em R$ (manual). */
  price: string;
  /** Preço unitário em US$ (manual) — convertido para R$ pela cotação do dólar. */
  priceUsd: string;
  /** Variedade/Híbrido: semente por metro (input; população é derivada). */
  seedsPerMeter?: string;
  /** Variedade/Híbrido: ciclo do cultivar em dias (referência). */
  cycleDays?: string;
  /** Variedade/Híbrido: população final em plantas/ha — DERIVADA de
   *  semente/metro × 10.000 ÷ espaçamento (mantida para o cálculo de bags). */
  thousandPlants: string;
  /** Variedade/Híbrido: área a ser semeada (ha). */
  seedingArea: string;
  /** Produto cadastrado na hora, fora do catálogo/programação (destaque vermelho). */
  outOfProgram?: boolean;
  /** Semente: quantidade de bags/sacos digitada à mão (sobrepõe o cálculo). */
  bagsOverride?: string;
  /** % da área total em que o produto é aplicado (ex.: "20"). Vazio/ausente = 100. */
  areaPercent?: string;
  /** Observação de onde é aplicado (ex.: "áreas sujas"). Não entra em cálculo. */
  areaNote?: string;
};

/** Fração (0..1) da área em que o item é aplicado. Default: área toda. */
export function areaFactorOf(it: ListItem): number {
  const pct = Number((it.areaPercent ?? "").replace(",", "."));
  if (!Number.isFinite(pct) || pct <= 0) return 1;
  return pct / 100;
}

/** Espaçamento padrão entre linhas (m) quando a lista não informa outro valor. */
export const DEFAULT_SPACING_M = 0.65;

/**
 * População final (plantas/ha) = semente/metro × 10.000 ÷ espaçamento.
 * Espelha a planilha: `=E*(100/$G$6*100)` (E = semente/metro, G6 = espaçamento).
 */
export function populationFromSeeds(seedsPerMeter: number, spacingM: number): number {
  const sp = spacingM > 0 ? spacingM : DEFAULT_SPACING_M;
  return seedsPerMeter > 0 ? (seedsPerMeter * 10_000) / sp : 0;
}

/** Categorias tratadas como semente (cálculo por população, não por dose). */
export const SEED_CATEGORIES = ["SEED", "CULTIVAR_SOJA", "HIBRIDO_MILHO"];

/** Itens de Variedade/Híbrido (semente) calculam por população, não por dose. */
export const isSeedItem = (it: ListItem) => SEED_CATEGORIES.includes(it.category);

/** Rótulo curto da unidade de quantidade de semente conforme a categoria. */
export function seedQuantityUnitLabel(category: string): string {
  if (category === "CULTIVAR_SOJA") return "Big Bag (BR)";
  if (category === "HIBRIDO_MILHO") return "sacos";
  return "pl";
}

/** Sementes por unidade: Big Bag BR de soja = 5.000.000; saco de milho = 60.000. */
export function seedsPerUnit(category: string): number {
  if (category === "CULTIVAR_SOJA") return 5_000_000;
  if (category === "HIBRIDO_MILHO") return 60_000;
  return 1;
}

/**
 * Área plantada (ha) derivada do volume de bags/sacos — inverso da conversão
 * população→bags. Espelha a planilha: o agrônomo digita os bags à mão e a área
 * se ajusta sozinha. área = bags × sementes/unidade ÷ população.
 */
export function areaFromBags(
  bags: number,
  populationPerHa: number,
  category: string,
): number {
  if (bags <= 0 || populationPerHa <= 0) return 0;
  return (bags * seedsPerUnit(category)) / populationPerHa;
}

/** Os 4 números do planejamento de semente (auto-calculados). */
export function seedPlanOutputs(it: ListItem, totalHa: number) {
  const populationPerHa = Number(it.thousandPlants || 0); // plantas/ha (meta)
  const seedingArea = Number(it.seedingArea || 0) || totalHa;
  const totalSeeds = populationPerHa * seedingArea; // qtd de sementes
  const units = listItemQuantity(it, totalHa); // Big Bags (BR) / sacos
  const perUnit = seedsPerUnit(it.category);
  // Hectares atendidos pelas unidades efetivas (confere com a área quando exato).
  const hectaresServed = populationPerHa > 0 ? (units * perUnit) / populationPerHa : 0;
  return { populationPerHa, totalSeeds, units, hectaresServed };
}

/**
 * Quantidade necessária: para semente, (população/ha × área) convertida em
 * bags/sacos conforme a categoria; senão, dose×área×aplicações.
 */
export function listItemRequired(it: ListItem, totalHa: number): number {
  if (isSeedItem(it)) {
    const populationBase = Number(it.thousandPlants || 0) * Number(it.seedingArea || 0);
    return seedQuantityFromPopulation(populationBase, it.category);
  }
  return Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
}

/** Indica se a semente teve a quantidade de bags/sacos ajustada manualmente. */
export function hasBagsOverride(it: ListItem): boolean {
  return isSeedItem(it) && it.bagsOverride !== undefined && it.bagsOverride !== "";
}

/**
 * Quantidade efetiva: respeita o override manual de bags/sacos (semente) quando
 * houver; senão usa o cálculo por população (ou dose, para defensivos).
 */
export function listItemQuantity(it: ListItem, totalHa: number): number {
  if (hasBagsOverride(it)) return Number(it.bagsOverride) || 0;
  return listItemRequired(it, totalHa);
}

/**
 * Quanto comprar. Espelha a planilha: `(necessário − estoque) × % da área`.
 * O `%` é aplicado DEPOIS de descontar o estoque (ex.: Triclopir em áreas
 * sujas: (1,5 × 870 − 0) × 50% = 652,5).
 */
export function listItemToBuy(it: ListItem, totalHa: number): number {
  const required = listItemQuantity(it, totalHa);
  const stock = Number(it.stock || 0);
  return Math.max(0, (required - stock) * areaFactorOf(it));
}

/** Cultura do item numa lista multi-cultura: sementes são inequívocas pela
 *  categoria; os demais herdam a cultura única da lista (null quando "ANY" —
 *  produto comum às culturas). */
function deriveItemCrop(it: ListItem, listCrop?: string): string | null {
  if (it.category === "CULTIVAR_SOJA") return "SOYBEAN";
  if (it.category === "HIBRIDO_MILHO") return "CORN";
  if (listCrop === "SOYBEAN" || listCrop === "CORN") return listCrop;
  return null;
}

/** Nº de aplicações: só inteiros ≥ 1 (trunca decimais; vazio/inválido → 1). */
export function parseNApplications(raw: string | undefined): number {
  const whole = String(raw ?? "").replace(/[.,].*$/, "").replace(/\D/g, "");
  const n = Number(whole);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.trunc(n);
}

/** Converte um item do formulário no payload da API (lógica única e compartilhada). */
export function listItemToPayload(it: ListItem, listCrop?: string): PurchaseListItemInput {
  const seed = isSeedItem(it);
  return {
    local_product_id: it.productId,
    crop: deriveItemCrop(it, listCrop),
    stage: it.stage,
    dose_per_hectare: seed ? 0 : Number(it.dose),
    dose_unit: it.unit,
    n_applications: seed ? 1 : parseNApplications(it.nApps),
    current_stock: Number(it.stock) || 0,
    price_brl_fixed: it.price ? Number(it.price) : null,
    price_usd: it.priceUsd ? Number(it.priceUsd) : null,
    calc_rule: seed ? "SEED_POPULATION" : null,
    thousand_plants_per_ha: seed ? Number(it.thousandPlants) || 0 : null,
    seeds_per_meter: seed ? Number(it.seedsPerMeter) || 0 : null,
    cycle_days: seed && it.cycleDays ? Number(it.cycleDays) || null : null,
    seeding_area_ha: seed ? Number(it.seedingArea) || 0 : null,
    bags_override: hasBagsOverride(it) ? Number(it.bagsOverride) : null,
    out_of_program: it.outOfProgram ?? false,
    area_factor: areaFactorOf(it),
    area_note: it.areaNote?.trim() || null,
  };
}

/** Valida itens da lista (categoria, produto e dose/população). */
export function validateListItems(items: ListItem[]): string | null {
  if (items.length === 0) return "Adicione pelo menos um produto.";
  for (const it of items) {
    if (!it.category) return "Selecione a categoria em todos os itens.";
    if (!it.productId) return "Selecione o produto em todos os itens.";
    if (isSeedItem(it)) {
      if (!Number(it.seedsPerMeter))
        return "Informe a semente/metro nas variedades/híbridos.";
      // Aceita o volume de bags (input novo) OU a área plantada (listas antigas,
      // salvas antes de o bag virar manual) — só trava se a semente não tiver
      // nenhum dos dois. Assim listas existentes voltam a salvar normalmente.
      if (!Number(it.bagsOverride) && !Number(it.seedingArea))
        return "Informe o volume de bags/sacos nas variedades/híbridos.";
      // Bag/saco é unidade física fechada: não existe meio bag.
      if (it.bagsOverride && !Number.isInteger(Number(it.bagsOverride)))
        return "O volume de bags/sacos deve ser um número inteiro.";
    } else if (!Number(it.dose)) {
      return "Informe a dose/ha em todos os itens.";
    } else {
      const appsRaw = String(it.nApps ?? "").trim();
      if (appsRaw !== "") {
        const n = Number(appsRaw.replace(",", "."));
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
          return "O número de aplicações deve ser um inteiro maior ou igual a 1.";
        }
      }
    }
  }
  return null;
}

/** Entrada de estoque do produtor (quantidade + preço opcional). */
export type ProducerStockPrefillEntry =
  | number
  | { quantity: number; price_brl: number | null };

/**
 * Espelha o estoque real do produtor nos itens da lista (quantidade e, se
 * houver, preço). Usado ao selecionar produto, ao abrir edição e no wizard.
 *
 * `onlyIfEmpty`: não sobrescreve estoque/preço já digitados (wizard/rascunho).
 */
export function applyStockPrefill(
  items: ListItem[],
  stockByProductId?: Record<string, ProducerStockPrefillEntry> | null,
  opts?: { onlyIfEmpty?: boolean },
): ListItem[] {
  if (!stockByProductId) return items;
  const onlyIfEmpty = opts?.onlyIfEmpty ?? false;
  return items.map((it) => {
    if (!it.productId) return it;
    const entry = stockByProductId[it.productId];
    if (entry == null) return it;
    const qty = typeof entry === "number" ? entry : entry.quantity;
    const priceBrl = typeof entry === "number" ? null : entry.price_brl;
    const keepStock = onlyIfEmpty && Number(it.stock || 0) > 0;
    const keepPrice = onlyIfEmpty && Boolean(it.price?.trim());
    return {
      ...it,
      stock: keepStock ? it.stock : String(qty),
      ...(priceBrl != null && !keepPrice ? { price: String(priceBrl) } : {}),
    };
  });
}
