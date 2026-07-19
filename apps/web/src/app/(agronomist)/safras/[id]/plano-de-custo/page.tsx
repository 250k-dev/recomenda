"use client";

import { CostPlanView } from "@/components/domain/cost-plan/cost-plan-view";
import { useSeasonPage } from "@/components/domain/season/use-season-page";

/** Plano de custo da safra do talhão (era `?tab=cost-plan`). */
export default function SeasonCostPlanPage() {
  const { seasonId, season, farmId, producerId, producer, farm } =
    useSeasonPage();

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  return (
    <CostPlanView
      seasonId={seasonId}
      crop={season?.crop ?? "SOYBEAN"}
      farmId={farmId || undefined}
      producerId={producerId || undefined}
      producerName={producer?.name}
      farmName={farm?.name}
    />
  );
}
