"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, CircleAlert, FlaskConical, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrazilianDateInput } from "@/components/ui/brazilian-date-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SearchableSelect } from "@/components/ui/select";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field } from "@/components/domain/season/_shared";
import { useLocalCatalog, useProducerPurchaseLists, useFarmPurchaseLists } from "@/lib/api/hooks";
import {
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import type { Product } from "@/lib/api/catalog";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  dayOffsetToIsoDate,
  isoDateToDayOffset,
} from "@/lib/timing/window-days";
import {
  findPurchaseListOverages,
  formatDosePerHa,
} from "@/lib/timing/purchase-list-budget";
import { cn } from "@/lib/utils";

export const TIMING_TRIGGER_TYPES = [
  { value: "PRE_PLANTING", label: "Pré-plantio" },
  { value: "PLANTING", label: "Plantio" },
  { value: "POST_PLANTING", label: "Pós-plantio" },
] as const;

export const TIMING_TRIGGER_LABELS: Record<string, string> = {
  PRE_PLANTING: "Pré-plantio",
  PLANTING: "Plantio",
  POST_PLANTING: "Pós-plantio",
  DAYS_AFTER_PLANTING: "Pós-plantio",
  DAYS_AFTER_DESICCATION: "Pré-plantio",
  DAYS_AFTER_TASSELING: "Pós-plantio",
  FIXED_DATE_OFFSET: "Pós-plantio",
};

export type StageProductDraft = {
  key: string;
  category: string;
  productId: string;
  productName: string;
  dose: string;
  unit: string;
  mixItemId?: string;
};

function productsForCategory(products: Product[], category: string): Product[] {
  if (!category) return [];
  return products.filter((product) => (product.category ?? "OTHER") === category);
}

function usePurchaseListCatalogProducts(
  producerId?: string,
  crop?: string,
  farmId?: string,
) {
  const { data: catalogData, isLoading: catalogLoading } = useLocalCatalog();
  const { data: producerLists, isLoading: listsLoading } = useProducerPurchaseLists(
    producerId ?? "",
  );
  const { data: farmLists, isLoading: farmListsLoading } = useFarmPurchaseLists(
    farmId ?? "",
  );

  const purchaseLists = useMemo(() => {
    const source =
      farmId && (farmLists?.length ?? 0) > 0
        ? (farmLists ?? [])
        : (producerLists ?? []);
    return crop ? source.filter((list) => list.crop === crop) : source;
  }, [crop, farmId, farmLists, producerLists]);

  const productList = useMemo(() => {
    const catalog = catalogData?.data ?? [];
    if (!producerId) return catalog;

    const allowedIds = new Set(
      purchaseLists.flatMap((list) => list.items.map((item) => item.local_product_id)),
    );
    return catalog.filter((product) => allowedIds.has(product.id));
  }, [catalogData, producerId, purchaseLists]);

  return {
    productList,
    purchaseLists,
    isLoading:
      catalogLoading ||
      (Boolean(producerId) && listsLoading) ||
      (Boolean(farmId) && farmListsLoading),
  };
}

export type TimingStageField = {
  key: string;
  name: string;
  trigger_type: string;
  recommended_date: string;
  notes: string;
  products: StageProductDraft[];
};

export function newStageProductDraft(): StageProductDraft {
  return {
    key: crypto.randomUUID(),
    category: "",
    productId: "",
    productName: "",
    dose: "",
    unit: "L",
  };
}

export function newTimingStageField(name = ""): TimingStageField {
  return {
    key: crypto.randomUUID(),
    name,
    trigger_type: "POST_PLANTING",
    recommended_date: dayOffsetToIsoDate(0),
    notes: "",
    products: [],
  };
}

export function StageWindowDateFields({
  recommendedDate,
  onRecommendedDateChange,
  readOnly = false,
  mode = "days",
}: {
  recommendedDate: string;
  onRecommendedDateChange: (recommendedDate: string) => void;
  readOnly?: boolean;
  /** `days` = offset from phase milestone (templates); `date` = calendar date on a live season */
  mode?: "days" | "date";
}) {
  if (mode === "date") {
    return (
      <Field label="Período">
        <BrazilianDateInput
          value={recommendedDate}
          onChange={onRecommendedDateChange}
          readOnly={readOnly}
        />
      </Field>
    );
  }

  const targetDay = isoDateToDayOffset(recommendedDate);

  return (
    <Field
      label="Período"
      hint="Dias a partir do marco da fase. A janela de ±2 dias é calculada automaticamente."
    >
      <Input
        type="number"
        min={0}
        step={1}
        value={Number.isFinite(targetDay) ? String(targetDay) : "0"}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          if (Number.isNaN(parsed)) return;
          onRecommendedDateChange(dayOffsetToIsoDate(parsed));
        }}
        readOnly={readOnly}
        disabled={readOnly}
      />
    </Field>
  );
}

function StageProductsEditor({
  products,
  onChange,
  producerId,
  crop,
  farmId,
  overBudgetProductIds,
}: {
  products: StageProductDraft[];
  onChange: (products: StageProductDraft[]) => void;
  producerId?: string;
  crop?: string;
  farmId?: string;
  overBudgetProductIds: Set<string>;
}) {
  const { productList, isLoading } = usePurchaseListCatalogProducts(
    producerId,
    crop,
    farmId,
  );

  const availableCategories = useMemo(() => {
    const categories = new Set(productList.map((product) => product.category ?? "OTHER"));
    return GLOBAL_PRODUCT_CATEGORIES.filter((category) => categories.has(category));
  }, [productList]);

  const updateProduct = (key: string, patch: Partial<StageProductDraft>) => {
    onChange(products.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeProduct = (key: string) => {
    onChange(products.filter((item) => item.key !== key));
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Produtos da etapa</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Como funcionam os produtos desta etapa"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className="max-w-xs text-left leading-relaxed">
              Só aparecem aqui os insumos já incluídos na lista de compra deste produtor. Para
              usar outros produtos, adicione-os primeiro na lista de compra da fazenda.
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={isLoading || productList.length === 0}
          onClick={() => onChange([...products, newStageProductDraft()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando produtos da lista de compra…</p>
      ) : productList.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Nenhum produto na lista de compra deste produtor
          {crop ? ` para ${(CROP_LABELS[crop] ?? crop).toLowerCase()}` : ""}. Volte à fazenda e
          adicione insumos na lista de compra antes de montar a receita desta etapa.
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Nenhum produto nesta etapa. Adicione insumos e doses por hectare.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((item) => {
            const rowProducts = productsForCategory(productList, item.category);
            return (
            <div
              key={item.key}
              className={cn(
                "grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_120px_88px_auto]",
                item.productId &&
                  overBudgetProductIds.has(item.productId) &&
                  "border-destructive/40 bg-destructive/5",
              )}
            >
              <Field label="Categoria">
                <Select
                  value={item.category}
                  onValueChange={(nextCategory) => {
                    const patch: Partial<StageProductDraft> = { category: nextCategory };
                    const currentProduct = productList.find((product) => product.id === item.productId);
                    if (
                      item.productId &&
                      currentProduct &&
                      (currentProduct.category ?? "OTHER") !== nextCategory
                    ) {
                      patch.productId = "";
                      patch.productName = "";
                    }
                    updateProduct(item.key, patch);
                  }}
                  placeholder="Selecione…"
                  filterLabel="Categoria"
                  options={availableCategories.map((category) => ({
                    value: category,
                    label: PRODUCT_CATEGORY_LABELS[category],
                  }))}
                  className="w-full"
                />
              </Field>
              <div className="min-w-0">
                <Field label="Produto">
                <SearchableSelect
                  value={item.productId}
                  onValueChange={(productId) => {
                    const selected = rowProducts.find((product) => product.id === productId);
                    updateProduct(item.key, {
                      productId,
                      productName: selected?.name ?? "",
                      unit: selected?.dose_unit ?? item.unit,
                    });
                  }}
                  disabled={!item.category}
                  placeholder={item.category ? "Selecione…" : "Escolha a categoria"}
                  filterLabel="Buscar produto"
                  searchPlaceholder="Buscar produto…"
                  selectedLabel={item.productName || undefined}
                  options={rowProducts.map((product) => ({
                    value: product.id,
                    label: product.name,
                    keywords: product.name,
                  }))}
                  className="w-full"
                />
                </Field>
              </div>
              <Field label="Dose/ha">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.dose}
                  onChange={(e) => updateProduct(item.key, { dose: e.target.value })}
                  placeholder="0"
                  aria-invalid={item.productId ? overBudgetProductIds.has(item.productId) : undefined}
                  className={cn(
                    item.productId &&
                      overBudgetProductIds.has(item.productId) &&
                      "border-destructive/50 focus-visible:ring-destructive/20",
                  )}
                />
              </Field>
              <Field label="Un.">
                <DoseUnitSelect
                  value={item.unit}
                  onChange={(unit) => updateProduct(item.key, { unit })}
                  className="w-full"
                />
              </Field>
              <div className="flex items-end justify-end sm:pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label="Remover produto"
                  onClick={() => removeProduct(item.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export function TimingStagesEditor({
  stages,
  onChange,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  isAdding = false,
  minStages = 1,
  showProducts = false,
  producerId,
  crop,
  farmId,
  className,
  onSave,
  isSaving = false,
  saveDisabled = false,
  showSaveButton = false,
}: {
  stages: TimingStageField[];
  onChange: (key: string, patch: Partial<TimingStageField>) => void;
  onAdd: (presetName?: string) => void;
  onRemove: (key: string) => void;
  onMoveUp?: (key: string) => void;
  onMoveDown?: (key: string) => void;
  isAdding?: boolean;
  minStages?: number;
  showProducts?: boolean;
  producerId?: string;
  crop?: string;
  farmId?: string;
  className?: string;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  showSaveButton?: boolean;
}) {
  const { purchaseLists } = usePurchaseListCatalogProducts(producerId, crop, farmId);

  const overages = useMemo(
    () =>
      showProducts && purchaseLists.length > 0
        ? findPurchaseListOverages(stages, purchaseLists, crop)
        : [],
    [crop, purchaseLists, showProducts, stages],
  );

  const overBudgetProductIds = useMemo(
    () => new Set(overages.map((item) => item.productId)),
    [overages],
  );

  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Etapas de aplicação</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Defina a ordem e as janelas de cada aplicação. Dessecação entra como estágio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSaveButton && onSave ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={isSaving || saveDisabled}
              onClick={onSave}
            >
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isAdding || isSaving}
            onClick={() => onAdd()}
          >
            <Plus className="h-4 w-4" />
            {isAdding ? "Adicionando…" : "Adicionar etapa"}
          </Button>
        </div>
      </div>

      {overages.length > 0 ? (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Produtos acima da lista de compra</p>
            <p className="mt-1 text-destructive/90">
              Os produtos indicados superam a quantidade prevista na lista de compra:
            </p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {overages.map((item) => (
                <li key={item.productId}>
                  <span className="font-medium">{item.productName}</span>{" "}
                  — previsto {formatDosePerHa(item.plannedDosePerHa, item.unit)}, indicado{" "}
                  {formatDosePerHa(item.recommendedDosePerHa, item.unit)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {stages.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma etapa cadastrada. Adicione a primeira etapa.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((stage, index) => (
            <div key={stage.key} className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {onMoveUp && onMoveDown ? (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => onMoveUp(stage.key)}
                        disabled={index === 0}
                        aria-label="Mover para cima"
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDown(stage.key)}
                        disabled={index === stages.length - 1}
                        aria-label="Mover para baixo"
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Etapa {index + 1}
                  </span>
                </div>
                {stages.length > minStages ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => onRemove(stage.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input
                    value={stage.name}
                    onChange={(e) => onChange(stage.key, { name: e.target.value })}
                    placeholder="Ex: 1ª Fungicida"
                  />
                </Field>
                <Field label="Fase">
                  <Select
                    value={stage.trigger_type}
                    onValueChange={(trigger_type) => onChange(stage.key, { trigger_type })}
                    options={TIMING_TRIGGER_TYPES.map(({ value, label }) => ({
                      value,
                      label,
                    }))}
                  />
                </Field>
                <StageWindowDateFields
                  recommendedDate={stage.recommended_date}
                  onRecommendedDateChange={(recommended_date) =>
                    onChange(stage.key, { recommended_date })
                  }
                />
                <div className="space-y-1.5 sm:col-span-2">
                  <Field label="Observações">
                    <Textarea
                      value={stage.notes}
                      onChange={(e) => onChange(stage.key, { notes: e.target.value })}
                      placeholder="Instruções, condições de aplicação ou observações desta etapa…"
                      rows={3}
                    />
                  </Field>
                </div>
              </div>
              {showProducts ? (
                <StageProductsEditor
                  products={stage.products}
                  onChange={(products) => onChange(stage.key, { products })}
                  producerId={producerId}
                  crop={crop}
                  farmId={farmId}
                  overBudgetProductIds={overBudgetProductIds}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
