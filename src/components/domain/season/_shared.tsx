"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PurchaseListItemInput } from "@/lib/api/purchase-lists";
import { seedQuantityFromPopulation } from "@/lib/cost-plan/calculate";

/** Talhão usado nos fluxos de lista de compra e safra. */
export type WizardPlot = {
  id: string;
  name: string;
  area: number;
  farmId: string;
  farmName: string;
};

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

/** Converte um item do formulário no payload da API (lógica única e compartilhada). */
export function listItemToPayload(it: ListItem, listCrop?: string): PurchaseListItemInput {
  const seed = isSeedItem(it);
  return {
    local_product_id: it.productId,
    crop: deriveItemCrop(it, listCrop),
    stage: it.stage,
    dose_per_hectare: seed ? 0 : Number(it.dose),
    dose_unit: it.unit,
    n_applications: seed ? 1 : Number(it.nApps) || 1,
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
    }
  }
  return null;
}

/** Configuração por talhão no wizard de safra. */
export type PlotSchedule = {
  plotId: string;
  variety: string;
  plantingDate: string;
  cycleDays: string;
};

/** Estágio rascunho para montar cronograma no wizard. */
export type DraftTimingStage = {
  key: string;
  name: string;
  trigger_type: string;
  window_start_days: string;
  window_end_days: string;
};

export const STAGES = [
  "Dessecação",
  "Pós-emergência",
  "Fungicida V4",
  "Fungicida V6",
  "Fungicida VT",
  "Inseticida",
  "Foliar",
  "Outra",
];

export const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Área plantada — sempre com 2 casas (ex.: 325 → "325,00"). */
export const fmtArea = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StepHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Voltar",
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}
      <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

export function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

export function StepFooter({
  back,
  primary,
  secondary,
}: {
  back?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-4">
      {back}
      <div className="flex-1" />
      {secondary}
      {primary}
    </div>
  );
}

export function ContextBadge({
  tone,
  children,
}: {
  tone: "primary" | "sky";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "primary" && "bg-primary-soft text-primary-strong",
        tone === "sky" && "bg-tb-soft text-tb",
      )}
    >
      {children}
    </span>
  );
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-[18px] font-semibold tracking-[-0.01em] text-text-strong">
        {value}
      </p>
    </div>
  );
}

export function extractError(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (e instanceof Error) return e.message;
  return "Não foi possível concluir. Tente novamente.";
}
