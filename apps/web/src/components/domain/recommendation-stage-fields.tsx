"use client";

import { Input } from "@recomenda/ui/primitives/input";
import { Textarea } from "@recomenda/ui/primitives/textarea";
import { Select } from "@recomenda/ui/forms/select";
import { Field } from "@/components/domain/season/_shared";
import {
  StageWindowDateFields,
  TIMING_TRIGGER_TYPES,
} from "@/components/domain/timing/timing-stages-editor";
import { todayLocalYmd } from "@recomenda/domain/timing/window-days";

export function normalizeSeasonTriggerType(value?: string | null): string {
  if (value === "PRE_PLANTING" || value === "DAYS_AFTER_DESICCATION") {
    return "PRE_PLANTING";
  }
  if (value === "PLANTING") return "PLANTING";
  return "POST_PLANTING";
}

export type RecommendationStageDraft = {
  name: string;
  trigger_type: string;
  recommended_date: string;
  notes: string;
};

export function recommendationToStageDraft(rec: {
  name: string;
  trigger_type?: string | null;
  predicted_date_current?: string | null;
  notes?: string | null;
}): RecommendationStageDraft {
  return {
    name: rec.name,
    trigger_type: normalizeSeasonTriggerType(rec.trigger_type),
    recommended_date: rec.predicted_date_current?.slice(0, 10) || todayLocalYmd(),
    notes: rec.notes ?? "",
  };
}

export function RecommendationStageFields({
  draft,
  onChange,
  readOnly = false,
}: {
  draft: RecommendationStageDraft;
  onChange: (patch: Partial<RecommendationStageDraft>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ex: 1ª Fungicida"
          disabled={readOnly}
        />
      </Field>
      <Field label="Fase">
        <Select
          value={draft.trigger_type}
          onValueChange={(trigger_type) => onChange({ trigger_type })}
          options={TIMING_TRIGGER_TYPES.map(({ value, label }) => ({
            value,
            label,
          }))}
          disabled={readOnly}
        />
      </Field>
      <StageWindowDateFields
        recommendedDate={draft.recommended_date}
        onRecommendedDateChange={(recommended_date) => onChange({ recommended_date })}
        readOnly={readOnly}
        mode="date"
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Field label="Observações">
          <Textarea
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Instruções, condições de aplicação ou observações desta etapa…"
            rows={3}
            disabled={readOnly}
          />
        </Field>
      </div>
    </div>
  );
}
