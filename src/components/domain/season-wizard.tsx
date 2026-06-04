"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  CalendarDays,
  ArrowRight,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useTimingTemplates, queryKeys } from "@/lib/api/hooks";
import { createSeason } from "@/lib/api/client";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  Field,
  FieldError,
  StepFooter,
  StepHeader,
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
  /** Called for the "Ir para o produtor" success action. */
  onComplete: () => void;
  /** Called for the "Ver safra" success action with the first created season id. */
  onViewSeason?: (seasonId: string) => void;
  onCancel: () => void;
};

type Crop = "SOYBEAN" | "CORN";

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
  const [variety, setVariety] = useState("");
  const [timingTemplateId, setTimingTemplateId] = useState("");
  const [schedules, setSchedules] = useState<PlotSchedule[]>(() =>
    plots.map((p) => ({
      plotId: p.id,
      plantingDate: "",
      desiccationDate: "",
      cycleDays: "",
    })),
  );

  const totalHa = useMemo(() => plots.reduce((s, p) => s + p.area, 0), [plots]);

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
        <StepConfig
          crop={crop}
          setCrop={setCrop}
          variety={variety}
          setVariety={setVariety}
          timingTemplateId={timingTemplateId}
          setTimingTemplateId={setTimingTemplateId}
          farmName={farmName}
          onBack={onCancel}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepPlantation
          plots={plots}
          farmName={farmName}
          schedules={schedules}
          setSchedules={setSchedules}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepFinalize
          producerId={producerId}
          producerName={producerName}
          plots={plots}
          crop={crop}
          variety={variety}
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

function StepConfig({
  crop,
  setCrop,
  variety,
  setVariety,
  timingTemplateId,
  setTimingTemplateId,
  farmName,
  onBack,
  onNext,
}: {
  crop: Crop;
  setCrop: (v: Crop) => void;
  variety: string;
  setVariety: (v: string) => void;
  timingTemplateId: string;
  setTimingTemplateId: (v: string) => void;
  farmName?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { data: templates, isLoading } = useTimingTemplates();
  const [error, setError] = useState<string | null>(null);

  const cropTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => !t.is_archived && (t.crop === crop || t.crop === "ANY"),
      ),
    [templates, crop],
  );

  const next = () => {
    setError(null);
    if (!timingTemplateId) {
      return setError("Selecione um cronograma (modelo de recomendação).");
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Configurar a safra"
        subtitle="Escolha a cultura e o cronograma de aplicação. O cronograma gera as recomendações da safra ao publicar."
        onBack={onBack}
        backLabel="Cancelar"
      />

      {farmName ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Sprout className="h-4 w-4 text-primary" />
          Fazenda: <strong className="text-foreground">{farmName}</strong>
        </div>
      ) : null}

      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <Field htmlFor="season-crop" label="Cultura">
          <NativeSelect
            id="season-crop"
            value={crop}
            onChange={(e) => {
              setCrop(e.target.value as Crop);
              setTimingTemplateId("");
            }}
            className="w-full"
          >
            <option value="SOYBEAN">Soja</option>
            <option value="CORN">Milho</option>
          </NativeSelect>
        </Field>
        <Field htmlFor="season-variety" label="Variedade (opcional)">
          <Input
            id="season-variety"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            placeholder="Ex: NS 5090"
          />
        </Field>
      </div>

      <div className="mt-6 max-w-2xl">
        <Field
          htmlFor="season-template"
          label="Cronograma (modelo de recomendação)"
          hint="Define os estágios de aplicação e janelas. Crie ou edite cronogramas em Cronogramas."
        >
          {isLoading ? (
            <div className="h-9 animate-pulse rounded-md bg-muted" />
          ) : cropTemplates.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum cronograma para {CROP_LABELS[crop] ?? crop}.
              <div className="mt-3">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/timing-templates">
                    <ExternalLink className="h-4 w-4" />
                    Criar cronograma
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <NativeSelect
              id="season-template"
              value={timingTemplateId}
              onChange={(e) => setTimingTemplateId(e.target.value)}
              className="w-full"
            >
              <option value="">Selecione…</option>
              {cropTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

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

function StepPlantation({
  plots,
  farmName,
  schedules,
  setSchedules,
  onBack,
  onNext,
}: {
  plots: WizardPlot[];
  farmName?: string;
  schedules: PlotSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<PlotSchedule[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const updateSchedule = (plotId: string, patch: Partial<PlotSchedule>) => {
    setSchedules((prev) => prev.map((s) => (s.plotId === plotId ? { ...s, ...patch } : s)));
  };

  const totalHa = useMemo(() => plots.reduce((s, p) => s + p.area, 0), [plots]);

  const next = () => {
    setError(null);
    if (!plots.every((p) => schedules.find((s) => s.plotId === p.id)?.plantingDate)) {
      return setError("Informe a data de plantio de todos os talhões.");
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Plantação"
        subtitle="Defina as datas de plantio, dessecação e ciclo para cada talhão."
        onBack={onBack}
        backLabel="Voltar à configuração"
      />

      <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talhões</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{plots.length}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Área total</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{fmt(totalHa)} ha</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fazenda</p>
            <p className="mt-1 overflow-hidden text-lg font-semibold text-ellipsis text-foreground">
              {farmName || plots[0]?.farmName || "—"}
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Datas por talhão
            </h3>
            <p className="text-sm text-muted-foreground">
              Dessecação (quando houver), plantio e ciclo de cada talhão.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {plots.map((p) => {
            const sch = schedules.find((s) => s.plotId === p.id);
            return (
              <div key={p.id} className="rounded-lg border bg-background p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sprout className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    · {p.farmName} · {fmt(p.area)} ha
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Dessecação" hint="Opcional — costuma ocorrer antes do plantio.">
                    <Input
                      type="date"
                      value={sch?.desiccationDate ?? ""}
                      onChange={(e) => updateSchedule(p.id, { desiccationDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Plantio">
                    <Input
                      type="date"
                      value={sch?.plantingDate ?? ""}
                      onChange={(e) => updateSchedule(p.id, { plantingDate: e.target.value })}
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
  crop,
  variety,
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
  crop: Crop;
  variety: string;
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
          variety: variety.trim(),
          cycle_days: sch?.cycleDays ? Number(sch.cycleDays) : undefined,
          timing_template_id: timingTemplateId,
          planting_date: sch?.plantingDate || undefined,
          desiccation_date: sch?.desiccationDate || undefined,
          publish_now: publishNow,
        })) as { id: string };
        created.push(season.id);
      }
      return created;
    },
    onSuccess: (ids) => {
      setCreatedIds(ids);
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
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
        subtitle="Confira os dados antes de concluir. Uma safra será criada para cada talhão."
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
            {variety ? ` · ${variety}` : ""}
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
          <Button size="lg" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
            <Check className="h-4 w-4" />
            {mutation.isPending ? "Criando…" : "Concluir"}
          </Button>
        }
      />
    </div>
  );
}
