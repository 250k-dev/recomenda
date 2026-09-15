"use client";

import { CheckCircle2, Clock, SkipForward } from "lucide-react";
import { cn, labelStatus } from "@recomenda/utils";
import type { PlotHistoryRec } from "@recomenda/api/seasons";

export const REC_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulada",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  APPLIED_ON_TIME: <CheckCircle2 className="h-3 w-3" />,
  APPLIED_LATE: <CheckCircle2 className="h-3 w-3" />,
  SKIPPED: <SkipForward className="h-3 w-3" />,
};

export const REC_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-surface-2 text-muted-foreground border-border",
  APPLIED_ON_TIME: "bg-success-soft text-success-strong border-success-border",
  APPLIED_LATE: "bg-warning-soft text-warning-strong border-warning-border",
  SKIPPED: "bg-clay-soft text-clay-strong border-clay-border",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function RecommendationHistoryRow({ rec }: { rec: PlotHistoryRec }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{rec.name}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            REC_STATUS_CLASS[rec.status] ??
              "border-border bg-surface-2 text-muted-foreground",
          )}
        >
          {STATUS_ICON[rec.status]}
          {labelStatus(REC_STATUS_LABEL, rec.status)}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {rec.predicted_date_current ? (
          <span>Previsto: {fmtDate(rec.predicted_date_current)}</span>
        ) : null}
        {rec.executed_date ? (
          <span className="text-success-strong">
            Executado: {fmtDate(rec.executed_date)}
          </span>
        ) : null}
      </div>
      {rec.items.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {rec.items.map((item, i) => (
            <span
              key={i}
              className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {item.product_name} · {item.dose_per_hectare} {item.dose_unit}/ha
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
