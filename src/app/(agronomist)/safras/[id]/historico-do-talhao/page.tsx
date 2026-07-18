"use client";

import { PlotHistoryTab } from "@/components/domain/season/plot-history-tab";
import { useSeasonPage } from "@/components/domain/season/use-season-page";

/** Histórico do talhão da safra (era `?tab=plot-history`). */
export default function SeasonPlotHistoryPage() {
  const { seasonId } = useSeasonPage();

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  return <PlotHistoryTab seasonId={seasonId} />;
}
