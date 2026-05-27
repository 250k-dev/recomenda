"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import {
  PageHeaderSkeleton,
  TimelineCardsSkeleton,
} from "@/components/domain/page-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";

const CROP_LABELS: Record<string, string> = { SOYBEAN: "Soja", CORN: "Milho" };

const STATUS_LABELS_SEASON: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

const STATUS_VARIANTS_SEASON: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  IN_PROGRESS: "default",
  HARVESTED: "outline",
  COMPLETED: "outline",
  ARCHIVED: "secondary",
};

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
  APPLIED_LATE: "bg-sun-soft text-sun",
  SKIPPED: "bg-clay-soft text-clay",
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
          <span className="ml-1.5 text-[10px] text-sun">(substituído)</span>
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
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("L");
  const createMut = useCreateRecommendationItem(seasonId);

  const filtered = search.trim()
    ? catalog.filter((p) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : [];

  const selected = catalog.find((p) => p.local_product_id === selectedId);

  const handleAdd = () => {
    const localId = selectedId;
    const doseVal = parseFloat(dose.replace(",", "."));
    if (!localId || !doseVal || doseVal <= 0) return;
    createMut.mutate(
      { recommendation_id: recommendationId, local_product_id: localId, dose_per_hectare: doseVal, dose_unit: unit },
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
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Input
            placeholder="Buscar produto no catálogo…"
            value={selected ? selected.name : search}
            onChange={(e) => { setSearch(e.target.value); setSelectedId(""); }}
            className="h-8 text-sm"
          />
          {filtered.length > 0 && !selectedId && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border bg-popover shadow-md">
              {filtered.slice(0, 8).map((p) => (
                <button
                  key={p.local_product_id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => { setSelectedId(p.local_product_id ?? ""); setSearch(""); setUnit(p.dose_unit ?? "L"); }}
                >
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.dose_unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Dose/ha"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="h-8 w-28 text-sm"
          />
          <DoseUnitSelect value={unit} onChange={setUnit} className="h-8" />
          <span className="shrink-0 text-xs text-muted-foreground">/ha</span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedId || !dose || createMut.isPending}
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
    <li className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            isDone
              ? "bg-primary/10 text-primary"
              : isSkipped
                ? "bg-clay-soft text-clay"
                : "bg-muted text-muted-foreground",
          )}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{rec.name}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                STATUS_BADGE_CLASS[rec.status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_ICON[rec.status]}
              {STATUS_LABEL[rec.status] ?? rec.status}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {rec.predicted_date_current && (
              <span>Previsto: {fmtDate(rec.predicted_date_current)}</span>
            )}
            {rec.executed_date && (
              <span>Executado: {fmtDate(rec.executed_date)}</span>
            )}
            {rec.items.length > 0 && (
              <span>
                {rec.items.length} {rec.items.length === 1 ? "produto" : "produtos"}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-3">
          {editingHeader ? (
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Editar etapa</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Nome da etapa</Label>
                  <Input
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Data prevista</Label>
                  <Input
                    type="date"
                    value={headerDate}
                    onChange={(e) => setHeaderDate(e.target.value)}
                    className="h-8 text-sm"
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
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingHeader(true)}
              className="h-7 w-fit gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Editar nome / data prevista
            </Button>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

          <div className="border-t pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

            {registering || isPending ? (
              registering || isPending ? (
                registering ? (
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Data de execução</Label>
                        <Input
                          type="date"
                          value={executedDate}
                          onChange={(e) => setExecutedDate(e.target.value)}
                          className="h-8 text-sm"
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
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRegistering(true)}
                    className="h-8 gap-1.5"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Registrar execução
                  </Button>
                )
              ) : null
            ) : null}

            {isPending && !registering && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRegistering(true)}
                className="h-8 gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Registrar execução
              </Button>
            )}

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
        </div>
      )}
    </li>
  );
}

function RecommendationsTab({ seasonId }: { seasonId: string }) {
  const { data, isLoading } = useSeasonTimeline(seasonId);

  if (isLoading) return <TimelineCardsSkeleton count={5} />;

  const recommendations = (
    Array.isArray(data) ? data : (data as { data?: unknown[] } | undefined)?.data ?? []
  ) as Recommendation[];

  if (!recommendations.length)
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma recomendação encontrada para esta safra.
        </CardContent>
      </Card>
    );

  const done = recommendations.filter(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  ).length;
  const total = recommendations.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {done}/{total} aplicadas
        </span>
      </div>

      <ul className="flex flex-col gap-2">
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
  const statusLabel = season ? STATUS_LABELS_SEASON[season.status] ?? season.status : "";
  const title = season
    ? season.variety
      ? `${cropLabel} — ${season.variety}`
      : cropLabel
    : "Safra";
  const description = season
    ? `Talhão ${season.plot_name}${season.planting_date ? ` · Plantio em ${new Date(season.planting_date + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}`
    : "";

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
        <div className="inline-flex rounded-full border bg-card p-0.5 text-sm font-medium shadow-sm">
          {(Object.keys(TAB_LABELS) as TabValue[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={
                activeTab === key
                  ? "rounded-full bg-primary px-4 py-1.5 text-primary-foreground shadow-sm"
                  : "rounded-full px-4 py-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {season?.status ? (
            <Badge variant={STATUS_VARIANTS_SEASON[season.status] || "default"}>
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
            <PageHeader title={title} description={description} />
          )}
          <RecommendationsTab seasonId={seasonId} />
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
