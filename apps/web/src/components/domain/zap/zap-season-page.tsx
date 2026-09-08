"use client";

import { useMemo, useState } from "react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import { CROP_LABELS } from "@recomenda/utils";
import { ZapLinkError } from "./zap-link-error";
import {
  newZapDraftStage,
  ZapTimingStagesForm,
  type ZapDraftStage,
} from "./zap-timing-stages-form";
import type {
  ZapLoadResult,
  ZapSeasonDto,
  ZapTimingStage,
} from "./zap-types";

type WizardStep = "place" | "cronogram" | "plots" | "review";
type Crop = "SOYBEAN" | "CORN";
type CronogramMode = "template" | "custom";

type PlotSchedule = {
  plotId: string;
  variety: string;
  plantingDate: string;
  cycleDays: string;
  area: string;
};

export function ZapSeasonPage({
  token,
  result,
}: {
  token: string;
  result: ZapLoadResult<ZapSeasonDto>;
}) {
  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }
  if (result.data.typ !== "season_create") {
    return <ZapLinkError status={404} message="Este link não cria safra." />;
  }
  return <ZapSeasonWizard token={token} initial={result.data} />;
}

function ZapSeasonWizard({
  token,
  initial,
}: {
  token: string;
  initial: ZapSeasonDto;
}) {
  const [data, setData] = useState(initial);
  const [step, setStep] = useState<WizardStep>("place");
  const [producerId, setProducerId] = useState(initial.producerId);
  const [farmId, setFarmId] = useState(initial.farmId);
  const [crop, setCrop] = useState<Crop>("SOYBEAN");
  const [cronogramMode, setCronogramMode] = useState<CronogramMode>("template");
  const [timingTemplateId, setTimingTemplateId] = useState("");
  const [templateDetail, setTemplateDetail] = useState<ZapTimingStage[] | null>(null);
  const [draftStages, setDraftStages] = useState<ZapDraftStage[]>([
    newZapDraftStage("Dessecação"),
    newZapDraftStage("Pós-emergência"),
  ]);
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<PlotSchedule[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ label: string; published: boolean } | null>(null);

  const templatesForCrop = useMemo(
    () => data.templates.filter((t) => t.crop === crop || t.crop === "ANY"),
    [crop, data.templates],
  );

  const selectedPlots = data.plots.filter((p) => selectedPlotIds.includes(p.id));
  const quotaLimit = data.quota.limit;
  const quotaWouldExceed =
    publishNow &&
    quotaLimit != null &&
    quotaLimit > 0 &&
    data.quota.current + selectedPlots.length > quotaLimit;

  async function loadPlace(nextProducerId: string, nextFarmId?: string) {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextProducerId) params.set("producerId", nextProducerId);
      if (nextFarmId) params.set("farmId", nextFarmId);
      const qs = params.toString();
      const response = await fetch(
        `/api/v1/zap/by-token/${encodeURIComponent(token)}${qs ? `?${qs}` : ""}`,
      );
      const json = (await response.json().catch(() => null)) as
        | ZapSeasonDto
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        setError(
          (json && "error" in json ? json.error?.message : null) ??
            "Não deu para carregar. Tente de novo.",
        );
        return;
      }
      const next = json as ZapSeasonDto;
      setData(next);
      setProducerId(next.producerId);
      setFarmId(next.farmId);
      if (next.farmId && next.plots.length === 1) {
        setSelectedPlotIds([next.plots[0].id]);
        setSchedules([
          {
            plotId: next.plots[0].id,
            variety: "",
            plantingDate: "",
            cycleDays: "120",
            area: String(next.plots[0].areaHectares || ""),
          },
        ]);
      }
    } catch {
      setError("Não deu para carregar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplate(id: string) {
    setTimingTemplateId(id);
    setTemplateDetail(null);
    if (!id || !producerId) return;
    const params = new URLSearchParams({ token, producerId });
    const response = await fetch(
      `/api/v1/zap/timing-templates/${encodeURIComponent(id)}?${params.toString()}`,
    );
    if (!response.ok) return;
    const json = (await response.json()) as { stages?: ZapTimingStage[] };
    setTemplateDetail(json.stages ?? []);
  }

  async function resolveTemplateId(): Promise<string | null> {
    if (cronogramMode === "template") {
      if (!timingTemplateId) {
        setError("Selecione um cronograma salvo ou monte um novo aqui.");
        return null;
      }
      if (templateDetail && templateDetail.length === 0) {
        setError("Este modelo não tem etapas. Monte o fluxo aqui ou escolha outro.");
        return null;
      }
      return timingTemplateId;
    }
    if (!data.canCreateTemplate) {
      setError("Seu acesso só usa modelos já salvos. Peça ao agrônomo para liberar.");
      return null;
    }
    const valid = draftStages.filter((s) => s.name.trim());
    if (valid.length === 0) {
      setError("Adicione pelo menos um estágio ao cronograma.");
      return null;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/zap/timing-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          producerId,
          crop,
          stages: valid.map((stage) => ({
            name: stage.name.trim(),
            triggerType: stage.triggerType,
            targetDay: Number(stage.targetDay || 0),
            notes: stage.notes.trim() || undefined,
            products: stage.products
              .filter((p) => p.productId && Number(p.dose.replace(",", ".")) > 0)
              .map((p) => ({
                localProductId: p.productId,
                dosePerHectare: Number(p.dose.replace(",", ".")),
                doseUnit: p.doseUnit,
              })),
          })),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.id) {
        setError(json?.error?.message ?? "Não deu para gravar o cronograma.");
        return null;
      }
      setTimingTemplateId(json.id);
      return json.id;
    } catch {
      setError("Não deu para gravar o cronograma.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function togglePlot(id: string) {
    const plot = data.plots.find((p) => p.id === id);
    setSelectedPlotIds((prev) => {
      if (prev.includes(id)) {
        setSchedules((rows) => rows.filter((r) => r.plotId !== id));
        return prev.filter((x) => x !== id);
      }
      setSchedules((rows) => [
        ...rows,
        {
          plotId: id,
          variety: "",
          plantingDate: "",
          cycleDays: "120",
          area: String(plot?.areaHectares || ""),
        },
      ]);
      return [...prev, id];
    });
  }

  async function submit(forceDraft: boolean) {
    const shouldPublish = !forceDraft && publishNow && !quotaWouldExceed;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/zap/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          producerId,
          crop,
          timingTemplateId,
          publishNow: shouldPublish,
          plots: selectedPlots.map((p) => {
            const sch = schedules.find((s) => s.plotId === p.id);
            return {
              plotId: p.id,
              plantingDate: sch?.plantingDate,
              plantedAreaHa: Number((sch?.area ?? String(p.areaHectares)).replace(",", ".")),
              cycleDays: Number(sch?.cycleDays || 120),
              variety: sch?.variety.trim() || undefined,
            };
          }),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        label?: string;
        published?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "Não deu para gravar a safra.");
        return;
      }
      setDone({
        label: json.label ?? "Safra criada.",
        published: Boolean(json.published),
      });
    } catch {
      setError("Não deu para gravar a safra.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-primary shadow-(--brand-shadow)">
          <Logo className="size-6 fill-white" />
        </span>
        <h1 className="font-display text-xl font-bold text-text-strong">
          {done.published ? "Safra publicada" : "Rascunho salvo"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          <strong className="text-text-strong">{done.label}</strong>
          {done.published
            ? ". As etapas já entram no cronograma. Pode voltar para o WhatsApp."
            : ". Fica como rascunho até alguém publicar. Pode voltar para o WhatsApp."}
        </p>
      </div>
    );
  }

  const stepIndex = step === "place" ? 1 : step === "cronogram" ? 2 : step === "plots" ? 3 : 4;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-text-strong">Nova safra</p>
            <p className="text-xs text-muted-foreground">Passo {stepIndex} de 4</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl flex-1 gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        {step === "place" ? (
          <>
            {data.producers.length > 1 || !producerId ? (
              <div className="grid gap-1.5">
                <Label htmlFor="zap-producer">Produtor</Label>
                <NativeSelect
                  id="zap-producer"
                  className="w-full"
                  value={producerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProducerId(id);
                    setFarmId("");
                    setSelectedPlotIds([]);
                    if (id) void loadPlace(id);
                  }}
                >
                  <NativeSelectOption value="">Escolha o produtor</NativeSelectOption>
                  {data.producers.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : data.producerName ? (
              <p className="text-sm text-muted-foreground">Produtor: {data.producerName}</p>
            ) : null}

            {producerId ? (
              data.farms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Esse produtor ainda não tem fazenda. Volte no WhatsApp e peça ao Lico o
                  link para cadastrar a fazenda.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="zap-farm">Fazenda</Label>
                  <NativeSelect
                    id="zap-farm"
                    className="w-full"
                    value={farmId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFarmId(id);
                      setSelectedPlotIds([]);
                      if (producerId && id) void loadPlace(producerId, id);
                    }}
                  >
                    <NativeSelectOption value="">Escolha a fazenda</NativeSelectOption>
                    {data.farms.map((f) => (
                      <NativeSelectOption key={f.id} value={f.id}>
                        {f.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )
            ) : null}

            {farmId && data.plots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Essa fazenda não tem talhão. Peça ao Lico para cadastrar um talhão.
              </p>
            ) : null}

            <Button
              type="button"
              disabled={busy || !producerId || !farmId || data.plots.length === 0}
              onClick={() => {
                setError(null);
                setStep("cronogram");
              }}
            >
              Continuar
            </Button>
          </>
        ) : null}

        {step === "cronogram" ? (
          <>
            <Button type="button" variant="ghost" className="w-fit px-0" onClick={() => setStep("place")}>
              Voltar
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="zap-crop">Cultura</Label>
              <NativeSelect
                id="zap-crop"
                className="w-full"
                value={crop}
                onChange={(e) => {
                  setCrop(e.target.value as Crop);
                  setTimingTemplateId("");
                  setTemplateDetail(null);
                }}
              >
                <NativeSelectOption value="SOYBEAN">Soja</NativeSelectOption>
                <NativeSelectOption value="CORN">Milho</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={cronogramMode === "template" ? "default" : "outline"}
                onClick={() => setCronogramMode("template")}
              >
                Modelo salvo
              </Button>
              <Button
                type="button"
                variant={cronogramMode === "custom" ? "default" : "outline"}
                disabled={!data.canCreateTemplate}
                onClick={() => setCronogramMode("custom")}
              >
                Montar aqui
              </Button>
            </div>
            {cronogramMode === "template" ? (
              templatesForCrop.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não há modelo de {CROP_LABELS[crop] ?? crop} para este produtor.
                  {data.canCreateTemplate ? " Monte as etapas aqui." : ""}
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="zap-template">Cronograma</Label>
                  <NativeSelect
                    id="zap-template"
                    className="w-full"
                    value={timingTemplateId}
                    onChange={(e) => void loadTemplate(e.target.value)}
                  >
                    <NativeSelectOption value="">Escolha o modelo</NativeSelectOption>
                    {templatesForCrop.map((t) => (
                      <NativeSelectOption key={t.id} value={t.id}>
                        {t.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {templateDetail && templateDetail.length > 0 ? (
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      {templateDetail.map((stage) => (
                        <li key={stage.id}>
                          {stage.name}
                          {stage.products.length
                            ? ` · ${stage.products.map((p) => p.name).join(", ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            ) : (
              <ZapTimingStagesForm
                stages={draftStages}
                onChange={setDraftStages}
                token={token}
                producerId={producerId}
              />
            )}
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setError(null);
                  const id = await resolveTemplateId();
                  if (id) setStep("plots");
                })();
              }}
            >
              Continuar
            </Button>
          </>
        ) : null}

        {step === "plots" ? (
          <>
            <Button type="button" variant="ghost" className="w-fit px-0" onClick={() => setStep("cronogram")}>
              Voltar
            </Button>
            <p className="text-sm text-muted-foreground">
              {data.farmName ? `Talhões de ${data.farmName}` : "Talhões"}
            </p>
            <ul className="grid gap-3">
              {data.plots.map((plot) => {
                const checked = selectedPlotIds.includes(plot.id);
                const sch = schedules.find((s) => s.plotId === plot.id);
                return (
                  <li key={plot.id} className="rounded-xl border border-border bg-card p-4">
                    <label className="flex items-center gap-2 font-medium text-text-strong">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlot(plot.id)}
                      />
                      {plot.name} · {plot.areaHectares} ha
                    </label>
                    {checked && sch ? (
                      <div className="mt-3 grid gap-2">
                        <Input
                          type="date"
                          value={sch.plantingDate}
                          onChange={(e) =>
                            setSchedules((rows) =>
                              rows.map((r) =>
                                r.plotId === plot.id ? { ...r, plantingDate: e.target.value } : r,
                              ),
                            )
                          }
                          aria-label={`Plantio ${plot.name}`}
                        />
                        <Input
                          value={sch.variety}
                          onChange={(e) =>
                            setSchedules((rows) =>
                              rows.map((r) =>
                                r.plotId === plot.id ? { ...r, variety: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Variedade (opcional)"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            inputMode="numeric"
                            value={sch.cycleDays}
                            onChange={(e) =>
                              setSchedules((rows) =>
                                rows.map((r) =>
                                  r.plotId === plot.id ? { ...r, cycleDays: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Ciclo (dias)"
                          />
                          <Input
                            inputMode="decimal"
                            value={sch.area}
                            onChange={(e) =>
                              setSchedules((rows) =>
                                rows.map((r) =>
                                  r.plotId === plot.id ? { ...r, area: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Área (ha)"
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              disabled={
                selectedPlotIds.length === 0 ||
                selectedPlots.some((p) => {
                  const sch = schedules.find((s) => s.plotId === p.id);
                  return !sch?.plantingDate || !Number(sch.area.replace(",", "."));
                })
              }
              onClick={() => {
                setError(null);
                setStep("review");
              }}
            >
              Revisar
            </Button>
          </>
        ) : null}

        {step === "review" ? (
          <>
            <Button type="button" variant="ghost" className="w-fit px-0" onClick={() => setStep("plots")}>
              Voltar
            </Button>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-text-strong">
                {CROP_LABELS[crop] ?? crop} · {data.farmName || "Fazenda"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {selectedPlots.length} talhão{selectedPlots.length === 1 ? "" : "es"} ·{" "}
                {cronogramMode === "template" ? "modelo salvo" : "cronograma montado aqui"}
              </p>
              <ul className="mt-3 grid gap-1 text-muted-foreground">
                {selectedPlots.map((p) => {
                  const sch = schedules.find((s) => s.plotId === p.id);
                  return (
                    <li key={p.id}>
                      {p.name} · plantio {sch?.plantingDate} · {sch?.area} ha
                    </li>
                  );
                })}
              </ul>
            </div>
            {quotaWouldExceed ? (
              <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
                O plano permite {quotaLimit} talhões ativos ({data.quota.current} em uso). Dá para
                salvar como rascunho.
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishNow && !quotaWouldExceed}
                disabled={quotaWouldExceed}
                onChange={(e) => setPublishNow(e.target.checked)}
              />
              Publicar agora (entra no cronograma)
            </label>
            <div className="grid gap-2">
              <Button
                type="button"
                disabled={busy || quotaWouldExceed}
                onClick={() => void submit(false)}
              >
                {busy ? "Gravando…" : publishNow && !quotaWouldExceed ? "Publicar safra" : "Salvar rascunho"}
              </Button>
              {publishNow && !quotaWouldExceed ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>
                  Só rascunho
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
