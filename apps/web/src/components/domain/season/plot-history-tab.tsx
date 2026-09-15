"use client";

import { Leaf } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { cn, CROP_LABELS, STATUS_LABELS, labelStatus } from "@recomenda/utils";
import { usePlotHistory } from "@recomenda/api-hooks";
import type { PlotHistorySeason } from "@recomenda/api/seasons";
import { RecommendationHistoryRow } from "@/components/domain/season/recommendation-history-row";

const SEASON_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "secondary"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  IN_PROGRESS: "default",
  HARVESTED: "success",
  ARCHIVED: "secondary",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
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
            {labelStatus(STATUS_LABELS, season.status)}
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
            <RecommendationHistoryRow key={rec.id} rec={rec} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Nenhuma etapa registrada.
        </p>
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
