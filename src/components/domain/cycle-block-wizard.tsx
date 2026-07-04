"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Leaf,
  ListChecks,
  MapPin,
  Sprout,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import {
  useCycleAvailablePlots,
  useCyclePurchaseList,
  useApplyCycleBlock,
  useTimingTemplate,
  useTimingTemplates,
} from "@/lib/api/hooks";
import {
  createMixTemplate,
  createMixTemplateItem,
  createTimingTemplate,
  createTimingStage,
  updateTimingTemplate,
} from "@/lib/api/client";
import type { CycleDetail } from "@/lib/api/cycles";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  TimingStagesEditor,
  newTimingStageField,
  type TimingStageField,
} from "@/components/domain/timing/timing-stages-editor";
import { recommendedYmdToWindow } from "@/lib/timing/window-days";
import {
  Field,
  FieldError,
  SEED_CATEGORIES,
  extractError,
  fmt,
} from "@/components/domain/season/_shared";

type CronogramMode = "template" | "custom";

type PlotConfig = {
  variety: string;
  plantingDate: string;
  cycleDays: string;
  plantedArea: string;
};

/** Bloco = um modelo de recomendação aplicado a um subconjunto de talhões da
 *  safra. O agrônomo repete o fluxo (dessecação → 10 talhões, fungicida → 5…)
 *  até cobrir a programação e então publica no hub da safra. */
export function CycleBlockWizard({
  cycle,
  producerId,
  onDone,
  onCancel,
}: {
  cycle: CycleDetail;
  producerId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [crop, setCrop] = useState<string>(cycle.crops[0] ?? "SOYBEAN");
  const [cronogramMode, setCronogramMode] = useState<CronogramMode>("template");
  const [timingTemplateId, setTimingTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [draftStages, setDraftStages] = useState<TimingStageField[]>([
    newTimingStageField("Dessecação"),
  ]);
  const [resolvedTemplateId, setResolvedTemplateId] = useState("");

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          Passo {step} de 2
        </span>
      </div>

      {step === 1 ? (
        <StepModel
          cycle={cycle}
          producerId={producerId}
          crop={crop}
          setCrop={setCrop}
          cronogramMode={cronogramMode}
          setCronogramMode={setCronogramMode}
          timingTemplateId={timingTemplateId}
          setTimingTemplateId={setTimingTemplateId}
          templateName={templateName}
          setTemplateName={setTemplateName}
          saveToLibrary={saveToLibrary}
          setSaveToLibrary={setSaveToLibrary}
          draftStages={draftStages}
          setDraftStages={setDraftStages}
          onBack={onCancel}
          onNext={(templateId) => {
            setResolvedTemplateId(templateId);
            setStep(2);
          }}
        />
      ) : (
        <StepPlots
          cycle={cycle}
          crop={crop}
          timingTemplateId={resolvedTemplateId}
          onBack={() => setStep(1)}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function StepModel({
  cycle,
  producerId,
  crop,
  setCrop,
  cronogramMode,
  setCronogramMode,
  timingTemplateId,
  setTimingTemplateId,
  templateName,
  setTemplateName,
  saveToLibrary,
  setSaveToLibrary,
  draftStages,
  setDraftStages,
  onBack,
  onNext,
}: {
  cycle: CycleDetail;
  producerId: string;
  crop: string;
  setCrop: (v: string) => void;
  cronogramMode: CronogramMode;
  setCronogramMode: (v: CronogramMode) => void;
  timingTemplateId: string;
  setTimingTemplateId: (v: string) => void;
  templateName: string;
  setTemplateName: (v: string) => void;
  saveToLibrary: boolean;
  setSaveToLibrary: (v: boolean) => void;
  draftStages: TimingStageField[];
  setDraftStages: React.Dispatch<React.SetStateAction<TimingStageField[]>>;
  onBack: () => void;
  onNext: (templateId: string) => void;
}) {
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const { data: selectedTemplate } = useTimingTemplate(
    cronogramMode === "template" ? timingTemplateId : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cropTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => !t.is_archived && (t.crop === crop || t.crop === "ANY"),
      ),
    [templates, crop],
  );

  const cropOptions = cycle.crops.map((value) => ({
    value,
    label: CROP_LABELS[value] ?? value,
    icon: value === "CORN" ? Wheat : Sprout,
  }));

  const next = async () => {
    setError(null);
    setSaving(true);
    try {
      if (cronogramMode === "template") {
        if (!timingTemplateId) {
          setError("Selecione um modelo salvo ou monte um novo aqui.");
          return;
        }
        if ((selectedTemplate?.stages ?? []).length === 0) {
          setError("Este modelo não tem etapas cadastradas. Edite-o ou monte um aqui.");
          return;
        }
        onNext(timingTemplateId);
        return;
      }

      const validStages = draftStages.filter((s) => s.name.trim());
      if (validStages.length === 0) {
        setError("Adicione pelo menos uma etapa ao modelo.");
        return;
      }
      if (!templateName.trim()) {
        setError("Dê um nome ao modelo (ex.: Dessecação — Soja).");
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

      const template = await createTimingTemplate({
        name: templateName.trim(),
        crop,
        producer_id: producerId,
      });
      for (let i = 0; i < validStages.length; i++) {
        const stage = validStages[i];
        const stageProducts = stage.products.filter(
          (product) => product.productId && Number(product.dose.replace(",", ".")) > 0,
        );

        let defaultMixTemplateId: string | null = null;
        if (stageProducts.length > 0) {
          const mix = await createMixTemplate({
            name: `${stage.name.trim()} — ${templateName.trim()}`,
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

      // "Salvar em modelos" desmarcado: o modelo vale só para esta safra —
      // arquiva para não poluir a biblioteca (as recomendações já materializam).
      if (!saveToLibrary) {
        await updateTimingTemplate(template.id, { is_archived: true });
      }

      onNext(template.id);
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {cycle.name}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
              Modelo de recomendação
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Escolha um modelo salvo ou monte um aqui. No próximo passo você
              seleciona os talhões que recebem este modelo — dá para repetir o
              fluxo com outros modelos antes de publicar.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onBack}
          className="-mt-0.5 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Cancelar
        </Button>
      </div>

      {cycle.crops.length > 1 ? (
        <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cultura deste bloco
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
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
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-hover/40",
                  )}
                >
                  <Icon className="h-5 w-5 text-primary-strong" />
                  <span className="font-medium text-foreground">{option.label}</span>
                  {selected ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Modelo
          </p>
          <SegmentedTabs
            value={cronogramMode}
            onValueChange={(v) => setCronogramMode(v as CronogramMode)}
            items={[
              { value: "template", label: "Usar modelo salvo" },
              { value: "custom", label: "Montar um aqui" },
            ]}
          />
        </div>

        <div className="p-5">
          {cronogramMode === "template" ? (
            isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : cropTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum modelo de {CROP_LABELS[crop] ?? crop} salvo. Use &quot;Montar um
                aqui&quot; para criar o primeiro.
              </div>
            ) : (
              <div className="space-y-2">
                {cropTemplates.map((template) => {
                  const selected = timingTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setTimingTemplateId(template.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-hover/40",
                      )}
                    >
                      <ListChecks className="h-5 w-5 shrink-0 text-primary-strong" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {template.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {CROP_LABELS[template.crop] ?? template.crop}
                        </span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-5">
              <Field label="Nome do modelo">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={`Ex: Dessecação — ${CROP_LABELS[crop] ?? crop}`}
                />
              </Field>

              <TimingStagesEditor
                stages={draftStages}
                onChange={(key, patch) =>
                  setDraftStages((prev) =>
                    prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
                  )
                }
                onAdd={(presetName) =>
                  setDraftStages((prev) => [...prev, newTimingStageField(presetName ?? "")])
                }
                onRemove={(key) =>
                  setDraftStages((prev) => prev.filter((s) => s.key !== key))
                }
                showProducts
                producerId={producerId}
                crop={crop}
                farmId={cycle.farm_id}
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-card p-4 shadow-sm">
                <span
                  className={cn(
                    "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md transition-colors",
                    saveToLibrary
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface text-transparent",
                  )}
                >
                  {saveToLibrary ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="sr-only"
                />
                <span>
                  <span className="text-sm font-semibold text-text-strong">
                    Salvar em modelos
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                    Guarda este modelo na biblioteca para reutilizar em outras
                    safras e produtores. Desmarque para usar só nesta safra.
                  </span>
                </span>
              </label>
            </div>
          )}

          <FieldError message={error ?? undefined} />
        </div>
      </section>

      <div className="mt-auto flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={next} disabled={saving} className="gap-1.5">
          {saving ? "Salvando modelo..." : "Selecionar talhões"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepPlots({
  cycle,
  crop,
  timingTemplateId,
  onBack,
  onDone,
}: {
  cycle: CycleDetail;
  crop: string;
  timingTemplateId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { data: availablePlots, isLoading } = useCycleAvailablePlots(cycle.id);
  const { data: purchaseList } = useCyclePurchaseList(cycle.id);
  const applyBlock = useApplyCycleBlock(cycle.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [configs, setConfigs] = useState<Record<string, PlotConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmOtherCycle, setConfirmOtherCycle] = useState(false);

  const plots = availablePlots ?? [];
  const selectedPlots = plots.filter((p) => selected.has(p.id));
  const totalHa = selectedPlots.reduce((s, p) => {
    const cfg = configs[p.id];
    const planted = cfg?.plantedArea ? Number(cfg.plantedArea.replace(",", ".")) : NaN;
    return s + (Number.isFinite(planted) && planted > 0 ? planted : p.area_hectares);
  }, 0);

  /** Variedades da lista de compra da safra (sementes da cultura do bloco). */
  const varietyOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      if (item.crop && item.crop !== crop) continue;
      names.add(item.product_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [purchaseList, crop]);

  const toggle = (plotId: string, area: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(plotId)) {
        next.delete(plotId);
      } else {
        next.add(plotId);
        setConfigs((cfg) => ({
          ...cfg,
          [plotId]: cfg[plotId] ?? {
            variety: "",
            plantingDate: "",
            cycleDays: "",
            plantedArea: String(area),
          },
        }));
      }
      return next;
    });
  };

  const updateConfig = (plotId: string, patch: Partial<PlotConfig>) => {
    setConfigs((cfg) => ({
      ...cfg,
      [plotId]: { ...(cfg[plotId] ?? { variety: "", plantingDate: "", cycleDays: "", plantedArea: "" }), ...patch },
    }));
  };

  const submit = () => {
    setError(null);
    if (selectedPlots.length === 0) {
      setError("Selecione pelo menos um talhão para este modelo.");
      return;
    }
    applyBlock.mutate(
      {
        timing_template_id: timingTemplateId,
        plots: selectedPlots.map((p) => {
          const cfg = configs[p.id];
          const planted = cfg?.plantedArea
            ? Number(cfg.plantedArea.replace(",", "."))
            : null;
          return {
            plot_id: p.id,
            crop,
            variety: cfg?.variety?.trim() || null,
            planting_date: cfg?.plantingDate || null,
            cycle_days: cfg?.cycleDays ? Number(cfg.cycleDays) : null,
            planted_area_ha:
              planted != null && Number.isFinite(planted) && planted > 0
                ? planted
                : null,
          };
        }),
      },
      {
        onSuccess: (result) => {
          if (result.applied.length > 0) {
            toast.success(
              `Modelo aplicado a ${result.applied.length} ${
                result.applied.length === 1 ? "talhão" : "talhões"
              }.`,
            );
          }
          if (result.skipped.length > 0) {
            toast.info(
              `${result.skipped.length} ${
                result.skipped.length === 1 ? "talhão já tinha" : "talhões já tinham"
              } este modelo e ${result.skipped.length === 1 ? "foi pulado" : "foram pulados"}.`,
            );
          }
          onDone();
        },
        onError: (e) => setError(extractError(e)),
      },
    );
  };

  const trySubmit = () => {
    if (selectedPlots.some((p) => p.in_other_cycle)) {
      setConfirmOtherCycle(true);
      return;
    }
    submit();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {cycle.name} · {CROP_LABELS[crop] ?? crop}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            Talhões deste modelo
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Apenas talhões ainda sem este modelo nesta safra aparecem aqui.
            Selecionados: {selectedPlots.length} · {fmt(totalHa)} ha
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : plots.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Todos os talhões da fazenda já estão nesta safra. Cadastre novos
          talhões na fazenda para ampliá-la.
        </div>
      ) : (
        <div className="space-y-3">
          {plots.map((plot) => {
            const isSelected = selected.has(plot.id);
            const cfg = configs[plot.id];
            return (
              <div
                key={plot.id}
                className={cn(
                  "rounded-xl border transition-colors",
                  isSelected ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(plot.id, plot.area_hectares)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span
                    className={cn(
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface text-transparent",
                    )}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{plot.name}</span>
                      {plot.in_other_cycle ? (
                        <Badge variant="neutral" className="gap-1 text-amber-700">
                          <CircleAlert className="h-3 w-3" />
                          já está na {plot.other_cycle_name ?? "outra safra"}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {fmt(plot.area_hectares)} ha
                  </span>
                </button>

                {isSelected ? (
                  <div className="grid gap-3 border-t border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Variedade / Híbrido" hint="Da lista de compra da safra.">
                      {varietyOptions.length > 0 ? (
                        <>
                          <Input
                            list={`varieties-${plot.id}`}
                            value={cfg?.variety ?? ""}
                            onChange={(e) => updateConfig(plot.id, { variety: e.target.value })}
                            placeholder="Selecione ou digite"
                          />
                          <datalist id={`varieties-${plot.id}`}>
                            {varietyOptions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <Input
                          value={cfg?.variety ?? ""}
                          onChange={(e) => updateConfig(plot.id, { variety: e.target.value })}
                          placeholder="Ex: BMX Potência RR"
                        />
                      )}
                    </Field>
                    <Field label="Data de plantio">
                      <Input
                        type="date"
                        value={cfg?.plantingDate ?? ""}
                        onChange={(e) =>
                          updateConfig(plot.id, { plantingDate: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Ciclo (dias)">
                      <Input
                        type="number"
                        min={1}
                        value={cfg?.cycleDays ?? ""}
                        onChange={(e) => updateConfig(plot.id, { cycleDays: e.target.value })}
                        placeholder="Ex: 115"
                      />
                    </Field>
                    <Field
                      label="Área a plantar (ha)"
                      hint={`Talhão tem ${fmt(plot.area_hectares)} ha.`}
                    >
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={cfg?.plantedArea ?? ""}
                        onChange={(e) =>
                          updateConfig(plot.id, { plantedArea: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <FieldError message={error ?? undefined} />

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={trySubmit}
          disabled={applyBlock.isPending || selectedPlots.length === 0}
          className="gap-1.5"
        >
          <Leaf className="h-4 w-4" />
          {applyBlock.isPending
            ? "Aplicando..."
            : `Aplicar a ${selectedPlots.length} ${selectedPlots.length === 1 ? "talhão" : "talhões"}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOtherCycle}
        onOpenChange={setConfirmOtherCycle}
        title="Talhão em outra safra ativa"
        description="Um ou mais talhões selecionados já estão em outra safra ativa. Deseja continuar mesmo assim?"
        confirmLabel="Sim, continuar"
        cancelLabel="Revisar seleção"
        onConfirm={() => {
          setConfirmOtherCycle(false);
          submit();
        }}
      />
    </div>
  );
}
