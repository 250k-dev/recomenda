"use client";

import { PageHeaderSkeleton } from "@/components/domain/page-skeletons";
import { SeasonRecommendationsView } from "@/components/domain/season/season-recommendations-view";
import { useSeasonPage } from "@/components/domain/season/use-season-page";

/** Cronograma de recomendações — tela padrão da safra (era `?tab=recommendations`). */
export default function SeasonSchedulePage() {
  const {
    seasonId,
    season,
    farmId,
    producerId,
    openRecommendationId,
    loadingSeason,
    statusLabel,
    title,
  } = useSeasonPage();

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  if (loadingSeason) return <PageHeaderSkeleton withAction />;

  return (
    <SeasonRecommendationsView
      seasonId={seasonId}
      title={title}
      plotName={season?.plot_name}
      plantingDate={season?.planting_date}
      statusLabel={statusLabel}
      seasonStatus={season?.status}
      producerId={producerId || undefined}
      crop={season?.crop}
      farmId={farmId || undefined}
      openRecommendationId={openRecommendationId}
    />
  );
}
