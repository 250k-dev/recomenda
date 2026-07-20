"use client";

import { CheckCircle2, AlertTriangle, Clock, SkipForward, Leaf } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { cn, CROP_LABELS } from "@recomenda/utils";
import { usePlotHistory } from "@recomenda/api-hooks";
import type { PlotHistorySeason, PlotHistoryRec } from "@recomenda/api/seasons";

const STATUS_LABEL: Record<string, string> = {
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

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-surface-2 text-muted-foreground border-border",
  APPLIED_ON_TIME: "bg-success-soft text-success-strong border-success-border",
  APPLIED_LATE: "bg-warning-soft text-warning-strong border-warning-border",
  SKIPPED: "bg-clay-soft text-clay-strong border-clay-border",
};

const SEASON_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "secondary"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  IN_PROGRESS: "default",
  HARVESTED: "success",
  ARCHIVED: "secondary",
};

const SEASON_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em execução",
  HARVESTED: "Colhida",
  ARCHIVED: "Arquivada",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function RecRow({ rec }: { rec: PlotHistoryRec }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{rec.name}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            STATUS_CLASS[rec.status] ?? "bg-surface-2 text-muted-foreground border-border",
          )}
        >
          {STATUS_ICON[rec.status]}
          {STATUS_LABEL[rec.status] ?? rec.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {rec.predicted_date_current ? (
          <span>Previsto: {fmtDate(rec.predicted_date_current)}</span>
        ) : null}
        {rec.executed_date ? (
          <span className="text-success-strong">Executado: {fmtDate(rec.executed_date)}</span>
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

function SeasonCard({ season }: { season: PlotHistorySeason }) {
  const cropLabel = CROP_LABELS[season.crop] ?? season.crop;
  const applied = season.recommendations.filter(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  ).length;
  const total = season.recommendations.length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        season.is_current && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 shrink-0 text-primary-strong" />
          <span className="font-semibold text-foreground">
            {cropLabel}
            {season.variety ? ` — ${season.variety}` : ""}
          </span>
          {season.is_current ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              Atual
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={SEASON_STATUS_VARIANT[season.status] ?? "default"}>
            {SEASON_STATUS_LABEL[season.status] ?? season.status}
          </Badge>
          {season.planting_date ? (
            <span className="text-xs text-muted-foreground">
              Plantio: {fmtDate(season.planting_date)}
            </span>
          ) : null}
          {total > 0 ? (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {applied}/{total} aplicadas
            </span>
          ) : null}
        </div>
      </div>

      {season.recommendations.length > 0 ? (
        <div className="flex flex-col gap-2 p-3">
          {season.recommendations.map((rec) => (
            <RecRow key={rec.id} rec={rec} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma etapa registrada.</p>
      )}
    </div>
  );
}

export function PlotHistoryTab({ seasonId }: { seasonId: string }) {
  const { data: history, isLoading } = usePlotHistory(seasonId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma safra encontrada para este talhão.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {history.length} {history.length === 1 ? "safra" : "safras"} neste talhão
      </p>
      {history.map((season) => (
        <SeasonCard key={season.id} season={season} />
      ))}
    </div>
  );
}
