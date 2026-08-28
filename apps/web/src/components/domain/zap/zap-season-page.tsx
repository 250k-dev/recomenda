"use client";

import { useState } from "react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import { ZapLinkError } from "./zap-link-error";
import type { ZapLoadResult, ZapSeasonDto } from "./zap-types";

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
    return (
      <ZapLinkError status={404} message="Este link não cria safra." />
    );
  }
  return <ZapSeasonForm token={token} initial={result.data} />;
}

function ZapSeasonForm({
  token,
  initial,
}: {
  token: string;
  initial: ZapSeasonDto;
}) {
  const [bootstrap, setBootstrap] = useState(initial);
  const [producerId, setProducerId] = useState(
    initial.step === "producer" ? "" : initial.producerId,
  );
  const [farmId, setFarmId] = useState(
    initial.step === "plot" ? initial.farmId : "",
  );
  const [plotId, setPlotId] = useState("");
  const [crop, setCrop] = useState("SOYBEAN");
  const [plantingDate, setPlantingDate] = useState("");
  const [area, setArea] = useState("");
  const [cycleDays, setCycleDays] = useState("120");
  const [variety, setVariety] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const farms = bootstrap.step === "farm" || bootstrap.step === "plot" ? bootstrap.step === "farm" ? bootstrap.farms : [] : [];
  const plots = bootstrap.step === "plot" ? bootstrap.plots : [];
  const producers = bootstrap.step === "producer" ? bootstrap.producers : [];

  async function load(nextProducerId: string, nextFarmId?: string) {
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
      setBootstrap(json as ZapSeasonDto);
      if (nextFarmId) {
        const plotData = json as Extract<ZapSeasonDto, { step: "plot" }>;
        if (plotData.step === "plot" && plotData.plots[0] && !plotId) {
          setPlotId(plotData.plots[0].id);
          setArea(String(plotData.plots[0].areaHectares || ""));
        }
      }
    } catch {
      setError("Não deu para carregar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/zap/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          producerId,
          plotId,
          crop,
          plantingDate,
          plantedAreaHa: Number(area.replace(",", ".")),
          cycleDays: Number(cycleDays),
          variety: variety.trim() || undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        label?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "Não deu para gravar a safra.");
        return;
      }
      setDone(json.label ?? "Safra criada como rascunho.");
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
        <h1 className="font-display text-xl font-bold text-text-strong">Safra criada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Rascunho de <strong className="text-text-strong">{done}</strong>. Etapas e
          timing ficam no app.
        </p>
      </div>
    );
  }

  const selectedPlot = plots.find((p) => p.id === plotId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-text-strong">Nova safra</p>
            <p className="text-xs text-muted-foreground">Rascunho. Timing no app.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl flex-1 gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        {producers.length > 0 ? (
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
                setPlotId("");
                if (id) void load(id);
              }}
            >
              <NativeSelectOption value="">Escolha o produtor</NativeSelectOption>
              {producers.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {bootstrap.step === "farm" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="zap-farm">Fazenda</Label>
            <NativeSelect
              id="zap-farm"
              className="w-full"
              value={farmId}
              onChange={(e) => {
                const id = e.target.value;
                setFarmId(id);
                setPlotId("");
                if (producerId && id) void load(producerId, id);
              }}
            >
              <NativeSelectOption value="">Escolha a fazenda</NativeSelectOption>
              {farms.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  {f.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {bootstrap.step === "plot" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="zap-plot">Talhão</Label>
              <NativeSelect
                id="zap-plot"
                className="w-full"
                value={plotId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPlotId(id);
                  const plot = plots.find((p) => p.id === id);
                  if (plot) setArea(String(plot.areaHectares || ""));
                }}
              >
                <NativeSelectOption value="">Escolha o talhão</NativeSelectOption>
                {plots.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name} · {p.areaHectares} ha
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="zap-crop">Cultura</Label>
              <NativeSelect
                id="zap-crop"
                className="w-full"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
              >
                <NativeSelectOption value="SOYBEAN">Soja</NativeSelectOption>
                <NativeSelectOption value="CORN">Milho</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="zap-date">Data de plantio</Label>
              <Input
                id="zap-date"
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="zap-area">Área plantada (ha)</Label>
              <Input
                id="zap-area"
                inputMode="decimal"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={selectedPlot ? String(selectedPlot.areaHectares) : ""}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="zap-cycle">Ciclo (dias)</Label>
              <Input
                id="zap-cycle"
                inputMode="numeric"
                value={cycleDays}
                onChange={(e) => setCycleDays(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="zap-variety">Variedade (opcional)</Label>
              <Input
                id="zap-variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>

            <Button
              type="button"
              disabled={busy || !plotId || !plantingDate || !area}
              onClick={() => void submit()}
            >
              Criar rascunho
            </Button>
          </>
        ) : null}
      </main>
    </div>
  );
}
