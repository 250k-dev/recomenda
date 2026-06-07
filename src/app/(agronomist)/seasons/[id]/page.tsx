"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import {
  PageHeaderSkeleton,
  TimelineCardsSkeleton,
} from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import type { Recommendation, RecommendationItem } from "@/lib/api/client";
import {
  Send,
  ChevronDown,
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
import { cn } from "@/lib/utils";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";

type TabValue = "recommendations" | "cost-plan";

const TAB_LABELS: Record<TabValue, string> = {
  recommendations: "Recomendações",
  "cost-plan": "Plano de custo",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPLIED_ON_TIME: "bg-primary/10 text-primary",
  APPLIED_LATE: "bg-amber-100 text-amber-600",
  SKIPPED: "bg-orange-100 text-orange-600",
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
    primary: "border-primary/35 bg-primary/10 shadow-sm",
    neutral: "border-border bg-muted/50",
    success: "border-emerald-500/30 bg-emerald-500/10",
  } as const;

  const labelClasses = {
    primary: "text-primary",
    neutral: "text-muted-foreground",
    success: "text-emerald-700",
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
          <span className="ml-1.5 text-[10px] text-amber-600">(substituído)</span>
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
            <NativeSelect
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-8 w-full text-sm"
            >
              <option value="">Selecione…</option>
              {GLOBAL_PRODUCT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {PRODUCT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <NativeSelect
              value={selectedId}
              onChange={(e) => {
                const product = rowProducts.find(
                  (item) => item.local_product_id === e.target.value,
                );
                setSelectedId(e.target.value);
                setUnit(product?.dose_unit ?? "L");
              }}
              disabled={!category}
              className="h-8 w-full text-sm"
            >
              <option value="">
                {category ? "Selecione…" : "Escolha a categoria"}
              </option>
              {rowProducts.map((product) => (
                <option key={product.local_product_id} value={product.local_product_id ?? ""}>
                  {product.name}
                </option>
              ))}
            </NativeSelect>
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

function RecommendationCard({
  rec,
  index,
  seasonId,
}: {
  rec: Recommendation;
  index: number;
  seasonId: string;
}) {
  const [open, setOpen] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(rec.name);
  const [headerDate, setHeaderDate] = useState(
    rec.predicted_date_current ? rec.predicted_date_current.slice(0, 10) : "",
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

  const handleSaveHeader = () => {
    patchMut.mutate(
      {
        id: rec.id,
        name: headerName.trim() || rec.name,
        predicted_date_current: headerDate || null,
      },
      {
        onSuccess: () => { toast.success("Etapa atualizada."); setEditingHeader(false); },
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
        className={cn(
          "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors",
          isPending ? "hover:bg-primary/5" : "hover:bg-accent/40",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isDone
              ? "bg-primary text-primary-foreground shadow-sm"
              : isSkipped
                ? "bg-orange-100 text-orange-700"
                : "bg-primary/15 text-primary ring-1 ring-primary/20",
          )}
        >
          {index + 1}
        </span>

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

        <div className="flex shrink-0 items-start gap-2">
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
          <ChevronDown
            className={cn(
              "mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-3">
          {editingHeader ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Editar etapa</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Nome da etapa</Label>
                  <Input
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-background p-3">
                  <Label className="text-xs font-semibold text-primary">Data prevista</Label>
                  <Input
                    type="date"
                    value={headerDate}
                    onChange={(e) => setHeaderDate(e.target.value)}
                    className="h-10 border-primary/30 text-sm font-semibold"
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveHeader}
                  disabled={isBusy}
                  className="h-8 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingHeader(false)}
                  className="h-8"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

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

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Execução
            </p>

            {(isDone || isSkipped) && !registering && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    STATUS_BADGE_CLASS[rec.status],
                  )}
                >
                  {STATUS_ICON[rec.status]}
                  {STATUS_LABEL[rec.status]}
                </span>
                {rec.executed_date && (
                  <span className="text-xs text-muted-foreground">
                    em {fmtDate(rec.executed_date)}
                  </span>
                )}
                {rec.notes && (
                  <span className="text-xs text-muted-foreground">· {rec.notes}</span>
                )}
              </div>
            )}

            {registering ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-background p-3">
                    <Label className="text-xs font-semibold text-primary">Data de execução</Label>
                    <Input
                      type="date"
                      value={executedDate}
                      onChange={(e) => setExecutedDate(e.target.value)}
                      className="h-10 border-primary/30 text-sm font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Observações (opcional)</Label>
                    <Input
                      value={execNotes}
                      onChange={(e) => setExecNotes(e.target.value)}
                      placeholder="Ex: aplicado 10% a menos por chuva"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
                    className="h-8 gap-1.5 text-muted-foreground"
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
                className="h-8 gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Registrar execução
              </Button>
            ) : null}

            {(isDone || isSkipped) && !registering && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRegistering(true)}
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUndo}
                  disabled={isBusy}
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  Reverter para pendente
                </Button>
              </div>
            )}
          </div>

          {!editingHeader ? (
            <div className="flex justify-end border-t border-border/60 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingHeader(true)}
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar etapa
              </Button>
            </div>
          ) : null}
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
}: {
  seasonId: string;
  title: string;
  plotName?: string;
  plantingDate?: string | null;
  statusLabel?: string;
}) {
  const { data, isLoading } = useSeasonTimeline(seasonId);

  if (isLoading) return <TimelineCardsSkeleton count={5} />;

  const recommendations = (
    Array.isArray(data) ? data : (data as { data?: unknown[] } | undefined)?.data ?? []
  ) as Recommendation[];

  if (!recommendations.length)
    return <EmptyState variant="inline" title="Nenhuma recomendação encontrada para esta safra." />;

  const done = recommendations.filter(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  ).length;
  const total = recommendations.length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-primary/20 bg-linear-to-br from-primary/8 to-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15">
              <Leaf className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Safra em execução
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {plotName ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sprout className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Talhão <strong className="text-foreground">{plotName}</strong>
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 sm:justify-end">
            {plantingDate ? (
              <div className="rounded-lg border border-primary/30 bg-background px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Plantio
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {fmtDate(plantingDate)}
                </p>
              </div>
            ) : null}
            {statusLabel ? (
              <div className="rounded-lg border bg-background px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{statusLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-primary/15 bg-primary/4 px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">Progresso das aplicações</span>
            <span className="font-semibold tabular-nums text-primary">
              {done}/{total} aplicadas
              <span className="ml-1 text-muted-foreground">({progressPct}%)</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {recommendations.map((rec, i) => (
          <RecommendationCard key={rec.id} rec={rec} index={i} seasonId={seasonId} />
        ))}
      </ul>
    </div>
  );
}

export default function SeasonDetailPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("recommendations");
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const seasonId = params.id;
  const farmIdFromQuery = searchParams.get("farm_id");
  const producerIdFromQuery = searchParams.get("producer_id");

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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          variant="pill"
          value={activeTab}
          onValueChange={setActiveTab}
          items={(Object.keys(TAB_LABELS) as TabValue[]).map((key) => ({
            value: key,
            label: TAB_LABELS[key],
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {activeTab === "recommendations" && (
        <>
          {loadingSeason ? (
            <PageHeaderSkeleton withAction />
          ) : (
            <RecommendationsTab
              seasonId={seasonId}
              title={title}
              plotName={season?.plot_name}
              plantingDate={season?.planting_date}
              statusLabel={statusLabel}
            />
          )}
        </>
      )}
      {activeTab === "cost-plan" && (
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
