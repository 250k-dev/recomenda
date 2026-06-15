"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  CalendarDays,
  ArrowRight,
  Clock,
  MapPin,
  Leaf,
  Wheat,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { useTimingTemplate, useTimingTemplates, queryKeys } from "@/lib/api/hooks";
import {
  createMixTemplate,
  createMixTemplateItem,
  createSeason,
  createTimingTemplate,
  createTimingStage,
} from "@/lib/api/client";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  TimingStagesEditor,
  TIMING_TRIGGER_LABELS,
  newTimingStageField,
  type TimingStageField,
} from "@/components/domain/timing/timing-stages-editor";
import { formatTimingPreviewDate, recommendedYmdToWindow, windowToRecommendedYmd } from "@/lib/timing/window-days";
import {
  Field,
  FieldError,
  StepFooter,
  StepHeader,
  ContextBadge,
  SummaryCard,
  fmt,
  extractError,
  type PlotSchedule,
  type WizardPlot,
} from "@/components/domain/season/_shared";

export type SeasonWizardProps = {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  farmName?: string;
  onComplete: () => void;
  onViewSeason?: (seasonId: string) => void;
  onCancel: () => void;
};

type Crop = "SOYBEAN" | "CORN";
type CronogramMode = "template" | "custom";

const WIZARD_STEPS = 3;

export function SeasonWizard({
  producerId,
  producerName,
  plots,
  farmName,
  onComplete,
  onViewSeason,
  onCancel,
}: SeasonWizardProps) {
  const [step, setStep] = useState(1);
  const [crop, setCrop] = useState<Crop>("SOYBEAN");
  const [cronogramMode, setCronogramMode] = useState<CronogramMode>("template");
  const [timingTemplateId, setTimingTemplateId] = useState("");
  const [draftStages, setDraftStages] = useState<TimingStageField[]>([
    newTimingStageField("Dessecação"),
    newTimingStageField("Pós-emergência"),
  ]);
  const [schedules, setSchedules] = useState<PlotSchedule[]>(() =>
    plots.map((p) => ({
      plotId: p.id,
      variety: "",
      plantingDate: "",
      cycleDays: "",
    })),
  );
  const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(
    () => new Set(plots.length === 1 ? [plots[0].id] : []),
  );

  const selectedPlots = useMemo(
    () => plots.filter((p) => selectedPlotIds.has(p.id)),
    [plots, selectedPlotIds],
  );

  const totalHa = useMemo(
    () => selectedPlots.reduce((s, p) => s + p.area, 0),
    [selectedPlots],
  );

  const setSchedulesState = (updater: React.SetStateAction<PlotSchedule[]>) => {
    setSchedules(updater);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / WIZARD_STEPS) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          Passo {step} de {WIZARD_STEPS}
        </span>
      </div>

      {step === 1 && (
        <StepCronogram
          producerId={producerId}
          crop={crop}
          setCrop={setCrop}
          cronogramMode={cronogramMode}
          setCronogramMode={setCronogramMode}
          timingTemplateId={timingTemplateId}
          setTimingTemplateId={setTimingTemplateId}
          draftStages={draftStages}
          setDraftStages={setDraftStages}
          farmName={farmName}
          onBack={onCancel}
          onNext={(resolvedTemplateId) => {
            setTimingTemplateId(resolvedTemplateId);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <StepPlantation
          plots={plots}
          farmName={farmName}
          selectedPlotIds={selectedPlotIds}
          setSelectedPlotIds={setSelectedPlotIds}
          schedules={schedules}
          setSchedules={setSchedulesState}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepFinalize
          producerId={producerId}
          producerName={producerName}
          plots={selectedPlots}
          allPlotsCount={plots.length}
          crop={crop}
          timingTemplateId={timingTemplateId}
          schedules={schedules}
          totalHa={totalHa}
          onBack={() => setStep(2)}
          onComplete={onComplete}
          onViewSeason={onViewSeason}
        />
      )}
    </div>
  );
}

function StepCronogram({
  producerId,
  crop,
  setCrop,
  cronogramMode,
  setCronogramMode,
  timingTemplateId,
  setTimingTemplateId,
  draftStages,
  setDraftStages,
  farmName,
  onBack,
  onNext,
}: {
  producerId: string;
  crop: Crop;
  setCrop: (v: Crop) => void;
  cronogramMode: CronogramMode;
  setCronogramMode: (v: CronogramMode) => void;
  timingTemplateId: string;
  setTimingTemplateId: (v: string) => void;
  draftStages: TimingStageField[];
  setDraftStages: React.Dispatch<React.SetStateAction<TimingStageField[]>>;
  farmName?: string;
  onBack: () => void;
  onNext: (templateId: string) => void;
}) {
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const {
    data: selectedTemplate,
    isLoading: loadingSelected,
    isError: selectedError,
  } = useTimingTemplate(cronogramMode === "template" ? timingTemplateId : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cropTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => !t.is_archived && (t.crop === crop || t.crop === "ANY"),
      ),
    [templates, crop],
  );

  const next = async () => {
    setError(null);
    setSaving(true);
    try {
      if (cronogramMode === "template") {
        if (!timingTemplateId) {
          setError("Selecione um cronograma salvo ou monte um novo aqui.");
          return;
        }
        const stages = selectedTemplate?.stages ?? [];
        if (stages.length === 0) {
          setError(
            "Este modelo não tem etapas cadastradas. Edite o modelo na tela do produtor ou monte o fluxo aqui.",
          );
          return;
        }
        onNext(timingTemplateId);
        return;
      }

      const validStages = draftStages.filter((s) => s.name.trim());
      if (validStages.length === 0) {
        setError("Adicione pelo menos um estágio ao cronograma.");
        return;
      }

      for (const stage of validStages) {
        for (const product of stage.products) {
          const hasCategory = Boolean(product.category);
          const hasProduct = Boolean(product.productId);
          const hasDose = Number(product.dose.replace(",", ".")) > 0;
          if ((hasProduct || hasDose) && !hasCategory) {
            setError(`Selecione a categoria do produto na etapa "${stage.name.trim()}".`);
            return;
          }
          if (hasProduct && !hasDose) {
            setError(`Informe a dose/ha do produto na etapa "${stage.name.trim()}".`);
            return;
          }
          if (!hasProduct && (product.dose || product.productName || product.category)) {
            setError(`Selecione o produto na etapa "${stage.name.trim()}".`);
            return;
          }
        }
      }

      const templateName = farmName
        ? `Safra ${farmName} — ${new Date().toLocaleDateString("pt-BR")}`
        : `Safra ${CROP_LABELS[crop]} — ${new Date().toLocaleDateString("pt-BR")}`;

      const template = await createTimingTemplate({
        name: templateName,
        crop,
        producer_id: producerId,
      });
      for (let i = 0; i < validStages.length; i++) {
        const stage = validStages[i];
        const stageProducts = stage.products.filter(
          (product) =>
            product.productId && Number(product.dose.replace(",", ".")) > 0,
        );

        let defaultMixTemplateId: string | null = null;
        if (stageProducts.length > 0) {
          const mix = await createMixTemplate({
            name: `${stage.name.trim()} — ${templateName}`,
            crop,
          });
          for (const product of stageProducts) {
            await createMixTemplateItem(mix.id, {
              local_product_id: product.productId,
              dose_per_hectare: Number(product.dose.replace(",", ".")),
              dose_unit: product.unit,
            });
          }
          defaultMixTemplateId = mix.id;
        }

        const { window_start_days, window_end_days } = recommendedYmdToWindow(
          stage.recommended_date,
        );
        await createTimingStage(template.id, {
          order_index: i,
          name: stage.name.trim(),
          trigger_type: stage.trigger_type,
          window_start_days,
          window_end_days,
          default_mix_template_id: defaultMixTemplateId,
          notes: stage.notes.trim() || null,
        });
      }
      onNext(template.id);
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const cropOptions: Array<{ value: Crop; label: string; icon: typeof Sprout }> = [
    { value: "SOYBEAN", label: "Soja", icon: Sprout },
    { value: "CORN", label: "Milho", icon: Wheat },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nova safra
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
              Cronograma da safra
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Escolha um modelo salvo ou monte o fluxo de aplicações com produtos por etapa.
              Na próxima etapa você define plantio e variedade por talhão.
            </p>
            {farmName ? (
              <div className="mt-3">
                <ContextBadge tone="primary">
                  <Leaf className="h-3.5 w-3.5" />
                  {farmName}
                </ContextBadge>
              </div>
            ) : null}
          </div>
        </div>
        <Button variant="outline" onClick={onBack} className="-mt-0.5 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
          Cancelar
        </Button>
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cultura
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:max-w-xl">
          {cropOptions.map((option) => {
            const selected = crop === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setCrop(option.value);
                  setTimingTemplateId("");
                  setError(null);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                  selected
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                    : "bg-background hover:border-primary/25 hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium text-foreground">
                  {option.label}
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fluxo de aplicações
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {cronogramMode === "template"
                ? "Reaproveite um modelo de cronograma salvo"
                : "Monte as etapas desta safra do zero"}
            </p>
          </div>
          <SegmentedTabs
            variant="pill"
            value={cronogramMode}
            onValueChange={(v) => setCronogramMode(v as CronogramMode)}
            items={[
              { value: "template", label: "Usar modelo salvo" },
              { value: "custom", label: "Montar aqui" },
            ]}
            className="w-full sm:w-auto"
          />
        </div>

        <div className="p-5">
          {cronogramMode === "template" ? (
            <>
              {isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              ) : cropTemplates.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <ListChecks className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Nenhum modelo para {CROP_LABELS[crop] ?? crop}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Modelos são criados na tela do produtor, em Modelos de Recomendação.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCronogramMode("custom")}
                  >
                    Montar o fluxo aqui
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cropTemplates.map((t) => {
                      const selected = timingTemplateId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTimingTemplateId(selected ? "" : t.id);
                            setError(null);
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                            selected
                              ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                              : "bg-background hover:border-primary/25 hover:bg-muted/30",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                              selected
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <ListChecks className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">
                              {t.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {CROP_LABELS[t.crop] ?? t.crop}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Modelos criados na tela do produtor, em Modelos de Recomendação.
                  </p>
                </>
              )}

              {timingTemplateId ? (
                <SelectedTemplatePreview
                  template={selectedTemplate}
                  isLoading={loadingSelected}
                  isError={selectedError}
                  crop={crop}
                />
              ) : null}
            </>
          ) : (
            <TimingStagesEditor
              stages={draftStages}
              minStages={1}
              showProducts
              producerId={producerId}
              crop={crop}
              onChange={(key, patch) =>
                setDraftStages((prev) =>
                  prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
                )
              }
              onAdd={(presetName) =>
                setDraftStages((prev) => {
                  if (presetName && prev.some((s) => s.name === presetName)) return prev;
                  return [...prev, newTimingStageField(presetName ?? "")];
                })
              }
              onRemove={(key) =>
                setDraftStages((prev) => prev.filter((s) => s.key !== key))
              }
            />
          )}
        </div>
      </section>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button onClick={() => void next()} disabled={saving} className="gap-2">
            {saving ? "Salvando…" : "Próximo"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

function SelectedTemplatePreview({
  template,
  isLoading,
  isError,
  crop,
}: {
  template?: {
    id: string;
    name: string;
    crop: string;
    stages?: Array<{
      id: string;
      order_index: number;
      name: string;
      trigger_type: string;
      window_start_days: number;
      window_end_days: number;
    }>;
  };
  isLoading: boolean;
  isError: boolean;
  crop: Crop;
}) {
  if (isLoading) {
    return (
      <div className="mt-4 space-y-2 rounded-xl border bg-card p-4 shadow-sm">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Não foi possível carregar os detalhes do modelo selecionado.
      </div>
    );
  }

  if (!template) return null;

  const stages = [...(template.stages ?? [])].sort((a, b) => a.order_index - b.order_index);
  const cropMismatch = template.crop !== "ANY" && template.crop !== crop;

  return (
    <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stages.length} {stages.length === 1 ? "etapa" : "etapas"} de aplicação
          </p>
        </div>
        <Badge variant="outline">{CROP_LABELS[template.crop] ?? template.crop}</Badge>
      </div>

      {cropMismatch ? (
        <p className="mb-3 text-xs text-amber-700">
          Este modelo é de {CROP_LABELS[template.crop] ?? template.crop}, diferente da cultura
          selecionada ({CROP_LABELS[crop]}).
        </p>
      ) : null}

      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          O modelo foi encontrado, mas ainda não possui etapas. Edite na tela do produtor ou
          use &quot;Montar aqui&quot;.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="font-medium text-foreground">{stage.name}</span>
              <span className="text-xs text-muted-foreground">
                {TIMING_TRIGGER_LABELS[stage.trigger_type] ?? stage.trigger_type}
                {" · "}
                dia {formatTimingPreviewDate(windowToRecommendedYmd(stage.window_start_days, stage.window_end_days))} (±2)
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StepPlantation({
  plots,
  farmName,
  selectedPlotIds,
  setSelectedPlotIds,
  schedules,
  setSchedules,
  onBack,
  onNext,
}: {
  plots: WizardPlot[];
  farmName?: string;
  selectedPlotIds: Set<string>;
  setSelectedPlotIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  schedules: PlotSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<PlotSchedule[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const updateSchedule = (plotId: string, patch: Partial<PlotSchedule>) => {
    setSchedules((prev) => prev.map((s) => (s.plotId === plotId ? { ...s, ...patch } : s)));
  };

  const selectedPlots = useMemo(
    () => plots.filter((p) => selectedPlotIds.has(p.id)),
    [plots, selectedPlotIds],
  );

  const totalHa = useMemo(
    () => selectedPlots.reduce((s, p) => s + p.area, 0),
    [selectedPlots],
  );

  const togglePlot = (plotId: string) => {
    setSelectedPlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(plotId)) next.delete(plotId);
      else next.add(plotId);
      return next;
    });
    setError(null);
  };

  const selectAll = () => {
    setSelectedPlotIds(new Set(plots.map((p) => p.id)));
    setError(null);
  };

  const clearSelection = () => {
    setSelectedPlotIds(new Set());
    setError(null);
  };

  const next = () => {
    setError(null);
    if (selectedPlots.length === 0) {
      return setError("Selecione pelo menos um talhão para configurar nesta safra.");
    }
    if (
      !selectedPlots.every((p) => schedules.find((s) => s.plotId === p.id)?.plantingDate)
    ) {
      return setError("Informe a data de plantio de todos os talhões selecionados.");
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Plantação"
        subtitle="Selecione os talhões desta safra e preencha variedade, plantio e ciclo."
        onBack={onBack}
        backLabel="Voltar ao cronograma"
      />

      <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Selecionados
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {selectedPlots.length} de {plots.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Área selecionada
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{fmt(totalHa)} ha</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fazenda
            </p>
            <p className="mt-1 overflow-hidden text-lg font-semibold text-ellipsis text-foreground">
              {farmName || plots[0]?.farmName || "—"}
            </p>
          </div>
          <div className="flex items-end justify-start sm:justify-end">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={selectedPlots.length === plots.length}
              >
                Selecionar todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={selectedPlots.length === 0}
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tb-soft text-tb">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Talhões desta safra
            </h3>
            <p className="text-sm text-muted-foreground">
              Marque os talhões que entrarão nesta configuração. Os demais podem ser
              configurados depois em uma nova safra.
            </p>
          </div>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          {plots.map((p) => {
            const selected = selectedPlotIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlot(p.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all",
                  selected
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                    : "bg-background hover:border-primary/25 hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{fmt(p.area)} ha</span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedPlots.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 border-t pt-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Dados por talhão
                </h3>
                <p className="text-sm text-muted-foreground">
                  Variedade, plantio e ciclo dos {selectedPlots.length}{" "}
                  {selectedPlots.length === 1 ? "talhão selecionado" : "talhões selecionados"}.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {selectedPlots.map((p) => {
                const sch = schedules.find((s) => s.plotId === p.id);
                return (
                  <div key={p.id} className="rounded-lg border bg-background p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sprout className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-sm text-muted-foreground">· {fmt(p.area)} ha</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Variedade / Híbrido" hint="Opcional.">
                        <Input
                          value={sch?.variety ?? ""}
                          onChange={(e) => updateSchedule(p.id, { variety: e.target.value })}
                          placeholder="Ex: NS 5090"
                        />
                      </Field>
                      <Field label="Plantio">
                        <Input
                          type="date"
                          value={sch?.plantingDate ?? ""}
                          onChange={(e) =>
                            updateSchedule(p.id, { plantingDate: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Ciclo (dias)">
                        <Input
                          type="number"
                          value={sch?.cycleDays ?? ""}
                          onChange={(e) => updateSchedule(p.id, { cycleDays: e.target.value })}
                          placeholder="Ex: 120"
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Selecione um ou mais talhões acima para preencher os dados de plantação.
          </div>
        )}
      </section>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button onClick={next} className="gap-2">
            Próximo
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

function StepFinalize({
  producerId,
  producerName,
  plots,
  allPlotsCount,
  crop,
  timingTemplateId,
  schedules,
  totalHa,
  onBack,
  onComplete,
  onViewSeason,
}: {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  allPlotsCount: number;
  crop: Crop;
  timingTemplateId: string;
  schedules: PlotSchedule[];
  totalHa: number;
  onBack: () => void;
  onComplete: () => void;
  onViewSeason?: (seasonId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [createdIds, setCreatedIds] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const farmId = plots[0]?.farmId;

  const mutation = useMutation({
    mutationFn: async () => {
      const created: string[] = [];
      for (const p of plots) {
        const sch = schedules.find((s) => s.plotId === p.id);
        const season = (await createSeason({
          plot_id: p.id,
          producer_id: producerId,
          crop,
          variety: sch?.variety.trim() || undefined,
          cycle_days: sch?.cycleDays ? Number(sch.cycleDays) : undefined,
          timing_template_id: timingTemplateId,
          planting_date: sch?.plantingDate || undefined,
          publish_now: publishNow,
        })) as { id: string };
        created.push(season.id);
      }
      return created;
    },
    onSuccess: (ids) => {
      setCreatedIds(ids);
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
      void queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates(producerId) });
      if (farmId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons(farmId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.producerFarms(producerId) });
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  if (createdIds) {
    const firstId = createdIds[0] ?? null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {createdIds.length === 1 ? "Safra criada" : `${createdIds.length} safras criadas`}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {publishNow
            ? "As recomendações foram geradas a partir do cronograma."
            : "As safras foram salvas como rascunho. Publique para gerar as recomendações."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={onComplete}>
            Ir para o produtor
          </Button>
          {firstId && onViewSeason ? (
            <Button onClick={() => onViewSeason(firstId)}>Ver safra</Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Revisão da safra"
        subtitle={
          plots.length === allPlotsCount
            ? "Confira os dados antes de concluir. Uma safra será criada para cada talhão selecionado."
            : `Confira os dados antes de concluir. ${plots.length} de ${allPlotsCount} talhões entrarão nesta safra; os demais podem ser configurados depois.`
        }
        onBack={onBack}
        backLabel="Voltar à plantação"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Produtor" value={producerName} />
        <SummaryCard label="Cultura" value={CROP_LABELS[crop] ?? crop} />
        <SummaryCard label="Área total" value={`${fmt(totalHa)} ha`} />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 border-b pb-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {plots.length} {plots.length === 1 ? "talhão" : "talhões"}
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {plots.map((p) => {
            const sch = schedules.find((s) => s.plotId === p.id);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">· {fmt(p.area)} ha</span>
                {sch?.variety ? (
                  <span className="text-xs text-muted-foreground">· {sch.variety}</span>
                ) : null}
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  plantio{" "}
                  {sch?.plantingDate
                    ? new Date(sch.plantingDate).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <label className="mt-6 flex max-w-xl cursor-pointer items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
        <input
          type="checkbox"
          checked={publishNow}
          onChange={(e) => setPublishNow(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium text-foreground">Publicar agora</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Gera as recomendações do cronograma imediatamente. Desmarque para salvar como rascunho.
          </span>
        </span>
      </label>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
            <Check className="h-4 w-4" />
            {mutation.isPending ? "Criando…" : "Concluir"}
          </Button>
        }
      />
    </div>
  );
}
