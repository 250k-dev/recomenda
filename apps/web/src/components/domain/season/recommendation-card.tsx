"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SearchableSelect } from "@/components/ui/select";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { cn, GLOBAL_PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import {
  useApplyRecommendation,
  useCloneGlobalProduct,
  useCreateRecommendationItem,
  useDeleteRecommendationItem,
  usePatchRecommendation,
  useSeasonCostPlan,
  useSkipRecommendation,
  useUndoRecommendation,
  useUpdateRecommendationItem,
} from "@recomenda/api-hooks";
import {
  productsForPurchaseListCategory,
  purchaseListProductLabel,
  type PurchaseListCatalogProduct,
} from "@recomenda/domain/catalog/purchase-list-catalog";
import type { Recommendation, RecommendationItem } from "@recomenda/api";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  FlaskConical,
  Pencil,
  Plus,
  Save,
  SkipForward,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import {
  RecommendationStageFields,
  recommendationToStageDraft,
  type RecommendationStageDraft,
} from "@/components/domain/recommendation-stage-fields";
import {
  recommendedYmdToWindow,
  todayLocalYmd,
} from "@recomenda/domain/timing/window-days";
import { SEED_CATEGORIES } from "@recomenda/domain/purchase-list/list-item";
import { displayRecStatus, fmtDate } from "@recomenda/domain/recommendations/format";

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
}: {
  item: RecommendationItem;
  seasonId: string;
  onDelete: (id: string) => void;
  outOfProgram?: boolean;
  canDelete?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [dose, setDose] = useState(String(item.dose_per_hectare));
  const [unit, setUnit] = useState<string>(item.dose_unit ?? "L");
  const updateMut = useUpdateRecommendationItem(seasonId);

  const handleSave = () => {
    const parsed = parseFloat(dose.replace(",", "."));
    if (!parsed || parsed <= 0) return;
    updateMut.mutate(
      { id: item.id, dose_per_hectare: parsed, dose_unit: unit },
      {
        onSuccess: () => {
          toast.success("Dose atualizada.");
          setEditing(false);
        },
        onError: () => toast.error("Não foi possível atualizar a dose."),
      },
    );
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm",
        outOfProgram && "border-destructive/40 bg-destructive/5",
      )}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 min-w-0 font-medium text-foreground">
        {item.product_name}
        {item.is_substitution && (
          <span className="ml-1.5 text-[10px] text-warning-strong">
            (substituído)
          </span>
        )}
        {outOfProgram ? (
          <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive align-middle">
            <CircleAlert className="w-3 h-3" />
            Fora da programação
          </span>
        ) : null}
      </span>

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="w-20 text-xs text-right h-7 tabular-nums"
          />
          <DoseUnitSelect
            value={unit}
            onChange={setUnit}
            className="text-xs h-7"
          />
          <span className="text-xs shrink-0 text-muted-foreground">/ha</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-primary"
            onClick={handleSave}
            disabled={updateMut.isPending}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => {
              setEditing(false);
              setDose(String(item.dose_per_hectare));
              setUnit(item.dose_unit ?? "L");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs shrink-0 tabular-nums text-muted-foreground">
            {item.dose_per_hectare} {item.dose_unit}/ha
          </span>
          {item.total_quantity > 0 && (
            <span className="hidden text-xs shrink-0 tabular-nums text-muted-foreground sm:inline">
              ·{" "}
              {item.total_quantity.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}{" "}
              {item.dose_unit} total
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          {canDelete ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AddProductRow({
  recommendationId,
  seasonId,
  onClose,
  catalogProducts,
  listProductIds,
  listDoseByProductId,
}: {
  recommendationId: string;
  seasonId: string;
  onClose: () => void;
  catalogProducts: PurchaseListCatalogProduct[];
  listProductIds: Set<string>;
  /** Dose planejada na lista de compra, por produto — pré-preenche a dose. */
  listDoseByProductId: Map<string, { dose: number; unit: string }>;
}) {
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("L");
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const createMut = useCreateRecommendationItem(seasonId);
  const cloneGlobal = useCloneGlobalProduct();

  // Por padrão só a lista de compra; ao expandir, o catálogo completo (global +
  // local). Produtos fora da lista entram marcados como "fora da programação".
  const listCatalog = useMemo(
    () =>
      catalogProducts.filter((product) =>
        listProductIds.has(product.optionValue),
      ),
    [catalogProducts, listProductIds],
  );
  const rowProducts = productsForPurchaseListCategory(
    expanded ? catalogProducts : listCatalog,
    category,
    productId,
    productName,
  );
  const outOfProgram = Boolean(productId) && !listProductIds.has(productId);

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
      // Produto da lista de compra: traz a dose planejada (sem sobrescrever uma
      // dose já digitada nesta linha).
      const planned = listDoseByProductId.get(localId);
      setProductId(localId);
      setProductName(name);
      setUnit(planned?.unit ?? doseUnit ?? "L");
      if (!dose && planned) setDose(String(planned.dose));
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
                  : "Nenhum produto desta categoria na lista de compra."
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

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dose/ha</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              className="h-8 text-sm w-28"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Un.</Label>
            <DoseUnitSelect value={unit} onChange={setUnit} className="h-8" />
          </div>
          <span className="pb-1 text-xs text-muted-foreground">/ha</span>
          <div className="flex gap-1 ml-auto">
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
  onDelete,
  canDelete = true,
}: {
  item: RecommendationItem;
  onDelete: (id: string) => void;
  canDelete?: boolean;
}) {
  const seedsPerUnit = item.dose_unit === "SACA" ? 60000 : 5000000;
  const population = Number(item.dose_per_hectare) * seedsPerUnit;
  const unitLabel = item.dose_unit === "SACA" ? "sacos" : "Big Bags";
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-card">
      <Sprout className="h-3.5 w-3.5 shrink-0 text-primary-strong" />
      <span className="flex-1 min-w-0 font-medium text-foreground">
        {item.product_name}
      </span>
      <span className="text-xs shrink-0 tabular-nums text-muted-foreground">
        {population.toLocaleString("pt-BR")} plantas/ha
        {item.total_quantity
          ? ` · ${item.total_quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unitLabel}`
          : ""}
      </span>
      {canDelete ? (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-danger-strong"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
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
  const [selectedId, setSelectedId] = useState("");
  const createMut = useCreateRecommendationItem(seasonId);

  const listSeeds = (plan?.items ?? []).filter((it) =>
    SEED_CATEGORIES.includes(it.category),
  );
  const selected = listSeeds.find((s) => s.local_product_id === selectedId);

  const handleAdd = () => {
    if (!selected) return toast.error("Selecione a semente.");
    const seedsPerUnit =
      selected.category === "HIBRIDO_MILHO" ? 60000 : 5000000;
    const unit = selected.category === "HIBRIDO_MILHO" ? "SACA" : "BAG";
    const pop = selected.thousand_plants_per_ha ?? 0;
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
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isReordering,
  canReorder,
  canEditStructure = true,
  catalogProducts,
  listProductIds,
  listDoseByProductId,
  listReady,
}: {
  rec: Recommendation;
  index: number;
  seasonId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isReordering: boolean;
  canReorder: boolean;
  canEditStructure?: boolean;
  catalogProducts: PurchaseListCatalogProduct[];
  listProductIds: Set<string>;
  listDoseByProductId: Map<string, { dose: number; unit: string }>;
  listReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingSeed, setAddingSeed] = useState(false);
  const [stageDraft, setStageDraft] = useState<RecommendationStageDraft>(() =>
    recommendationToStageDraft(rec),
  );

  // Semente é um item da etapa com unidade Big Bag/Saca (separada dos produtos).
  const isSeedRow = (it: RecommendationItem) =>
    it.dose_unit === "BAG" || it.dose_unit === "SACA";
  const productItems = rec.items.filter((it) => !isSeedRow(it));
  const seedItems = rec.items.filter((it) => isSeedRow(it));

  const [registering, setRegistering] = useState(false);
  const [executedDate, setExecutedDate] = useState(
    rec.executed_date
      ? rec.executed_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [execNotes, setExecNotes] = useState(rec.notes ?? "");

  const patchMut = usePatchRecommendation(seasonId);
  const deleteMut = useDeleteRecommendationItem(seasonId);
  const applyMut = useApplyRecommendation(seasonId);
  const skipMut = useSkipRecommendation(seasonId);
  const undoMut = useUndoRecommendation(seasonId);
  const isBusy =
    patchMut.isPending ||
    deleteMut.isPending ||
    applyMut.isPending ||
    skipMut.isPending ||
    undoMut.isPending;

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
        onError: () => toast.error("Não foi possível registrar."),
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
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
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
          "flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
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

        <div className="flex-1 min-w-0">
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

        <div className="flex shrink-0 items-center gap-2.5">
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
        <div className="flex flex-col gap-4 px-4 pt-3 pb-4 border-t">
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
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleSaveStage}
                  disabled={isBusy}
                  className="h-8 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar etapa
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Etapas aplicadas ou puladas não podem ter nome e data alterados.
              </p>
            )}
          </div>

          <div className="p-4 border shadow-sm rounded-xl bg-card">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Produtos recomendados
            </p>
            {productItems.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {productItems.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    seasonId={seasonId}
                    onDelete={handleDeleteItem}
                    canDelete={canEditStructure}
                    outOfProgram={
                      listReady && !listProductIds.has(item.local_product_id)
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
                      onDelete={handleDeleteItem}
                      canDelete={canEditStructure}
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
                  onClose={() => setAddingProduct(false)}
                  catalogProducts={catalogProducts}
                  listProductIds={listProductIds}
                  listDoseByProductId={listDoseByProductId}
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
    </li>
  );
}
