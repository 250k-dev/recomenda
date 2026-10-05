"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@recomenda/ui/primitives/input";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import {
  computePrescription,
  fmtHectares,
  fmtQuantity,
  positive,
  sprayVolumeFromTotal,
  tankCapacityFromCount,
} from "@recomenda/domain/recommendations/prescription-calc";
import { cn } from "@recomenda/utils";

/**
 * Rascunho dos dados da receita de aplicação. Números em string canônica
 * ("80.5" ou "") — o mesmo formato do `MoneyInput`.
 */
export type ApplicationDataDraft = {
  sprayVolume: string;
  /** Tanque do pulverizador (L): no modelo e na etapa. */
  tankCapacity?: string;
  applicationTime: string;
  nozzle: string;
  phenologicalStage: string;
};

export function emptyApplicationData(): ApplicationDataDraft {
  return { sprayVolume: "", applicationTime: "", nozzle: "", phenologicalStage: "" };
}

/** Número do servidor → string canônica do rascunho. */
export function numberDraft(value: number | string | null | undefined): string {
  const n = positive(value ?? null);
  return n == null ? "" : String(n);
}

/** String do rascunho → payload (vazio = null, apaga no servidor). */
export function draftNumber(value: string | undefined): number | null {
  return positive(value ?? null);
}

export function draftText(value: string): string | null {
  return value.trim() || null;
}

type RecipeFields = {
  spray_volume_l_ha?: number | string | null;
  tank_capacity_l?: number | string | null;
  application_time?: string | null;
  nozzle?: string | null;
  phenological_stage?: string | null;
};

/** Etapa (do modelo ou publicada) → rascunho do formulário. */
export function applicationDraftFrom(source: RecipeFields): ApplicationDataDraft {
  return {
    sprayVolume: numberDraft(source.spray_volume_l_ha),
    tankCapacity: numberDraft(source.tank_capacity_l),
    applicationTime: source.application_time ?? "",
    nozzle: source.nozzle ?? "",
    phenologicalStage: source.phenological_stage ?? "",
  };
}

/** Rascunho → payload da etapa (do modelo ou publicada). */
export function stageRecipePayload(draft: ApplicationDataDraft | undefined) {
  const value = draft ?? emptyApplicationData();
  return {
    spray_volume_l_ha: draftNumber(value.sprayVolume),
    tank_capacity_l: draftNumber(value.tankCapacity),
    application_time: draftText(value.applicationTime),
    nozzle: draftText(value.nozzle),
    phenological_stage: draftText(value.phenologicalStage),
  };
}

/** Assinatura para detectar mudança (fingerprint do modelo, "sujo" do card). */
export function applicationDraftKey(draft: ApplicationDataDraft | undefined): string {
  const v = draft ?? emptyApplicationData();
  return [
    draftNumber(v.sprayVolume) ?? "",
    draftNumber(v.tankCapacity) ?? "",
    v.applicationTime.trim(),
    v.nozzle.trim(),
    v.phenologicalStage.trim(),
  ].join("~");
}

function Label({ children, formula }: { children: string; formula?: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      {children}
      {formula ? (
        <span title={`Calculado: ${formula}`} aria-label={`Calculado: ${formula}`}>
          <Calculator className="size-3 text-primary" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

/**
 * Vazão, calda, tanque, horário, ponta e estádio da etapa.
 *
 * Só VAZÃO e TANQUE são gravados. Calda total e nº de tanques são calculados
 * (`prescription-calc`) e podem ser digitados: aí a conta inversa define a
 * vazão (calda ÷ área) ou o tanque (calda ÷ nº de tanques). O campo em edição
 * guarda o texto digitado até sair dele — evita o vaivém de recálculo.
 */
export function ApplicationDataFields({
  value,
  onChange,
  areaHa,
  showTank = true,
  stageSuggestion,
  readOnly = false,
  className,
  mixed,
  hideStage = false,
}: {
  value: ApplicationDataDraft;
  onChange: (patch: Partial<ApplicationDataDraft>) => void;
  /** Área da etapa (ha). Sem ela (modelo), não há calda nem tanques. */
  areaHa?: number | null;
  showTank?: boolean;
  /** Estádio sugerido pelos dias da etapa (placeholder). */
  stageSuggestion?: string | null;
  readOnly?: boolean;
  className?: string;
  /** Várias etapas com valores diferentes: o campo vazio mostra "Vários". */
  mixed?: Partial<Record<keyof ApplicationDataDraft, boolean>>;
  /** Esconde o estádio (é por etapa — não se edita em grupo). */
  hideStage?: boolean;
}) {
  const ph = (key: keyof ApplicationDataDraft, fallback: string) =>
    mixed?.[key] ? "Vários" : fallback;
  // "Vários" ainda intocado: borda âmbar para não parecer campo vazio.
  const mix = (key: keyof ApplicationDataDraft) =>
    mixed?.[key] && !(value[key] ?? "").trim() ? "border-[#e3c98d] bg-[#fdf8ec]" : "";
  const [editing, setEditing] = useState<"total" | "tanks" | null>(null);
  const [draftTotal, setDraftTotal] = useState("");
  const [draftTanks, setDraftTanks] = useState("");

  const tankCapacity = positive(value.tankCapacity ?? null);
  const presc = computePrescription({
    areaHa,
    sprayVolumeLHa: positive(value.sprayVolume),
    tankCapacityL: showTank ? tankCapacity : null,
  });
  const hasArea = positive(areaHa ?? null) != null;

  const lastTankText =
    presc.lastTankL == null ? "" : presc.lastTankL > 0 ? String(presc.lastTankL) : "0";

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <label className="grid gap-1">
        <Label>Vazão (L/ha)</Label>
        <MoneyInput
          value={value.sprayVolume}
          onValueChange={(sprayVolume) => onChange({ sprayVolume })}
          placeholder={ph("sprayVolume", "Ex.: 80")}
          disabled={readOnly}
          className={cn("h-9 text-right tabular-nums", mix("sprayVolume"))}
        />
      </label>
      {hasArea ? (
        <label className="grid gap-1">
          <Label formula="Vazão × Área">Calda total (L)</Label>
          <MoneyInput
            value={editing === "total" ? draftTotal : presc.totalMixL != null ? String(presc.totalMixL) : ""}
            onFocus={() => {
              setEditing("total");
              setDraftTotal(presc.totalMixL != null ? String(presc.totalMixL) : "");
            }}
            onBlur={() => setEditing(null)}
            onValueChange={(total) => {
              setDraftTotal(total);
              const sprayVolume = sprayVolumeFromTotal(total, areaHa);
              onChange({ sprayVolume: sprayVolume != null ? String(sprayVolume) : "" });
            }}
            disabled={readOnly}
            className="h-9 text-right tabular-nums"
          />
        </label>
      ) : null}
      {showTank ? (
        <label className="grid gap-1">
          <Label>Tanque (L)</Label>
          <MoneyInput
            value={value.tankCapacity ?? ""}
            onValueChange={(tankCapacity) => onChange({ tankCapacity })}
            placeholder={ph("tankCapacity", "Ex.: 2.000")}
            disabled={readOnly}
            className={cn("h-9 text-right tabular-nums", mix("tankCapacity"))}
          />
        </label>
      ) : null}
      {hasArea && showTank ? (
        <>
          <label className="grid gap-1">
            <Label formula="Calda total ÷ Tanque">Nº de tanques</Label>
            <MoneyInput
              value={editing === "tanks" ? draftTanks : presc.tankCount != null ? String(presc.tankCount) : ""}
              decimals={editing === "tanks" ? undefined : 2}
              onFocus={() => {
                setEditing("tanks");
                setDraftTanks(presc.tankCount != null ? String(presc.tankCount) : "");
              }}
              onBlur={() => setEditing(null)}
              onValueChange={(count) => {
                setDraftTanks(count);
                const capacity = tankCapacityFromCount(count, presc.totalMixL);
                onChange({ tankCapacity: capacity != null ? String(capacity) : "" });
              }}
              disabled={readOnly || presc.totalMixL == null}
              className="h-9 text-right tabular-nums"
            />
          </label>
          <label className="grid gap-1">
            <Label formula="Calda total − tanques cheios × Tanque">Último tanque (L)</Label>
            {/* Só leitura: sai da conta, nunca é digitado. */}
            <MoneyInput
              value={lastTankText}
              onValueChange={() => undefined}
              disabled
              aria-readonly
              placeholder="—"
              className="h-9 text-right tabular-nums"
            />
          </label>
          <p className="self-end pb-2 text-xs text-muted-foreground">
            {presc.tankCount != null ? (
              <>
                {presc.fullTanks} {presc.fullTanks === 1 ? "tanque cheio" : "tanques cheios"}
                {presc.lastTankL ? ` + 1 de ${fmtQuantity(presc.lastTankL)} L` : ""} · cada
                tanque cobre {fmtHectares(presc.haPerTank)} ha
              </>
            ) : (
              "Informe vazão e tanque para dividir a calda."
            )}
          </p>
        </>
      ) : null}
      <label className="grid gap-1">
        <Label>Horário</Label>
        <Input
          value={value.applicationTime}
          onChange={(e) => onChange({ applicationTime: e.target.value })}
          placeholder={ph("applicationTime", "Ex.: 05h30 às 09h00")}
          maxLength={120}
          disabled={readOnly}
          className={cn("h-9", mix("applicationTime"))}
        />
      </label>
      <label className="grid gap-1">
        <Label>Ponta</Label>
        <Input
          value={value.nozzle}
          onChange={(e) => onChange({ nozzle: e.target.value })}
          placeholder={ph("nozzle", "Ex.: Leque 110.02")}
          maxLength={120}
          disabled={readOnly}
          className={cn("h-9", mix("nozzle"))}
        />
      </label>
      {hideStage ? null : (
      <label className="grid gap-1 sm:col-span-2">
        <Label>Estádio fenológico</Label>
        <Input
          value={value.phenologicalStage}
          onChange={(e) => onChange({ phenologicalStage: e.target.value })}
          placeholder={stageSuggestion ? `Sugerido: ${stageSuggestion}` : "Ex.: V3–V4"}
          maxLength={120}
          disabled={readOnly}
          className="h-9"
        />
      </label>
      )}
    </div>
  );
}

/** Resumo de uma linha para o botão (ex.: "80 L/ha · tanque 2.000 L · Leque 110.02"). */
export function applicationSummary(draft: ApplicationDataDraft | undefined): string | null {
  const v = draft ?? emptyApplicationData();
  const parts = [
    positive(v.sprayVolume) != null ? `${fmtQuantity(positive(v.sprayVolume))} L/ha` : null,
    positive(v.tankCapacity ?? null) != null ? `tanque ${fmtQuantity(positive(v.tankCapacity ?? null))} L` : null,
    v.applicationTime.trim() || null,
    v.nozzle.trim() || null,
    v.phenologicalStage.trim() || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export type ApplicationDraftKey = keyof ApplicationDataDraft;
const DRAFT_KEYS: ApplicationDraftKey[] = [
  "sprayVolume",
  "tankCapacity",
  "applicationTime",
  "nozzle",
  "phenologicalStage",
];

/**
 * Valor comum a várias etapas; campo com valores diferentes fica vazio e
 * marcado em `mixed` (mostra "Vários"). Base da edição em grupo.
 */
export function commonApplicationDraft(sources: RecipeFields[]) {
  const drafts = sources.map((source) => applicationDraftFrom(source));
  const value = emptyApplicationData();
  const mixed: Partial<Record<ApplicationDraftKey, boolean>> = {};
  for (const key of DRAFT_KEYS) {
    const values = new Set(drafts.map((d) => (d[key] ?? "").trim()));
    if (values.size <= 1) value[key] = [...values][0] ?? "";
    else mixed[key] = true;
  }
  return { value, mixed };
}

/** Só os campos mexidos → payload da etapa (campo "Vários" intocado não vai). */
export function recipeFieldsPayload(keys: ApplicationDraftKey[], draft: ApplicationDataDraft) {
  const payload: Record<string, number | string | null> = {};
  for (const key of keys) {
    if (key === "sprayVolume") payload.spray_volume_l_ha = draftNumber(draft.sprayVolume);
    if (key === "tankCapacity") payload.tank_capacity_l = draftNumber(draft.tankCapacity);
    if (key === "applicationTime") payload.application_time = draftText(draft.applicationTime);
    if (key === "nozzle") payload.nozzle = draftText(draft.nozzle);
    if (key === "phenologicalStage") payload.phenological_stage = draftText(draft.phenologicalStage);
  }
  return payload;
}
