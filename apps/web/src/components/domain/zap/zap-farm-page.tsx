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
import type { ZapFarmDto, ZapLoadResult } from "./zap-types";

export function ZapFarmPage({
  token,
  result,
}: {
  token: string;
  result: ZapLoadResult<ZapFarmDto>;
}) {
  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }
  if (result.data.typ !== "farm_create") {
    return <ZapLinkError status={404} message="Este link não cadastra fazenda." />;
  }
  return <ZapFarmForm token={token} initial={result.data} />;
}

type PlotRow = { name: string; area: string };

/**
 * Cadastro de fazenda numa tela só: nome, cidade/UF e os talhões. É o passo que faltava
 * depois de cadastrar um produtor pelo WhatsApp — no chat viraria um interrogatório de
 * seis perguntas, então o Lico manda o link e a pessoa preenche de uma vez.
 */
function ZapFarmForm({ token, initial }: { token: string; initial: ZapFarmDto }) {
  const [producerId, setProducerId] = useState(initial.producerId);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [plots, setPlots] = useState<PlotRow[]>([{ name: "", area: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const preenchidos = plots.filter((p) => p.name.trim().length > 0);
  const podeGravar =
    !busy &&
    producerId.length > 0 &&
    name.trim().length >= 2 &&
    preenchidos.every((p) => Number(p.area.replace(",", ".")) > 0);

  function updatePlot(index: number, patch: Partial<PlotRow>) {
    setPlots((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/zap/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          producerId,
          name: name.trim(),
          location: location.trim() || undefined,
          plots: preenchidos.map((p) => ({
            name: p.name.trim(),
            areaHectares: Number(p.area.replace(",", ".")),
          })),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        label?: string;
        plots?: number;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "Não deu para gravar a fazenda.");
        return;
      }
      const talhoes = json.plots ?? 0;
      setDone(
        talhoes > 0
          ? `${json.label} com ${talhoes} talhão${talhoes > 1 ? "es" : ""}`
          : (json.label ?? "Fazenda cadastrada."),
      );
    } catch {
      setError("Não deu para gravar a fazenda.");
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
        <h1 className="font-display text-xl font-bold text-text-strong">Fazenda cadastrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          <strong className="text-text-strong">{done}</strong>. Pode voltar para o WhatsApp
          e pedir a safra.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-text-strong">Nova fazenda</p>
            <p className="text-xs text-muted-foreground">
              {initial.producerName ? initial.producerName : "Escolha o produtor"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl flex-1 gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        {initial.producerId ? null : (
          <div className="grid gap-1.5">
            <Label htmlFor="zap-farm-producer">Produtor</Label>
            <NativeSelect
              id="zap-farm-producer"
              className="w-full"
              value={producerId}
              onChange={(e) => setProducerId(e.target.value)}
            >
              <NativeSelectOption value="">Escolha o produtor</NativeSelectOption>
              {initial.producers.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="zap-farm-name">Nome da fazenda</Label>
          <Input
            id="zap-farm-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fazenda Santo Antônio"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="zap-farm-location">Cidade e estado</Label>
          <Input
            id="zap-farm-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Sorriso, MT"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Talhões</Label>
            <span className="text-xs text-muted-foreground">Pode deixar para depois</span>
          </div>
          {plots.map((plot, index) => (
            <div key={index} className="grid grid-cols-[1fr_7rem] gap-2">
              <Input
                value={plot.name}
                onChange={(e) => updatePlot(index, { name: e.target.value })}
                placeholder={`Talhão ${index + 1}`}
                aria-label={`Nome do talhão ${index + 1}`}
              />
              <Input
                value={plot.area}
                onChange={(e) => updatePlot(index, { area: e.target.value })}
                inputMode="decimal"
                placeholder="ha"
                aria-label={`Área do talhão ${index + 1} em hectares`}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setPlots((rows) => [...rows, { name: "", area: "" }])}
          >
            Adicionar talhão
          </Button>
        </div>

        <Button type="button" disabled={!podeGravar} onClick={() => void submit()}>
          {busy ? "Gravando…" : "Cadastrar fazenda"}
        </Button>
      </main>
    </div>
  );
}
