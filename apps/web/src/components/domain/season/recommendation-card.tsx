"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select, SearchableSelect } from "@recomenda/ui/forms/select";
import { DoseUnitSelect } from "@/components/domain/dose-unit-select";
import { cn, GLOBAL_PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import {
  useApplyRecommendation,
  useCloneGlobalProduct,
  useCreateRecommendationItem,
  useCyclePurchaseList,
  useDeleteRecommendation,
  useDeleteRecommendationItem,
  usePatchRecommendation,
  useReorderRecommendationItems,
  useSeason,
  useSeasonCostPlan,
  useSkipRecommendation,
  useUndoRecommendation,
  useUpdateRecommendationItem,
  useUpdateSeasonVarieties,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import {
  productsForPurchaseListCategory,
  purchaseListProductLabel,
  type PurchaseListCatalogProduct,
} from "@recomenda/domain/catalog/purchase-list-catalog";
import type { Recommendation, RecommendationItem } from "@recomenda/api";
import {
  recommendedYmdToWindow,
  todayLocalYmd,
} from "@recomenda/domain/timing/window-days";
import { SEED_CATEGORIES, areaFactorOf, areaPercentFieldFromFactor } from "@recomenda/domain/purchase-list/list-item";
import { displayRecStatus, fmtDate } from "@recomenda/domain/recommendations/format";
import {
  formulationShortLabel,
  resolveFormulationKey,
} from "@recomenda/domain/recommendations/formulation-mix-order";
import {
  sortRecommendationItemsByMixOrder,
} from "@recomenda/domain/recommendations/mix-order";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  FlaskConical,
  GripVertical,
  Pencil,
  Plus,
  Save,
  SkipForward,
  Sprout,
  Trash2,
} from "lucide-react";
import {
  RecommendationStageFields,
  recommendationToStageDraft,
  type RecommendationStageDraft,
} from "@/components/domain/recommendation-stage-fields";
import { RecommendationRegisterPopover } from "@/components/domain/recommendation-register-popover";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";

export type ListProductPlan = {
  dose: number;
  unit: string;
  areaFactor: number;
  areaNote: string | null;
};

function stageKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function pickListProductPlan(
  byProductStage: Map<string, ListProductPlan>,
  byProduct: Map<string, ListProductPlan>,
  productId: string,
  stageName: string,
): ListProductPlan | undefined {
  const staged = stageKey(stageName);
  if (staged) {
    const hit = byProductStage.get(`${productId}::${staged}`);
    if (hit) return hit;
  }
  return byProduct.get(productId);
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-surface-2 text-muted-foreground border border-border",
  OVERDUE: "bg-warning-soft text-warning-strong border border-warning-border",
  APPLIED_ON_TIME:
    "bg-success-soft text-success-strong border border-success-border",
  APPLIED_LATE:
    "bg-warning-soft text-warning-strong border border-warning-border",
  SKIPPED: "bg-clay-soft text-clay-strong border border-clay-border",
};

const STATUS_ICON: Record<string, ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  OVERDUE: <AlertTriangle className="h-3.5 w-3.5" />,
  APPLIED_ON_TIME: <CheckCircle2 className="h-3.5 w-3.5" />,
  APPLIED_LATE: <CheckCircle2 className="h-3.5 w-3.5" />,
  SKIPPED: <SkipForward className="h-3.5 w-3.5" />,
};

/** Mesma grade do cabeçalho e das linhas (grip | # | form | produto | dose | ações). */
const PRODUCT_MIX_GRID =
  "sm:grid sm:grid-cols-[2rem_1.5rem_2.75rem_minmax(0,1fr)_minmax(8rem,auto)_4rem] sm:items-center sm:gap-x-2 sm:gap-y-0";
const PRODUCT_MIX_GRID_NO_GRIP =
  "sm:grid sm:grid-cols-[1.5rem_2.75rem_minmax(0,1fr)_minmax(8rem,auto)_4rem] sm:items-center sm:gap-x-2 sm:gap-y-0";

function StageDateBadge({
  label,
  date,
  originalDate,
  tone = "primary",
}: {
  label: string;
  date: string;
  originalDate?: string | null;
  tone?: "primary" | "neutral" | "success";
}) {
  const toneClasses = {
    primary: "border-border bg-surface-2 shadow-sm",
    neutral: "border-border bg-surface-2",
    success: "border-success-border bg-success-soft",
  } as const;

  const labelClasses = {
    primary: "text-muted-foreground",
    neutral: "text-muted-foreground",
    success: "text-success-strong",
  } as const;

  const showOriginal =
    originalDate && originalDate.slice(0, 10) !== date.slice(0, 10);

  return (
    <div
      className={cn(
        "flex min-w-[7.5rem] shrink-0 flex-col rounded-lg border px-3 py-2",
        toneClasses[tone],
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider",
          labelClasses[tone],
        )}
      >
        <CalendarDays className="w-3 h-3 shrink-0" />
        {label}
      </span>
      <span className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {fmtDate(date)}
      </span>
      {showOriginal ? (
        <span className="mt-0.5 text-[11px] text-muted-foreground line-through">
          {fmtDate(originalDate)}
        </span>
      ) : null}
    </div>
  );
}

function ProductRow({
  item,
  seasonId,
  onDelete,
  outOfProgram,
  canDelete = true,
  canReorder = false,
  mixPosition,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  item: RecommendationItem;
  seasonId: string;
  onDelete: (id: string) => void;
  outOfProgram?: boolean;
  canDelete?: boolean;
  canReorder?: boolean;
  /** Posição 1-based na ordem de mistura (tanque). */
  mixPosition?: number;
  isDragging?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dose, setDose] = useState(String(item.dose_per_hectare));
  const [unit, setUnit] = useState<string>(item.dose_unit ?? "L");
  const [areaPercent, setAreaPercent] = useState(
    areaPercentFieldFromFactor(item.area_factor),
  );
  const [areaNote, setAreaNote] = useState(item.area_note ?? "");
  const updateMut = useUpdateRecommendationItem(seasonId);

  const startEditing = () => {
    setDose(String(item.dose_per_hectare));
    setUnit(item.dose_unit ?? "L");
    setAreaPercent(areaPercentFieldFromFactor(item.area_factor));
    setAreaNote(item.area_note ?? "");
    setEditing(true);
  };

  const handleSave = () => {
    const parsed = parseFloat(dose.replace(",", "."));
    if (!parsed || parsed <= 0) return;
    updateMut.mutate(
      {
        id: item.id,
        dose_per_hectare: parsed,
        dose_unit: unit,
        area_factor: areaFactorOf({ areaPercent }),
        area_note: areaNote.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Produto atualizado.");
          setEditing(false);
        },
        onError: () => toast.error("Não foi possível atualizar o produto."),
      },
    );
  };

  const formKey =
    item.formulation_key ?? resolveFormulationKey(item.equivalence_group);
  const formShort = formulationShortLabel(formKey);

  const identity = (
    <>
      {canReorder ? (
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Arrastar para reordenar"
          aria-label="Arrastar produto na ordem de mistura"
          className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      {mixPosition != null ? (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center justify-self-center rounded-md border border-border bg-surface-2 text-[11px] font-bold tabular-nums text-muted-foreground"
          title={`Ordem de mistura #${mixPosition}`}
        >
          {mixPosition}
        </span>
      ) : (
        <FlaskConical className="h-3.5 w-3.5 shrink-0 justify-self-center text-muted-foreground" />
      )}
      <span
        className="inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 px-1 text-[10px] font-bold tracking-wide text-muted-foreground"
        title={`Formulação: ${formShort}`}
      >
        {formShort}
      </span>
      <span className="min-w-0 flex-1 break-words font-medium leading-snug text-foreground">
        {item.product_name}
        {item.is_substitution && (
          <span className="ml-1.5 text-[10px] text-warning-strong">
            (substituído)
          </span>
        )}
        {outOfProgram ? (
          <span className="ml-1.5 mt-0.5 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive align-middle">
            <CircleAlert className="w-3 h-3" />
            Fora da programação
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <div
      onDragOver={canReorder ? onDragOver : undefined}
      className={cn(
        "min-w-0 rounded-lg border bg-card px-3 py-2.5 text-sm",
        editing
          ? "flex flex-col gap-2"
          : cn(
              "flex flex-col gap-2",
              canReorder ? PRODUCT_MIX_GRID : PRODUCT_MIX_GRID_NO_GRIP,
            ),
        outOfProgram && "border-destructive/40 bg-destructive/5",
        isDragging && "opacity-60 ring-1 ring-primary/40",
      )}
    >
      {editing ? (
        <div className="flex min-w-0 items-center gap-2">
          {identity}
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2 sm:contents">
          {identity}
        </div>
      )}

      {editing ? (
        <div className="grid w-full min-w-0 gap-2">
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Dose / ha
              </span>
              <Input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                inputMode="decimal"
                className="h-9 min-w-0 w-full text-right text-sm tabular-nums"
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Unidade
              </span>
              <DoseUnitSelect
                value={unit}
                onChange={setUnit}
                className="h-9 w-full min-w-0 max-w-none shrink"
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              % da área
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                value={areaPercent}
                onChange={(e) => setAreaPercent(e.target.value)}
                inputMode="decimal"
                placeholder="100"
                className="h-9 min-w-0 w-full text-right text-sm tabular-nums"
                aria-label="% da área"
              />
              <span className="shrink-0 text-xs text-muted-foreground">%</span>
            </div>
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Obs. área
            </span>
            <Input
              value={areaNote}
              onChange={(e) => setAreaNote(e.target.value)}
              placeholder="Ex.: só cabeceira"
              className="h-9 min-w-0 w-full text-sm"
              aria-label="Observação de área"
            />
          </label>
          <div className="flex gap-2 pt-0.5">
            <Button
              size="sm"
              className="h-9 flex-1 gap-1.5 sm:flex-none"
              onClick={handleSave}
              disabled={updateMut.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 flex-1 sm:flex-none"
              onClick={() => {
                setEditing(false);
                setDose(String(item.dose_per_hectare));
                setUnit(item.dose_unit ?? "L");
                setAreaPercent(areaPercentFieldFromFactor(item.area_factor));
                setAreaNote(item.area_note ?? "");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center justify-between gap-2 pl-8 sm:contents sm:pl-0">
          <span className="min-w-0 text-xs tabular-nums text-muted-foreground sm:text-right">
            {item.dose_per_hectare} {item.dose_unit}/ha
            {item.total_quantity > 0 ? (
              <>
                {" "}
                ·{" "}
                {item.total_quantity.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}{" "}
                {item.dose_unit} total
              </>
            ) : null}
            {item.area_factor != null && item.area_factor < 0.999 ? (
              <> · {Math.round(item.area_factor * 100)}% da área</>
            ) : null}
            {item.area_note ? <> · {item.area_note}</> : null}
          </span>
          <div className="flex shrink-0 items-center justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={startEditing}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            {canDelete ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function AddProductRow({
  recommendationId,
  seasonId,
  stageName,
  onClose,
  catalogProducts,
  inProgramProductIds,
  listPlanByProductId,
  listPlanByProductStage,
}: {
  recommendationId: string;
  seasonId: string;
  stageName: string;
  onClose: () => void;
  catalogProducts: PurchaseListCatalogProduct[];
  /** Produtos "na programação": lista de compra ∪ estoque do produtor. */
  inProgramProductIds: Set<string>;
  listPlanByProductId: Map<string, ListProductPlan>;
  listPlanByProductStage: Map<string, ListProductPlan>;
}) {
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("L");
  const [areaPercent, setAreaPercent] = useState("");
  const [areaNote, setAreaNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const createMut = useCreateRecommendationItem(seasonId);
  const cloneGlobal = useCloneGlobalProduct();

  // Por padrão a lista de compra e o estoque do produtor; ao expandir, o catálogo
  // completo (global + local). Produtos fora da lista e sem estoque entram
  // marcados como "fora da programação".
  const listCatalog = useMemo(
    () =>
      catalogProducts.filter((product) =>
        inProgramProductIds.has(product.optionValue),
      ),
    [catalogProducts, inProgramProductIds],
  );
  const rowProducts = productsForPurchaseListCategory(
    expanded ? catalogProducts : listCatalog,
    category,
    productId,
    productName,
  );
  const outOfProgram = Boolean(productId) && !inProgramProductIds.has(productId);

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    setProductId("");
    setProductName("");
    setUnit("L");
    setExpanded(false);
  };

  const resolveProduct = async (optionValue: string) => {
    const product = rowProducts.find(
      (entry) => entry.optionValue === optionValue,
    );
    if (!product) return;
    const apply = (localId: string, name: string, doseUnit?: string) => {
      const planned = pickListProductPlan(
        listPlanByProductStage,
        listPlanByProductId,
        localId,
        stageName,
      );
      setProductId(localId);
      setProductName(name);
      setUnit(planned?.unit ?? doseUnit ?? "L");
      if (!dose && planned?.dose) setDose(String(planned.dose));
      if (planned) {
        setAreaPercent(areaPercentFieldFromFactor(planned.areaFactor));
        setAreaNote(planned.areaNote ?? "");
      }
    };
    if (!product.globalId || !product.isGlobalOnly) {
      apply(product.optionValue, product.name, product.dose_unit);
      return;
    }
    setResolving(true);
    try {
      const cloned = await cloneGlobal.mutateAsync(product.globalId);
      apply(
        cloned.id,
        cloned.name ?? product.name,
        cloned.dose_unit ?? product.dose_unit,
      );
    } catch {
      toast.error("Não foi possível adicionar o produto da plataforma.");
    } finally {
      setResolving(false);
    }
  };

  const handleAdd = () => {
    const localId = productId;
    const doseVal = parseFloat(dose.replace(",", "."));
    if (!category) {
      toast.error("Selecione a categoria do produto.");
      return;
    }
    if (!localId) {
      toast.error("Selecione o produto.");
      return;
    }
    if (!doseVal || doseVal <= 0) {
      toast.error("Informe a dose por hectare.");
      return;
    }
    createMut.mutate(
      {
        recommendation_id: recommendationId,
        local_product_id: localId,
        dose_per_hectare: doseVal,
        dose_unit: unit,
        area_factor: areaFactorOf({ areaPercent }),
        area_note: areaNote.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Produto adicionado.");
          onClose();
        },
        onError: () => toast.error("Não foi possível adicionar o produto."),
      },
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 p-3",
        outOfProgram && "border-destructive/40 bg-destructive/5",
      )}
    >
      <p className="mb-2 text-xs font-semibold text-foreground">
        Adicionar produto
      </p>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select
              value={category}
              onValueChange={handleCategoryChange}
              placeholder="Selecione…"
              filterLabel="Categoria"
              options={GLOBAL_PRODUCT_CATEGORIES.filter(
                (item) =>
                  item !== "SEED" &&
                  item !== "CULTIVAR_SOJA" &&
                  item !== "HIBRIDO_MILHO",
              ).map((item) => ({
                value: item,
                label: PRODUCT_CATEGORY_LABELS[item],
              }))}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <SearchableSelect
              value={productId}
              onValueChange={(optionValue) => void resolveProduct(optionValue)}
              disabled={!category || resolving}
              loading={resolving}
              loadingMessage="Vinculando…"
              placeholder={category ? "Selecione…" : "Escolha a categoria"}
              filterLabel="Buscar produto"
              searchPlaceholder={
                expanded ? "Buscar no catálogo…" : "Buscar produto…"
              }
              emptyMessage={
                expanded
                  ? "Nenhum produto encontrado no catálogo."
                  : "Nenhum produto desta categoria na lista de compra ou em estoque."
              }
              selectedLabel={productName || undefined}
              options={rowProducts.map((product) => ({
                value: product.optionValue,
                label: purchaseListProductLabel(product),
                keywords: product.name,
              }))}
              className="w-full"
              footer={({ close }) =>
                !category || expanded ? null : (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setExpanded(true);
                      close();
                    }}
                    className="flex items-center w-full gap-2 px-2 py-2 text-sm font-medium text-left transition-colors rounded-md text-primary hover:bg-primary/8"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Adicionar produto fora da lista de compra
                  </button>
                )
              }
            />
            {outOfProgram ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive">
                <CircleAlert className="w-3 h-3" />
                Fora da programação
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:col-span-2">
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Dose / ha</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="h-9 min-w-0 w-full text-sm"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Unidade</Label>
              <DoseUnitSelect
                value={unit}
                onChange={setUnit}
                className="h-9 w-full min-w-0 max-w-none shrink"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% área</Label>
            <Input
              inputMode="decimal"
              placeholder="100"
              value={areaPercent}
              onChange={(e) => setAreaPercent(e.target.value)}
              className="h-9 w-full text-sm text-right tabular-nums"
            />
          </div>
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Obs. área</Label>
            <Input
              placeholder="Ex: áreas sujas"
              value={areaNote}
              onChange={(e) => setAreaNote(e.target.value)}
              className="h-9 w-full text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!category || !productId || !dose || createMut.isPending}
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Linha de semente numa etapa: mostra população e Big Bags/sacos (sem dose). */
function SeedRow({
  item,
  seasonId,
  onDelete,
  canDelete = true,
  canEdit = false,
}: {
  item: RecommendationItem;
  seasonId: string;
  onDelete: (id: string) => void;
  canDelete?: boolean;
  canEdit?: boolean;
}) {
  const { data: season } = useSeason(seasonId);
  const { data: purchaseList } = useCyclePurchaseList(season?.cycle_id ?? "");
  const updateItem = useUpdateRecommendationItem(seasonId);
  const updateVars = useUpdateSeasonVarieties(seasonId);
  const [editing, setEditing] = useState(false);
  const seedsPerUnit = item.dose_unit === "SACA" ? 60000 : 5000000;
  const currentPop = Number(item.dose_per_hectare) * seedsPerUnit;
  const [productId, setProductId] = useState(item.local_product_id);
  const [population, setPopulation] = useState(String(Math.round(currentPop)));

  const listSeeds = (purchaseList?.items ?? []).filter((it) =>
    SEED_CATEGORIES.includes(it.category),
  );

  const startEditing = () => {
    setProductId(item.local_product_id);
    setPopulation(String(Math.round(currentPop)));
    setEditing(true);
  };

  const persistVarieties = (
    productName: string,
    plants: number,
  ) => {
    const existing = season?.varieties ?? [];
    if (existing.length === 0) {
      return updateVars.mutateAsync([
        {
          variety: productName,
          planted_area_ha:
            season?.planted_area_ha != null ? Number(season.planted_area_ha) : null,
          thousand_plants_per_ha: plants,
        },
      ]);
    }
    const lower = productName.trim().toLowerCase();
    const oldLower = item.product_name.trim().toLowerCase();
    let matched = false;
    const next = existing.map((v) => {
      const name = v.variety.trim().toLowerCase();
      if (name === lower || name === oldLower) {
        matched = true;
        return {
          variety: productName,
          planted_area_ha: v.planted_area_ha,
          thousand_plants_per_ha: plants,
        };
      }
      return {
        variety: v.variety,
        planted_area_ha: v.planted_area_ha,
        thousand_plants_per_ha: v.thousand_plants_per_ha,
      };
    });
    if (!matched) {
      next[0] = {
        variety: productName,
        planted_area_ha: next[0]?.planted_area_ha ?? null,
        thousand_plants_per_ha: plants,
      };
    }
    return updateVars.mutateAsync(next);
  };

  const handleSave = () => {
    const plants = Number(population.replace(",", ".").trim());
    if (!plants || plants <= 0) {
      toast.error("Informe a população em plantas/ha.");
      return;
    }
    const selected =
      listSeeds.find((s) => s.local_product_id === productId) ??
      listSeeds.find((s) => s.product_name === item.product_name);
    const unit = selected
      ? selected.category === "HIBRIDO_MILHO"
        ? "SACA"
        : "BAG"
      : item.dose_unit;
    const perUnit = unit === "SACA" ? 60000 : 5000000;
    const productName = selected?.product_name ?? item.product_name;
    updateItem.mutate(
      {
        id: item.id,
        local_product_id: selected?.local_product_id ?? item.local_product_id,
        dose_per_hectare: plants / perUnit,
        dose_unit: unit,
      },
      {
        onSuccess: () => {
          void persistVarieties(productName, plants).then(
            () => {
              toast.success("Semente atualizada.");
              setEditing(false);
            },
            () => {
              toast.success("População da etapa atualizada.");
              setEditing(false);
            },
          );
        },
        onError: () => toast.error("Não foi possível atualizar a semente."),
      },
    );
  };

  const unitLabel = item.dose_unit === "SACA" ? "sacos" : "Big Bags";

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          {listSeeds.length > 0 ? (
            <SearchableSelect
              value={productId}
              onValueChange={setProductId}
              placeholder="Cultivar"
              options={listSeeds.map((s) => ({
                value: s.local_product_id,
                label: s.product_name,
              }))}
            />
          ) : (
            <span className="text-sm font-medium">{item.product_name}</span>
          )}
          <Input
            inputMode="decimal"
            value={population}
            onChange={(e) => setPopulation(e.target.value)}
            aria-label="Plantas por hectare"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8"
            onClick={handleSave}
            disabled={updateItem.isPending || updateVars.isPending}
          >
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-strong" />
        <span className="min-w-0 flex-1 break-words font-medium leading-snug text-foreground">
          {item.product_name}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 pl-6 sm:pl-0">
        <span className="min-w-0 text-xs tabular-nums text-muted-foreground">
          {currentPop.toLocaleString("pt-BR")} plantas/ha
          {item.total_quantity
            ? ` · ${item.total_quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unitLabel}`
            : ""}
        </span>
        <div className="flex shrink-0">
          {canEdit ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={startEditing}
              aria-label="Editar semente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-danger-strong"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Formulário "Adicionar semente" de uma etapa: escolhe uma semente da LISTA DE
 *  COMPRA da safra (a população já vem de lá). Salva como item da etapa (Big Bag/Saca). */
function AddSeedRow({
  recommendationId,
  seasonId,
  onClose,
}: {
  recommendationId: string;
  seasonId: string;
  onClose: () => void;
}) {
  const { data: plan } = useSeasonCostPlan(seasonId);
  const { data: season } = useSeason(seasonId);
  const [selectedId, setSelectedId] = useState("");
  const createMut = useCreateRecommendationItem(seasonId);

  const listSeeds = (plan?.items ?? []).filter((it) =>
    SEED_CATEGORIES.includes(it.category),
  );
  const selected = listSeeds.find((s) => s.local_product_id === selectedId);
  const plotPop = (season?.varieties ?? []).find(
    (v) =>
      selected &&
      v.variety.trim().toLowerCase() === selected.product_name.trim().toLowerCase(),
  )?.thousand_plants_per_ha;

  const handleAdd = () => {
    if (!selected) return toast.error("Selecione a semente.");
    const seedsPerUnit =
      selected.category === "HIBRIDO_MILHO" ? 60000 : 5000000;
    const unit = selected.category === "HIBRIDO_MILHO" ? "SACA" : "BAG";
    const pop =
      plotPop && plotPop > 0
        ? plotPop
        : (selected.thousand_plants_per_ha ?? 0);
    createMut.mutate(
      {
        recommendation_id: recommendationId,
        local_product_id: selected.local_product_id,
        dose_per_hectare: seedsPerUnit > 0 ? pop / seedsPerUnit : 0,
        dose_unit: unit,
      },
      {
        onSuccess: () => {
          toast.success("Semente adicionada.");
          onClose();
        },
        onError: () => toast.error("Não foi possível adicionar a semente."),
      },
    );
  };

  return (
    <div className="p-3 border border-dashed rounded-xl bg-muted/20">
      <p className="mb-2 text-xs font-semibold text-foreground">
        Adicionar semente
      </p>
      {listSeeds.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma semente na lista de compra desta safra. Adicione a semente no{" "}
          <strong>Plano de custo</strong> primeiro.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Semente (da lista de compra)
            </Label>
            <SearchableSelect
              value={selectedId}
              onValueChange={setSelectedId}
              placeholder="Selecione a semente…"
              filterLabel="Buscar semente"
              searchPlaceholder="Buscar…"
              options={listSeeds.map((s) => ({
                value: s.local_product_id,
                label: s.thousand_plants_per_ha
                  ? `${s.product_name} · ${s.thousand_plants_per_ha.toLocaleString("pt-BR")} plantas/ha`
                  : s.product_name,
                keywords: s.product_name,
              }))}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedId || createMut.isPending}
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecommendationCard({
  rec,
  index,
  seasonId,
  defaultOpen = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isReordering,
  canReorder,
  canEditStructure = true,
  catalogProducts,
  inProgramProductIds,
  listPlanByProductId,
  listPlanByProductStage,
  listReady,
}: {
  rec: Recommendation;
  index: number;
  seasonId: string;
  /** Abre a etapa no mount (deep-link da home/cronograma). */
  defaultOpen?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isReordering: boolean;
  canReorder: boolean;
  canEditStructure?: boolean;
  catalogProducts: PurchaseListCatalogProduct[];
  /** Produtos "na programação": lista de compra ∪ estoque do produtor. */
  inProgramProductIds: Set<string>;
  listPlanByProductId: Map<string, ListProductPlan>;
  listPlanByProductStage: Map<string, ListProductPlan>;
  listReady: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingSeed, setAddingSeed] = useState(false);
  const [stageDraft, setStageDraft] = useState<RecommendationStageDraft>(() =>
    recommendationToStageDraft(rec),
  );

  // Semente é um item da etapa com unidade Big Bag/Saca (separada dos produtos).
  const isSeedRow = (it: RecommendationItem) =>
    it.dose_unit === "BAG" || it.dose_unit === "SACA";
  const serverProductItems = useMemo(
    () =>
      sortRecommendationItemsByMixOrder(
        rec.items.filter((it) => !isSeedRow(it)),
      ),
    [rec.items],
  );
  const seedItems = rec.items.filter((it) => isSeedRow(it));
  /** Inclui mix_order para resetar override local quando a safra muda a ordem global. */
  const serverProductOrderKey = serverProductItems
    .map((i) => `${i.id}:${i.mix_order ?? ""}`)
    .join("|");

  const [orderedProductIds, setOrderedProductIds] = useState<string[]>(() =>
    serverProductItems.map((i) => i.id),
  );
  const orderedProductIdsRef = useRef(orderedProductIds);
  orderedProductIdsRef.current = orderedProductIds;
  const draggingRef = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const reorderItemsMut = useReorderRecommendationItems(seasonId);

  useEffect(() => {
    if (draggingRef.current || reorderItemsMut.isPending) return;
    setOrderedProductIds(serverProductItems.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when server order/set changes
  }, [serverProductOrderKey, reorderItemsMut.isPending]);

  const productById = useMemo(
    () => new Map(serverProductItems.map((i) => [i.id, i] as const)),
    [serverProductItems],
  );
  const productItems = orderedProductIds
    .map((id) => productById.get(id))
    .filter((it): it is RecommendationItem => Boolean(it));

  const persistProductOrder = (ids: string[]) => {
    const serverIds = serverProductItems.map((i) => i.id);
    if (
      ids.length === 0 ||
      ids.length !== serverIds.length ||
      ids.every((id, i) => id === serverIds[i])
    ) {
      return;
    }
    reorderItemsMut.mutate(
      { recommendationId: rec.id, itemIds: ids },
      {
        onSuccess: () => toast.success("Ordem da etapa salva."),
        onError: (e: unknown) => {
          setOrderedProductIds(serverIds);
          toast.error(
            apiErrorMessage(e, "Não foi possível salvar a ordem."),
          );
        },
      },
    );
  };

  const moveProduct = (from: number, to: number) => {
    if (to < 0 || to >= orderedProductIds.length || from === to) return;
    setOrderedProductIds((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const [registering, setRegistering] = useState(false);
  const [executedDate, setExecutedDate] = useState(
    rec.executed_date
      ? rec.executed_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [execNotes, setExecNotes] = useState(rec.notes ?? "");

  const patchMut = usePatchRecommendation(seasonId);
  const deleteMut = useDeleteRecommendationItem(seasonId);
  const deleteStageMut = useDeleteRecommendation(seasonId);
  const [deleteStageOpen, setDeleteStageOpen] = useState(false);
  const applyMut = useApplyRecommendation(seasonId);
  const skipMut = useSkipRecommendation(seasonId);
  const undoMut = useUndoRecommendation(seasonId);
  const isBusy =
    patchMut.isPending ||
    deleteMut.isPending ||
    deleteStageMut.isPending ||
    applyMut.isPending ||
    skipMut.isPending ||
    undoMut.isPending ||
    reorderItemsMut.isPending;

  const isPending = rec.status === "PENDING";
  const isDone =
    rec.status === "APPLIED_ON_TIME" || rec.status === "APPLIED_LATE";
  const isSkipped = rec.status === "SKIPPED";

  const handleSaveStage = () => {
    const trimmed = stageDraft.name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da etapa.");
      return;
    }
    // Ao corrigir a data, recalcula a janela (centrada na nova data ± tolerância).
    const win = recommendedYmdToWindow(
      stageDraft.recommended_date || todayLocalYmd(),
    );
    patchMut.mutate(
      {
        id: rec.id,
        name: trimmed,
        trigger_type: stageDraft.trigger_type,
        predicted_date_current: stageDraft.recommended_date || null,
        window_start_days: win.window_start_days,
        window_end_days: win.window_end_days,
        notes: isPending ? stageDraft.notes.trim() || null : rec.notes,
      },
      {
        onSuccess: () => toast.success("Etapa atualizada."),
        onError: () => toast.error("Não foi possível salvar."),
      },
    );
  };

  const handleDeleteItem = (itemId: string) => {
    deleteMut.mutate(itemId, {
      onSuccess: () => toast.success("Produto removido."),
      onError: () => toast.error("Não foi possível remover o produto."),
    });
  };

  const handleApply = () => {
    applyMut.mutate(
      {
        id: rec.id,
        executed_date: executedDate,
        notes: execNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Etapa registrada como aplicada.");
          setRegistering(false);
        },
        onError: (e: unknown) =>
          toast.error(apiErrorMessage(e, "Não foi possível registrar.")),
      },
    );
  };

  const handleSkip = () => {
    skipMut.mutate(
      { id: rec.id, notes: execNotes || undefined },
      {
        onSuccess: () => {
          toast.success("Etapa marcada como pulada.");
          setRegistering(false);
        },
        onError: () => toast.error("Não foi possível marcar como pulada."),
      },
    );
  };

  const handleUndo = () => {
    undoMut.mutate(rec.id, {
      onSuccess: () => toast.success("Etapa revertida para pendente."),
      onError: () => toast.error("Não foi possível reverter."),
    });
  };

  return (
    <li
      id={`rec-${rec.id}`}
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow scroll-mt-24",
        isPending && "border-primary/30 shadow-md ring-1 ring-primary/10",
        open && isPending && "ring-2 ring-primary/20",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        aria-expanded={open}
        className={cn(
          "flex w-full min-w-0 cursor-pointer flex-wrap items-center gap-3 px-4 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isPending ? "hover:bg-primary/5" : "hover:bg-accent/40",
        )}
      >
        <div className="flex items-center gap-2 shrink-0">
          {canReorder ? (
            <div
              role="group"
              aria-label="Reordenar etapa"
              className="flex flex-col overflow-hidden border rounded-lg shadow-sm shrink-0 border-border bg-surface"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp || isReordering}
                aria-label="Mover etapa para cima"
                className="flex items-center justify-center transition-colors h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <div className="h-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown || isReordering}
                aria-label="Mover etapa para baixo"
                className="flex items-center justify-center transition-colors h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              isDone
                ? "bg-primary text-primary-foreground shadow-sm"
                : isSkipped
                  ? "bg-clay-soft text-clay-strong"
                  : "bg-primary-soft text-primary-strong",
            )}
          >
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {rec.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                STATUS_BADGE_CLASS[displayRecStatus(rec)] ??
                  "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_ICON[displayRecStatus(rec)]}
              {STATUS_LABEL[displayRecStatus(rec)] ?? displayRecStatus(rec)}
            </span>
          </div>
          {rec.items.length > 0 ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {rec.items.length}{" "}
              {rec.items.length === 1 ? "produto" : "produtos"} na receita
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Sem produtos vinculados
            </p>
          )}
        </div>

        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2.5">
          {isDone && rec.executed_date ? (
            <StageDateBadge
              label="Aplicado"
              date={rec.executed_date}
              tone="success"
            />
          ) : isSkipped ? null : rec.predicted_date_current ? (
            <StageDateBadge
              label="Previsto"
              date={rec.predicted_date_current}
              originalDate={rec.predicted_date_original}
              tone="primary"
            />
          ) : null}
          {isPending ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <RecommendationRegisterPopover
                seasonId={seasonId}
                recommendationId={rec.id}
                title={rec.name}
              />
            </div>
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors",
              open && "border-primary/30 bg-primary/5 text-primary-strong",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </span>
        </div>
      </div>

      {open && (
        <div className="flex min-w-0 flex-col gap-4 px-3 pt-3 pb-4 border-t sm:px-4">
          <div className="p-4 border shadow-sm rounded-xl border-border bg-card">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Dados da etapa
            </p>
            <RecommendationStageFields
              draft={stageDraft}
              onChange={(patch) =>
                setStageDraft((prev) => ({ ...prev, ...patch }))
              }
              readOnly={!isPending || !canEditStructure}
            />
            {isPending && canEditStructure ? (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleSaveStage}
                  disabled={isBusy}
                  className="h-8 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar etapa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteStageOpen(true)}
                  disabled={isBusy}
                  className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir etapa
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Etapas aplicadas ou puladas não podem ter nome e data alterados.
              </p>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Produtos recomendados
              </p>
            </div>
            {productItems.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <div
                  className={cn(
                    "mb-0.5 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid",
                    canEditStructure ? PRODUCT_MIX_GRID : PRODUCT_MIX_GRID_NO_GRIP,
                  )}
                >
                  <span className={canEditStructure ? "col-span-2" : undefined}>
                    #
                  </span>
                  <span className="text-center">Form.</span>
                  <span>Produto</span>
                  <span className="text-right">Dose</span>
                  <span aria-hidden />
                </div>
                {productItems.map((item, index) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    seasonId={seasonId}
                    onDelete={handleDeleteItem}
                    canDelete={canEditStructure}
                    canReorder={canEditStructure}
                    mixPosition={index + 1}
                    isDragging={dragIndex === index}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", item.id);
                      e.dataTransfer.effectAllowed = "move";
                      draggingRef.current = true;
                      setDragIndex(index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragIndex == null || dragIndex === index) return;
                      moveProduct(dragIndex, index);
                      setDragIndex(index);
                    }}
                    onDragEnd={() => {
                      persistProductOrder(orderedProductIdsRef.current);
                      draggingRef.current = false;
                      setDragIndex(null);
                    }}
                    outOfProgram={
                      listReady && !inProgramProductIds.has(item.local_product_id)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum produto vinculado.
              </p>
            )}

            {seedItems.length > 0 ? (
              <>
                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sementes
                </p>
                <div className="flex flex-col gap-1.5">
                  {seedItems.map((item) => (
                    <SeedRow
                      key={item.id}
                      item={item}
                      seasonId={seasonId}
                      onDelete={handleDeleteItem}
                      canDelete={canEditStructure}
                      canEdit={canEditStructure}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {canEditStructure ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!addingProduct && !addingSeed ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingProduct(true)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar produto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingSeed(true)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Sprout className="h-3.5 w-3.5" />
                      Adicionar semente
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}

            {canEditStructure && addingProduct ? (
              <div className="mt-2">
                <AddProductRow
                  recommendationId={rec.id}
                  seasonId={seasonId}
                  stageName={rec.name}
                  onClose={() => setAddingProduct(false)}
                  catalogProducts={catalogProducts}
                  inProgramProductIds={inProgramProductIds}
                  listPlanByProductId={listPlanByProductId}
                  listPlanByProductStage={listPlanByProductStage}
                />
              </div>
            ) : null}
            {canEditStructure && addingSeed ? (
              <div className="mt-2">
                <AddSeedRow
                  recommendationId={rec.id}
                  seasonId={seasonId}
                  onClose={() => setAddingSeed(false)}
                />
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              (isDone || isSkipped) && !registering
                ? isSkipped
                  ? "border-clay-border bg-clay-soft"
                  : rec.status === "APPLIED_LATE"
                    ? "border-warning-border bg-warning-soft"
                    : "border-success-border bg-success-soft"
                : "border-border bg-card shadow-sm",
            )}
          >
            <p
              className={cn(
                "mb-3 text-[11px] font-bold uppercase tracking-[0.1em]",
                (isDone || isSkipped) && !registering
                  ? isSkipped
                    ? "text-clay-strong"
                    : rec.status === "APPLIED_LATE"
                      ? "text-warning-strong"
                      : "text-success-strong"
                  : "text-muted-foreground",
              )}
            >
              Execução
            </p>

            {(isDone || isSkipped) && !registering ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white",
                      isSkipped
                        ? "bg-clay-strong"
                        : rec.status === "APPLIED_LATE"
                          ? "bg-warning-strong"
                          : "bg-success",
                    )}
                  >
                    {STATUS_ICON[rec.status]}
                    {STATUS_LABEL[rec.status]}
                  </span>
                  {rec.executed_date ? (
                    <span className="text-sm text-foreground">
                      em {fmtDate(rec.executed_date)}
                    </span>
                  ) : null}
                  {rec.notes ? (
                    <span className="text-sm text-muted-foreground">
                      · {rec.notes}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRegistering(true)}
                    className="h-9 gap-1.5 bg-card"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUndo}
                    disabled={isBusy}
                    className={cn(
                      "h-9 gap-1.5 px-2 text-sm font-semibold",
                      isSkipped
                        ? "text-clay-strong hover:text-clay-strong"
                        : rec.status === "APPLIED_LATE"
                          ? "text-warning-strong hover:text-warning-strong"
                          : "text-success-strong hover:text-success-strong",
                    )}
                  >
                    Reverter para pendente
                  </Button>
                </div>
              </div>
            ) : registering ? (
              <div className="p-4 border rounded-xl border-border bg-surface-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-surface p-3">
                    <Label className="text-xs font-semibold text-primary">
                      Data de execução
                    </Label>
                    <Input
                      type="date"
                      value={executedDate}
                      onChange={(e) => setExecutedDate(e.target.value)}
                      className="h-10 text-sm font-semibold border-primary/30 bg-card"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Observações (opcional)</Label>
                    <Input
                      value={execNotes}
                      onChange={(e) => setExecNotes(e.target.value)}
                      placeholder="Ex: aplicado 10% a menos por chuva"
                      className="h-10 text-sm bg-card"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={isBusy || !executedDate}
                    className="h-8 gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isBusy ? "Salvando…" : "Marcar como aplicada"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isBusy}
                    className="h-8 gap-1.5 bg-card text-muted-foreground"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Pular etapa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRegistering(false)}
                    className="h-8 ml-auto"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : isPending ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRegistering(true)}
                className="h-8 gap-1.5 bg-card"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Registrar execução
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteStageOpen}
        onOpenChange={setDeleteStageOpen}
        title="Excluir etapa"
        description={`Excluir “${rec.name}” e todos os produtos desta etapa? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        tone="destructive"
        loading={deleteStageMut.isPending}
        onConfirm={async () => {
          await new Promise<void>((resolve, reject) =>
            deleteStageMut.mutate(rec.id, {
              onSuccess: () => {
                toast.success("Etapa excluída.");
                setDeleteStageOpen(false);
                resolve();
              },
              onError: (err) => {
                toast.error(
                  apiErrorMessage(err, "Não foi possível excluir a etapa."),
                );
                reject(err);
              },
            }),
          );
        }}
      />
    </li>
  );
}
