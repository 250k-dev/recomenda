"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import {
  PageHeaderSkeleton,
  TimelineCardsSkeleton,
} from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SearchableSelect } from "@/components/ui/select";
import {
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import {
  useFarm,
  useProducer,
  usePublishSeason,
  useSeason,
  useSeasonTimeline,
  useCreateRecommendation,
  useReorderRecommendations,
  useApplyRecommendation,
  useSkipRecommendation,
  useUndoRecommendation,
  usePatchRecommendation,
  useCreateRecommendationItem,
  useUpdateRecommendationItem,
  useDeleteRecommendationItem,
  usePlatformCatalog,
} from "@/lib/api/hooks";
import { CostPlanView } from "@/components/domain/cost-plan/cost-plan-view";
import type { Recommendation, RecommendationItem } from "@/lib/api/client";
import {
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  SkipForward,
  Pencil,
  X,
  FlaskConical,
  Plus,
  Trash2,
  Save,
  CalendarDays,
  Leaf,
  Sprout,
} from "lucide-react";
import {
  RecommendationStageFields,
  recommendationToStageDraft,
  type RecommendationStageDraft,
} from "@/components/domain/recommendation-stage-fields";
import { todayLocalYmd } from "@/lib/timing/window-days";
import { cn } from "@/lib/utils";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";
import { extractError } from "@/components/domain/season/_shared";

type TabValue = "recommendations" | "cost-plan";

function parseSeasonTab(value: string | null): TabValue {
  return value === "cost-plan" ? "cost-plan" : "recommendations";
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-surface-2 text-muted-foreground border border-border",
  APPLIED_ON_TIME: "bg-success-soft text-success-strong border border-success-border",
  APPLIED_LATE: "bg-warning-soft text-warning-strong border border-warning-border",
  SKIPPED: "bg-clay-soft text-clay-strong border border-clay-border",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  APPLIED_ON_TIME: <CheckCircle2 className="h-3.5 w-3.5" />,
  APPLIED_LATE: <CheckCircle2 className="h-3.5 w-3.5" />,
  SKIPPED: <SkipForward className="h-3.5 w-3.5" />,
};

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

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
    originalDate &&
    originalDate.slice(0, 10) !== date.slice(0, 10);

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
        <CalendarDays className="h-3 w-3 shrink-0" />
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
}: {
  item: RecommendationItem;
  seasonId: string;
  onDelete: (id: string) => void;
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
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 font-medium text-foreground">
        {item.product_name}
        {item.is_substitution && (
          <span className="ml-1.5 text-[10px] text-warning-strong">(substituído)</span>
        )}
      </span>

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="h-7 w-20 text-right text-xs tabular-nums"
          />
          <DoseUnitSelect value={unit} onChange={setUnit} className="h-7 text-xs" />
          <span className="shrink-0 text-xs text-muted-foreground">/ha</span>
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
            onClick={() => { setEditing(false); setDose(String(item.dose_per_hectare)); setUnit(item.dose_unit ?? "L"); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="shrink-0 tabular-nums text-muted-foreground text-xs">
            {item.dose_per_hectare} {item.dose_unit}/ha
          </span>
          {item.total_quantity > 0 && (
            <span className="hidden shrink-0 tabular-nums text-muted-foreground text-xs sm:inline">
              · {item.total_quantity.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {item.dose_unit} total
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function AddProductRow({
  recommendationId,
  seasonId,
  onClose,
}: {
  recommendationId: string;
  seasonId: string;
  onClose: () => void;
}) {
  const { data: catalogData } = usePlatformCatalog();
  const catalog = catalogData?.data ?? [];
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("L");
  const createMut = useCreateRecommendationItem(seasonId);

  const rowProducts = useMemo(
    () =>
      catalog.filter(
        (product) =>
          product.local_product_id &&
          (product.category ?? "OTHER") === category,
      ),
    [catalog, category],
  );

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    const selected = catalog.find((product) => product.local_product_id === selectedId);
    if (
      selectedId &&
      selected &&
      (selected.category ?? "OTHER") !== nextCategory
    ) {
      setSelectedId("");
      setUnit("L");
    }
  };

  const handleAdd = () => {
    const localId = selectedId;
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
    <div className="rounded-xl border border-dashed bg-muted/20 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">Adicionar produto</p>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select
              value={category}
              onValueChange={handleCategoryChange}
              placeholder="Selecione…"
              filterLabel="Categoria"
              options={GLOBAL_PRODUCT_CATEGORIES.map((item) => ({
                value: item,
                label: PRODUCT_CATEGORY_LABELS[item],
              }))}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <SearchableSelect
              value={selectedId}
              onValueChange={(productId) => {
                const product = rowProducts.find(
                  (item) => item.local_product_id === productId,
                );
                setSelectedId(productId);
                setUnit(product?.dose_unit ?? "L");
              }}
              disabled={!category}
              placeholder={category ? "Selecione…" : "Escolha a categoria"}
              filterLabel="Buscar produto"
              searchPlaceholder="Buscar produto…"
              options={rowProducts.map((product) => ({
                value: product.local_product_id ?? "",
                label: product.name,
                keywords: product.name,
              }))}
              className="w-full"
            />
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
              className="h-8 w-28 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Un.</Label>
            <DoseUnitSelect value={unit} onChange={setUnit} className="h-8" />
          </div>
          <span className="pb-1 text-xs text-muted-foreground">/ha</span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!category || !selectedId || !dose || createMut.isPending}
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

function AddStagePanel({
  seasonId,
  onClose,
  onCreated,
}: {
  seasonId: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [draft, setDraft] = useState<RecommendationStageDraft>({
    name: "",
    trigger_type: "POST_PLANTING",
    recommended_date: todayLocalYmd(),
    notes: "",
  });
  const createMut = useCreateRecommendation(seasonId);

  const handleSubmit = () => {
    const trimmed = draft.name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da etapa.");
      return;
    }
    createMut.mutate(
      {
        name: trimmed,
        trigger_type: draft.trigger_type,
        predicted_date_current: draft.recommended_date || undefined,
        notes: draft.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Etapa adicionada.");
          setDraft({
            name: "",
            trigger_type: "POST_PLANTING",
            recommended_date: todayLocalYmd(),
            notes: "",
          });
          onCreated?.();
          onClose();
        },
        onError: (error: unknown) => {
          toast.error(extractError(error));
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">Nova etapa</p>
      <RecommendationStageFields
        draft={draft}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
      />
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createMut.isPending}
          className="h-8 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {createMut.isPending ? "Adicionando…" : "Adicionar etapa"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  index,
  seasonId,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isReordering,
  canReorder,
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
}) {
  const [open, setOpen] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [stageDraft, setStageDraft] = useState<RecommendationStageDraft>(() =>
    recommendationToStageDraft(rec),
  );

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
  const isDone = rec.status === "APPLIED_ON_TIME" || rec.status === "APPLIED_LATE";
  const isSkipped = rec.status === "SKIPPED";

  const handleSaveStage = () => {
    const trimmed = stageDraft.name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da etapa.");
      return;
    }
    patchMut.mutate(
      {
        id: rec.id,
        name: trimmed,
        trigger_type: stageDraft.trigger_type,
        predicted_date_current: stageDraft.recommended_date || null,
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
      { id: rec.id, executed_date: executedDate, notes: execNotes || undefined },
      {
        onSuccess: () => { toast.success("Etapa registrada como aplicada."); setRegistering(false); },
        onError: () => toast.error("Não foi possível registrar."),
      },
    );
  };

  const handleSkip = () => {
    skipMut.mutate(
      { id: rec.id, notes: execNotes || undefined },
      {
        onSuccess: () => { toast.success("Etapa marcada como pulada."); setRegistering(false); },
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors",
          isPending ? "hover:bg-primary/5" : "hover:bg-accent/40",
        )}
      >
        <div className="flex shrink-0 items-center gap-2">
          {canReorder ? (
            <div
              role="group"
              aria-label="Reordenar etapa"
              className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp || isReordering}
                aria-label="Mover etapa para cima"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="h-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown || isReordering}
                aria-label="Mover etapa para baixo"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
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

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{rec.name}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                STATUS_BADGE_CLASS[rec.status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_ICON[rec.status]}
              {STATUS_LABEL[rec.status] ?? rec.status}
            </span>
          </div>
          {rec.items.length > 0 ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {rec.items.length} {rec.items.length === 1 ? "produto" : "produtos"} na receita
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Sem produtos vinculados</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {isDone && rec.executed_date ? (
            <StageDateBadge label="Aplicado" date={rec.executed_date} tone="success" />
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
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">Dados da etapa</p>
            <RecommendationStageFields
              draft={stageDraft}
              onChange={(patch) => setStageDraft((prev) => ({ ...prev, ...patch }))}
              readOnly={!isPending}
            />
            {isPending ? (
              <div className="mt-3 flex gap-2">
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

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Produtos recomendados
            </p>
            {rec.items.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {rec.items.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    seasonId={seasonId}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum produto vinculado.</p>
            )}

            <div className="mt-2">
              {addingProduct ? (
                <AddProductRow
                  recommendationId={rec.id}
                  seasonId={seasonId}
                  onClose={() => setAddingProduct(false)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingProduct(true)}
                  className="mt-1 h-8 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar produto
                </Button>
              )}
            </div>
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
                    <span className="text-sm text-muted-foreground">· {rec.notes}</span>
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
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-surface p-3">
                    <Label className="text-xs font-semibold text-primary">Data de execução</Label>
                    <Input
                      type="date"
                      value={executedDate}
                      onChange={(e) => setExecutedDate(e.target.value)}
                      className="h-10 border-primary/30 bg-card text-sm font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Observações (opcional)</Label>
                    <Input
                      value={execNotes}
                      onChange={(e) => setExecNotes(e.target.value)}
                      placeholder="Ex: aplicado 10% a menos por chuva"
                      className="h-10 bg-card text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
                    className="ml-auto h-8"
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

function RecommendationsTab({
  seasonId,
  title,
  plotName,
  plantingDate,
  statusLabel,
  seasonStatus,
  producerId,
  onPublish,
  isPublishing,
}: {
  seasonId: string;
  title: string;
  plotName?: string;
  plantingDate?: string | null;
  statusLabel?: string;
  seasonStatus?: string;
  producerId?: string;
  onPublish?: () => void;
  isPublishing?: boolean;
}) {
  const { data, isLoading } = useSeasonTimeline(seasonId);
  const [addingStage, setAddingStage] = useState(false);
  const reorderMut = useReorderRecommendations(seasonId);

  if (isLoading) return <TimelineCardsSkeleton count={5} />;

  const recommendations = (
    Array.isArray(data) ? data : (data as { data?: unknown[] } | undefined)?.data ?? []
  ) as Recommendation[];

  const canManageStages =
    seasonStatus === "PUBLISHED" || seasonStatus === "IN_PROGRESS";

  const moveStage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= recommendations.length) return;
    const reordered = [...recommendations];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    reorderMut.mutate(reordered.map((rec) => rec.id), {
      onError: () => toast.error("Não foi possível reordenar as etapas."),
    });
  };

  if (!recommendations.length) {
    const emptyAction =
      seasonStatus === "DRAFT" && onPublish ? (
        <Button size="sm" className="gap-2" onClick={onPublish} disabled={isPublishing}>
          <Send className="h-4 w-4" />
          {isPublishing ? "Publicando…" : "Publicar safra"}
        </Button>
      ) : canManageStages ? (
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          aria-label="Adicionar etapa"
          onClick={() => setAddingStage(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      ) : producerId ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/producers/${producerId}#timing-templates`}>
            Configurar modelo de timing
          </Link>
        </Button>
      ) : undefined;

    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          variant="inline"
          title="Nenhuma recomendação encontrada para esta safra."
          description={
            seasonStatus === "DRAFT"
              ? "Publique a safra para gerar o cronograma de aplicações a partir do modelo de timing."
              : canManageStages
                ? "Adicione etapas manualmente ou configure o modelo de timing do produtor."
                : "O cronograma é gerado ao publicar a safra com um modelo de timing que tenha etapas configuradas."
          }
          action={emptyAction}
        />
        {addingStage && canManageStages ? (
          <AddStagePanel seasonId={seasonId} onClose={() => setAddingStage(false)} />
        ) : null}
      </div>
    );
  }

  const done = recommendations.filter(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  ).length;
  const total = recommendations.length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
              <Leaf className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                Safra em execução
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong">
                {title}
              </h1>
              {plotName ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sprout className="h-4 w-4 shrink-0 text-primary-strong" />
                  <span>
                    Talhão <strong className="text-text-strong">{plotName}</strong>
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 sm:justify-end">
            {plantingDate ? (
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Plantio
                </p>
                <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-text-strong">
                  {fmtDate(plantingDate)}
                </p>
              </div>
            ) : null}
            {statusLabel ? (
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Status
                </p>
                <p className="mt-0.5 text-sm font-semibold text-text-strong">{statusLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border bg-rail px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-strong">Progresso das aplicações</span>
            <span className="font-semibold tabular-nums text-primary-strong">
              {done}/{total} aplicadas
              <span className="ml-1 text-muted-foreground">({progressPct}%)</span>
            </span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-text-strong">Etapas do cronograma</h2>
        {canManageStages ? (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            aria-label="Adicionar etapa"
            onClick={() => setAddingStage((v) => !v)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {addingStage ? (
        <AddStagePanel seasonId={seasonId} onClose={() => setAddingStage(false)} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            index={i}
            seasonId={seasonId}
            canMoveUp={canManageStages && i > 0}
            canMoveDown={canManageStages && i < recommendations.length - 1}
            onMoveUp={() => moveStage(i, "up")}
            onMoveDown={() => moveStage(i, "down")}
            isReordering={reorderMut.isPending}
            canReorder={canManageStages}
          />
        ))}
      </ul>
    </div>
  );
}

export default function SeasonDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const seasonId = params.id;
  const farmIdFromQuery = searchParams.get("farm_id");
  const producerIdFromQuery = searchParams.get("producer_id");
  const activeTab = parseSeasonTab(searchParams.get("tab"));

  const publishMutation = usePublishSeason(seasonId || "");
  const { data: season, isLoading: loadingSeason } = useSeason(seasonId || "");

  const farmId = farmIdFromQuery ?? "";
  const producerId = producerIdFromQuery ?? season?.producer_id ?? "";

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId);

  if (!seasonId) {
    return <p className="text-sm text-destructive">ID da safra não encontrado.</p>;
  }

  const cropLabel = season ? CROP_LABELS[season.crop] ?? season.crop : "";
  const statusLabel = season ? STATUS_LABELS[season.status] ?? season.status : "";
  const title = season
    ? season.variety
      ? `${cropLabel} — ${season.variety}`
      : cropLabel
    : "Safra";
  const handlePublish = () => {
    publishMutation.mutate([], {
      onSuccess: () => toast.success("Safra publicada com sucesso!"),
      onError: (error: unknown) => {
        const msg = error instanceof Error ? error.message : "Falha ao publicar safra";
        toast.error(`Erro: ${msg || "Falha ao publicar safra"}`);
      },
    });
  };

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: `/producers/${producerId}` }]
      : []),
    ...(farmId && farm
      ? [
          {
            label: farm.name,
            href: producerId
              ? `/farms/${farmId}?producer_id=${encodeURIComponent(producerId)}`
              : `/farms/${farmId}`,
          },
        ]
      : []),
    { label: title },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      {activeTab === "recommendations" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
            {season?.status ? (
              <Badge variant={STATUS_VARIANTS[season.status] || "default"}>
                {statusLabel}
              </Badge>
            ) : null}
            {season?.status === "DRAFT" ? (
              <Button
                size="sm"
                className="gap-2"
                onClick={handlePublish}
                disabled={publishMutation.isPending}
              >
                <Send className="h-4 w-4" />
                {publishMutation.isPending ? "Publicando..." : "Publicar safra"}
              </Button>
            ) : null}
          </div>

          {loadingSeason ? (
            <PageHeaderSkeleton withAction />
          ) : (
            <RecommendationsTab
              seasonId={seasonId}
              title={title}
              plotName={season?.plot_name}
              plantingDate={season?.planting_date}
              statusLabel={statusLabel}
              seasonStatus={season?.status}
              producerId={producerId || undefined}
              onPublish={season?.status === "DRAFT" ? handlePublish : undefined}
              isPublishing={publishMutation.isPending}
            />
          )}
        </>
      ) : (
        <CostPlanView
          seasonId={seasonId}
          crop={season?.crop ?? "SOYBEAN"}
          farmId={farmId || undefined}
          producerId={producerId || (season?.producer_id ?? undefined)}
          producerName={producer?.name}
          farmName={farm?.name}
        />
      )}
    </>
  );
}
