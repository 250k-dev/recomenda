"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@recomenda/ui/primitives/input";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import {
  computePrescription,
  fmtHectares,
  fmtQuantity,
  fmtTankCount,
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
  /** Só na etapa publicada; o modelo não tem tanque (é da fazenda). */
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

/** Rascunho → payload da etapa do modelo (sem tanque: é da fazenda). */
export function stageRecipePayload(draft: ApplicationDataDraft | undefined) {
  const value = draft ?? emptyApplicationData();
  return {
    spray_volume_l_ha: draftNumber(value.sprayVolume),
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
  farmTankCapacityL,
  showTank = false,
  stageSuggestion,
  readOnly = false,
  className,
}: {
  value: ApplicationDataDraft;
  onChange: (patch: Partial<ApplicationDataDraft>) => void;
  /** Área da etapa (ha). Sem ela (modelo), não há calda nem tanques. */
  areaHa?: number | null;
  /** Tanque da fazenda — placeholder quando a etapa não define o seu. */
  farmTankCapacityL?: number | null;
  showTank?: boolean;
  /** Estádio sugerido pelos dias da etapa (placeholder). */
  stageSuggestion?: string | null;
  readOnly?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState<"total" | "tanks" | null>(null);
  const [draftTotal, setDraftTotal] = useState("");
  const [draftTanks, setDraftTanks] = useState("");

  const tankCapacity = positive(value.tankCapacity ?? null) ?? farmTankCapacityL ?? null;
  const presc = computePrescription({
    areaHa,
    sprayVolumeLHa: positive(value.sprayVolume),
    tankCapacityL: showTank ? tankCapacity : null,
  });
  const hasArea = positive(areaHa ?? null) != null;

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          hasArea && showTank ? "lg:grid-cols-4" : hasArea ? "lg:grid-cols-2" : "sm:grid-cols-2",
        )}
      >
        <label className="grid gap-1">
          <Label>Vazão (L/ha)</Label>
          <MoneyInput
            value={value.sprayVolume}
            onValueChange={(sprayVolume) => onChange({ sprayVolume })}
            placeholder="Ex.: 80"
            disabled={readOnly}
            className="h-9 text-right tabular-nums"
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
        {hasArea && showTank ? (
          <>
            <label className="grid gap-1">
              <Label>Tanque (L)</Label>
              <MoneyInput
                value={value.tankCapacity ?? ""}
                onValueChange={(tankCapacity) => onChange({ tankCapacity })}
                placeholder={
                  farmTankCapacityL ? `${fmtQuantity(farmTankCapacityL)} (fazenda)` : "Ex.: 2.000"
                }
                disabled={readOnly}
                className="h-9 text-right tabular-nums"
              />
            </label>
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
          </>
        ) : null}
      </div>
      {hasArea && showTank && presc.tankCount != null ? (
        <p className="-mt-1 text-xs text-muted-foreground">
          {fmtTankCount(presc.tankCount)} tanques: {presc.fullTanks} cheio
          {presc.fullTanks === 1 ? "" : "s"}
          {presc.lastTankL ? ` + último com ${fmtQuantity(presc.lastTankL)} L` : ""} · cada tanque
          cobre {fmtHectares(presc.haPerTank)} ha
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">
          <Label>Horário</Label>
          <Input
            value={value.applicationTime}
            onChange={(e) => onChange({ applicationTime: e.target.value })}
            placeholder="Ex.: 05h30 às 09h00"
            maxLength={120}
            disabled={readOnly}
            className="h-9"
          />
        </label>
        <label className="grid gap-1">
          <Label>Ponta</Label>
          <Input
            value={value.nozzle}
            onChange={(e) => onChange({ nozzle: e.target.value })}
            placeholder="Ex.: Leque 110.02"
            maxLength={120}
            disabled={readOnly}
            className="h-9"
          />
        </label>
        <label className="grid gap-1">
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
      </div>
    </div>
  );
}
