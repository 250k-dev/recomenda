"use client";

import { useMemo, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, CircleAlert, FlaskConical, GripVertical, Info, ListOrdered, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { BrazilianDateInput } from "@recomenda/ui/forms/brazilian-date-input";
import { Textarea } from "@recomenda/ui/primitives/textarea";
import { Select, SearchableSelect } from "@recomenda/ui/forms/select";
import { DoseUnitSelect } from "@/components/domain/dose-unit-select";
import { QuickCreateProductDialog } from "@/components/domain/quick-create-product-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@recomenda/ui/primitives/tooltip";
import { Field } from "@/components/domain/season/_shared";
import {
  usePlatformCatalog,
  useGlobalCatalog,
  useCloneGlobalProduct,
  useProducerPurchaseLists,
  useFarmPurchaseLists,
} from "@recomenda/api-hooks";
import { useProducerStock } from "@recomenda/api-hooks/producers";
import { cn, GLOBAL_PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import { toast } from "sonner";
import {
  buildPurchaseListCatalog,
  productsForPurchaseListCategory,
  purchaseListProductLabel,
  type PurchaseListCatalogProduct,
} from "@recomenda/domain/catalog/purchase-list-catalog";
import {
  dayOffsetToIsoDate,
  isoDateToDayOffset,
} from "@recomenda/domain/timing/window-days";
import type { StageProductDraft } from "@recomenda/domain/timing/types";
import { suggestPhenologicalStage } from "@recomenda/domain/recommendations/phenology";
import {
  applicationSummary,
  emptyApplicationData,
  type ApplicationDataDraft,
} from "@/components/domain/application-data-fields";
import { ApplicationDataDialog } from "@/components/domain/application-data-dialog";
import {
  findPurchaseListOverages,
  formatDosePerHa,
} from "@recomenda/domain/timing/purchase-list-budget";
import { useCan } from "@recomenda/api-hooks/use-can";

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

export function usePurchaseListCatalogProducts(
  producerId?: string,
  crop?: string,
  farmId?: string,
) {
  const platformCatalog = usePlatformCatalog();
  const globalCatalog = useGlobalCatalog();
  const { data: producerLists, isLoading: listsLoading } = useProducerPurchaseLists(
    producerId ?? "",
  );
  const { data: farmLists, isLoading: farmListsLoading } = useFarmPurchaseLists(
    farmId ?? "",
  );
  const { data: producerStock, isLoading: stockLoading } = useProducerStock(
    producerId ?? "",
  );

  const purchaseLists = useMemo(() => {
    const source =
      farmId && (farmLists?.length ?? 0) > 0
        ? (farmLists ?? [])
        : (producerLists ?? []);
    return crop
      ? source.filter(
          (list) =>
            list.status !== "draft" &&
            (list.crop === crop || list.crop === "ANY"),
        )
      : source.filter((list) => list.status !== "draft");
  }, [crop, farmId, farmLists, producerLists]);

  // Catálogo completo: global (admin) + local (agrônomo). Sementes ficam de fora (item 12).
  const catalogProducts = useMemo(() => {
    const seedCategories = ["SEED", "CULTIVAR_SOJA", "HIBRIDO_MILHO", "CULTIVAR_FEIJAO"];
    const base = buildPurchaseListCatalog(
      platformCatalog.data?.data ?? [],
      globalCatalog.data?.data ?? [],
    ).filter((product) => !seedCategories.includes(product.category));

    // Produto que já está numa lista de compra ativa mas sumiu do catálogo —
    // tipicamente desativado DEPOIS de entrar na lista. Sem isto o item segue
    // na lista mas some do seletor da recomendação (o catálogo filtra inativo).
    // Mexer no produto não pode reescrever uma safra em andamento: reinjeta a
    // opção a partir do snapshot do item. Escopo: só produtos já na lista — não
    // ressuscita o produto para listas/adições novas.
    const known = new Set(base.map((product) => product.optionValue));
    const listOnly = new Map<string, PurchaseListCatalogProduct>();
    for (const list of purchaseLists) {
      for (const item of list.items) {
        const id = item.local_product_id;
        if (!id || known.has(id) || listOnly.has(id)) continue;
        const category = item.category ?? "OTHER";
        if (seedCategories.includes(category)) continue;
        listOnly.set(id, {
          optionValue: id,
          name: item.product_name,
          category,
          dose_unit: item.dose_unit ?? "L",
          globalId: null,
          isGlobalOnly: false,
          crop: null,
          equivalence_group: item.equivalence_group ?? null,
        });
      }
    }
    if (listOnly.size === 0) return base;
    return [...base, ...listOnly.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [platformCatalog.data?.data, globalCatalog.data?.data, purchaseLists]);

  // Produtos que já estão na lista de compra (o que está "na programação").
  const listProductIds = useMemo(
    () =>
      new Set(
        purchaseLists.flatMap((list) => list.items.map((item) => item.local_product_id)),
      ),
    [purchaseLists],
  );

  // Produtos que o produtor já tem em estoque (quantity > 0) — também contam
  // como "na programação": o produtor pode usar o que já tem sem estar na lista.
  const stockProductIds = useMemo(
    () =>
      new Set(
        (producerStock ?? [])
          .filter((stock) => Number(stock.quantity) > 0)
          .map((stock) => stock.local_product_id),
      ),
    [producerStock],
  );

  // Conjunto "na programação" = lista de compra ∪ estoque disponível.
  const inProgramProductIds = useMemo(
    () => new Set([...listProductIds, ...stockProductIds]),
    [listProductIds, stockProductIds],
  );

  return {
    catalogProducts,
    listProductIds,
    stockProductIds,
    inProgramProductIds,
    purchaseLists,
    isLoading:
      platformCatalog.isLoading ||
      globalCatalog.isLoading ||
      (Boolean(producerId) && listsLoading) ||
      (Boolean(producerId) && stockLoading) ||
      (Boolean(farmId) && farmListsLoading),
  };
}

export type TimingStageField = {
  key: string;
  name: string;
  trigger_type: string;
  recommended_date: string;
  notes: string;
  /** Receita de aplicação (vazão, horário, ponta, estádio). Opcional: rascunho
   *  local salvo antes deste campo existir não o tem. */
  application?: ApplicationDataDraft;
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
    application: emptyApplicationData(),
    products: [],
  };
}

/** Acima disso o "Período" do modelo quase sempre é número errado (ex.: ~260
 *  dias, sobra da data "hoje" contada de 01/01). Só avisa — não bloqueia. */
const SUSPICIOUS_STAGE_DAYS = 150;

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
      {Math.abs(targetDay) > SUSPICIOUS_STAGE_DAYS ? (
        <p className="text-xs font-medium text-warning-strong">
          {targetDay} dias a partir do marco da fase é fora do comum para uma
          safra. Confira se o número está certo.
        </p>
      ) : null}
    </Field>
  );
}

/**
 * `program` (safra): o seletor mostra a lista de compra/estoque e o resto entra
 * como "fora da programação". `full` (modelo): catálogo completo, sem esse selo.
 */
export type StageCatalogMode = "program" | "full";

function StageProductsEditor({
  products,
  onChange,
  producerId,
  crop,
  farmId,
  overBudgetProductIds,
  catalogMode,
}: {
  products: StageProductDraft[];
  onChange: (products: StageProductDraft[]) => void;
  producerId?: string;
  crop?: string;
  farmId?: string;
  overBudgetProductIds: Set<string>;
  catalogMode: StageCatalogMode;
}) {
  const { catalogProducts, inProgramProductIds, purchaseLists, isLoading } =
    usePurchaseListCatalogProducts(producerId, crop, farmId);
  const cloneGlobal = useCloneGlobalProduct();

  // Dose planejada na lista de compra, por produto — pré-preenche a dose ao
  // selecionar o produto, para o agrônomo não digitar de novo o que já planejou.
  const listDoseByProductId = useMemo(() => {
    const map = new Map<string, { dose: number; unit: string }>();
    for (const list of purchaseLists) {
      for (const item of list.items) {
        if (map.has(item.local_product_id)) continue;
        if (Number(item.dose_per_hectare) > 0) {
          map.set(item.local_product_id, {
            dose: Number(item.dose_per_hectare),
            unit: item.dose_unit,
          });
        }
      }
    }
    return map;
  }, [purchaseLists]);
  // Produto digitado que não existe: abre o cadastro rápido (unidade + formulação).
  const [quickCreate, setQuickCreate] = useState<{
    key: string;
    category: string;
    name: string;
  } | null>(null);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Todas as categorias de defensivo/fertilizante (sementes já saíram do catálogo).
  const availableCategories = useMemo(
    () =>
      GLOBAL_PRODUCT_CATEGORIES.filter(
        (category) =>
          category !== "SEED" &&
          category !== "CULTIVAR_SOJA" &&
          category !== "HIBRIDO_MILHO" &&
          category !== "CULTIVAR_FEIJAO",
      ),
    [],
  );

  // Produtos "na programação" — lista de compra ∪ estoque do produtor. Mostrados
  // por padrão na recomendação (o produtor pode usar o que já tem em estoque).
  const listCatalog = useMemo(
    () => catalogProducts.filter((product) => inProgramProductIds.has(product.optionValue)),
    [catalogProducts, inProgramProductIds],
  );

  // Modo "full" (catálogo completo, sem "fora da programação"): hoje sem uso.
  // O modelo de recomendação voltou a "program" em 02/10 — o catálogo completo
  // confundia o cliente. Mantido para um eventual retorno.
  const fullCatalog = catalogMode === "full";
  const suggestedFirstCatalog = useMemo(
    () => [
      ...listCatalog,
      ...catalogProducts.filter((product) => !inProgramProductIds.has(product.optionValue)),
    ],
    [catalogProducts, inProgramProductIds, listCatalog],
  );

  const updateProduct = (key: string, patch: Partial<StageProductDraft>) => {
    onChange(products.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeProduct = (key: string) => {
    onChange(products.filter((item) => item.key !== key));
  };

  const moveProduct = (from: number, to: number) => {
    if (to < 0 || to >= products.length || from === to) return;
    const next = [...products];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const resolveProduct = async (
    key: string,
    optionValue: string,
    rowProducts: PurchaseListCatalogProduct[],
  ) => {
    const product = rowProducts.find((entry) => entry.optionValue === optionValue);
    if (!product) return;
    const apply = (localId: string, name: string, unit?: string) => {
      // Produto da lista de compra: traz a dose planejada (sem sobrescrever uma
      // dose que o agrônomo já tenha digitado nesta linha).
      const planned = listDoseByProductId.get(localId);
      const currentDose = products.find((item) => item.key === key)?.dose ?? "";
      updateProduct(key, {
        productId: localId,
        productName: name,
        unit: planned?.unit ?? unit ?? "L",
        dose: currentDose || (planned ? String(planned.dose) : currentDose),
        outOfProgram: !fullCatalog && !inProgramProductIds.has(localId),
      });
    };
    if (!product.globalId || !product.isGlobalOnly) {
      apply(product.optionValue, product.name, product.dose_unit);
      return;
    }
    setResolvingKey(key);
    try {
      const cloned = await cloneGlobal.mutateAsync(product.globalId);
      apply(cloned.id, cloned.name ?? product.name, cloned.dose_unit ?? product.dose_unit);
    } catch {
      toast.error("Não foi possível adicionar o produto da plataforma.");
    } finally {
      setResolvingKey(null);
    }
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
              {fullCatalog ? (
                <>
                  O modelo usa o catálogo completo (global + local). Os insumos da lista de compra
                  ou do estoque do produtor aparecem primeiro. Ao aplicar o modelo numa safra, o
                  que não estiver na lista entra nela como “fora da programação”.
                </>
              ) : (
                <>
                  O ideal é usar os insumos da lista de compra ou o que o produtor já tem em estoque.
                  Mas dá pra buscar qualquer produto do catálogo (global + local) ou cadastrar um novo —
                  itens fora da lista e sem estoque entram marcados como “fora da programação”.
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={isLoading}
          onClick={() => onChange([...products, newStageProductDraft()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando catálogo de produtos…</p>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Nenhum produto nesta etapa. Adicione insumos e doses por hectare.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((item, index) => {
            const expanded = fullCatalog || expandedKeys.has(item.key);
            // O selo não é gravado: ao reabrir o modelo, recalcula contra a
            // lista/estoque (antes sumia e o produto parecia "da programação").
            const outOfProgram =
              !fullCatalog &&
              (Boolean(item.outOfProgram) ||
                (!isLoading &&
                  Boolean(item.productId) &&
                  !inProgramProductIds.has(item.productId)));
            const rowProducts = productsForPurchaseListCategory(
              fullCatalog ? suggestedFirstCatalog : expanded ? catalogProducts : listCatalog,
              item.category,
              item.productId,
              item.productName,
            );
            return (
            <div
              key={item.key}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                if (dragIndex == null || dragIndex === index) return;
                moveProduct(dragIndex, index);
                setDragIndex(index);
              }}
              className={cn(
                "grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1.1fr)_120px_88px_auto]",
                ((item.productId && overBudgetProductIds.has(item.productId)) ||
                  outOfProgram) &&
                  "border-destructive/40 bg-destructive/5",
                dragIndex === index && "opacity-60 ring-1 ring-primary/40",
              )}
            >
              <div className="flex items-center gap-1 sm:items-end sm:pb-0.5">
                <div className="flex sm:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-r-none"
                    disabled={index === 0}
                    aria-label="Subir produto na ordem de mistura"
                    onClick={() => moveProduct(index, index - 1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="-ml-px size-9 rounded-l-none"
                    disabled={index === products.length - 1}
                    aria-label="Descer produto na ordem de mistura"
                    onClick={() => moveProduct(index, index + 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.key);
                    e.dataTransfer.effectAllowed = "move";
                    setDragIndex(index);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  title="Arrastar para reordenar"
                  aria-label="Arrastar produto na ordem de mistura"
                  className="hidden size-9 shrink-0 cursor-grab items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground active:cursor-grabbing sm:inline-flex"
                >
                  <GripVertical className="size-[18px]" strokeWidth={2.25} />
                </span>
              </div>
              <Field label="Categoria">
                <Select
                  value={item.category}
                  onValueChange={(nextCategory) => {
                    const patch: Partial<StageProductDraft> = { category: nextCategory };
                    if (item.productId) {
                      patch.productId = "";
                      patch.productName = "";
                      patch.outOfProgram = false;
                    }
                    updateProduct(item.key, patch);
                    setExpandedKeys((prev) => {
                      const next = new Set(prev);
                      next.delete(item.key);
                      return next;
                    });
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
                  onValueChange={(optionValue) => {
                    void resolveProduct(item.key, optionValue, rowProducts);
                  }}
                  disabled={!item.category || resolvingKey === item.key}
                  loading={resolvingKey === item.key}
                  loadingMessage="Vinculando…"
                  placeholder={item.category ? "Selecione…" : "Escolha a categoria"}
                  filterLabel="Buscar produto"
                  searchPlaceholder={
                    expanded
                      ? "Buscar no catálogo ou digitar p/ cadastrar…"
                      : "Buscar produto…"
                  }
                  emptyMessage={
                    expanded
                      ? "Nenhum produto encontrado no catálogo."
                      : "Nenhum produto desta categoria na lista de compra."
                  }
                  selectedLabel={item.productName || undefined}
                  options={rowProducts.map((product) => ({
                    value: product.optionValue,
                    label: purchaseListProductLabel(product),
                    keywords: product.name,
                  }))}
                  className="w-full"
                  footer={({ query, close }) =>
                    !item.category ? null : !expanded ? (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setExpandedKeys((prev) => new Set(prev).add(item.key))
                        }
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/8"
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        Adicionar produto fora da lista de compra
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!query.trim()}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuickCreate({
                            key: item.key,
                            category: item.category || "OTHER",
                            name: query.trim(),
                          });
                          close();
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/8 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        {query.trim()
                          ? fullCatalog
                            ? `Cadastrar "${query.trim()}"`
                            : `Cadastrar "${query.trim()}" (fora da programação)`
                          : "Digite um nome para cadastrar"}
                      </button>
                    )
                  }
                />
                {outOfProgram ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive">
                    <CircleAlert className="h-3 w-3" />
                    Fora da programação
                  </span>
                ) : null}
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
              <div className="sm:col-span-full">
                <Input
                  value={item.target ?? ""}
                  onChange={(e) => updateProduct(item.key, { target: e.target.value })}
                  placeholder="Alvo / observação na receita (ex.: Gramíneas — capim-amargoso)"
                  aria-label="Alvo do produto"
                  maxLength={240}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          );
          })}
        </div>
      )}
      <QuickCreateProductDialog
        open={quickCreate !== null}
        initialName={quickCreate?.name ?? ""}
        category={quickCreate?.category ?? ""}
        defaultUnit="L"
        onCancel={() => setQuickCreate(null)}
        onCreated={(created) => {
          if (quickCreate) {
            updateProduct(quickCreate.key, {
              productId: created.id,
              productName: created.name,
              unit: created.dose_unit,
              outOfProgram: !fullCatalog,
            });
          }
          setQuickCreate(null);
        }}
      />
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
  onMixOrder,
  catalogMode = "program",
  floatingActions = false,
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
  onMixOrder?: () => void;
  catalogMode?: StageCatalogMode;
  /** "Salvar" e "Adicionar etapa" numa barra fixa no rodapé da janela (padrão
   *  do template de compras), em vez do topo. Só para telas sem rodapé próprio. */
  floatingActions?: boolean;
}) {
  const canTemplateCrud = useCan("TEMPLATE_CRUD");
  // Etapa com o modal "Dados da aplicação" aberto.
  const [applicationKey, setApplicationKey] = useState<string | null>(null);
  const applicationStage = applicationKey
    ? stages.find((stage) => stage.key === applicationKey) ?? null
    : null;
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
    <section
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm",
        // Espaço para o fim da última etapa não ficar embaixo da barra fixa.
        floatingActions && "mb-28 md:mb-20",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Etapas de aplicação</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Defina a ordem e as janelas de cada aplicação. Dessecação entra como estágio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onMixOrder ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onMixOrder}
            >
              <ListOrdered className="h-4 w-4" />
              Ordem de mistura
            </Button>
          ) : null}
          {!floatingActions && showSaveButton && onSave ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={isSaving || saveDisabled}
              onClick={onSave}
            >
              {isSaving ? "Salvando…" : saveDisabled ? "Salvo ✓" : "Salvar"}
            </Button>
          ) : null}
          {!floatingActions && canTemplateCrud ? (
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
          ) : null}
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
                {canTemplateCrud && stages.length > minStages ? (
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
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Dados da aplicação (receita)
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {applicationSummary(stage.application) ?? "Não preenchido"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => setApplicationKey(stage.key)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Dados da aplicação
                </Button>
              </div>
              {showProducts ? (
                <StageProductsEditor
                  products={stage.products}
                  onChange={(products) => onChange(stage.key, { products })}
                  producerId={producerId}
                  crop={crop}
                  farmId={farmId}
                  overBudgetProductIds={overBudgetProductIds}
                  catalogMode={catalogMode}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {applicationStage ? (
        <ApplicationDataDialog
          open
          onOpenChange={(next) => {
            if (!next) setApplicationKey(null);
          }}
          stageName={applicationStage.name || "Etapa"}
          value={applicationStage.application ?? emptyApplicationData()}
          stageSuggestion={
            suggestPhenologicalStage(
              crop,
              applicationStage.trigger_type,
              isoDateToDayOffset(applicationStage.recommended_date),
              isoDateToDayOffset(applicationStage.recommended_date),
            ).stage
          }
          readOnly={!canTemplateCrud}
          onSave={(application) => {
            // Vai para o rascunho do modelo; grava no "Salvar" do modelo.
            onChange(applicationStage.key, { application });
            setApplicationKey(null);
          }}
        />
      ) : null}

      {/* Lista longa: barra fixa no rodapé do viewport para adicionar etapa sem
          rolar de volta ao topo do editor. */}
      {floatingActions ? (
        // Faixa fixa no rodapé da janela (mesmo padrão do template de compras):
        // salvar e adicionar etapa ficam à mão em qualquer ponto do modelo.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 shadow-[0_-6px_20px_-8px_rgb(0_0_0/0.25)] backdrop-blur">
          <div className="mx-auto grid w-full max-w-[calc(var(--container-app)+2rem)] grid-cols-2 gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex md:max-w-[calc(var(--container-app)+4rem)] md:flex-wrap md:items-center md:justify-end md:px-8">
            {canTemplateCrud ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 md:w-auto"
                disabled={isAdding || isSaving}
                onClick={() => onAdd()}
              >
                <Plus className="h-4 w-4" />
                {isAdding ? "Adicionando…" : "Adicionar etapa"}
              </Button>
            ) : null}
            {showSaveButton && onSave ? (
              <Button
                type="button"
                className={cn("w-full gap-2 md:w-auto", !canTemplateCrud && "col-span-2")}
                disabled={isSaving || saveDisabled}
                onClick={onSave}
              >
                {isSaving ? "Salvando…" : saveDisabled ? "Salvo ✓" : "Salvar"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : stages.length > 3 ? (
        <div className="sticky bottom-3 z-10 mt-4 flex justify-end">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
            {showSaveButton && onSave ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-full"
                disabled={isSaving || saveDisabled}
                onClick={onSave}
              >
                {isSaving ? "Salvando…" : saveDisabled ? "Salvo ✓" : "Salvar"}
              </Button>
            ) : null}
            {canTemplateCrud ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
                disabled={isAdding || isSaving}
                onClick={() => onAdd()}
              >
                <Plus className="h-4 w-4" />
                Adicionar etapa
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
