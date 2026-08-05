"use client";

import { toast } from "sonner";
import { PageHeaderSkeleton } from "@/components/domain/page-skeletons";
import { SeasonRecommendationsView } from "@/components/domain/season/season-recommendations-view";
import { useSeasonPage } from "@/components/domain/season/use-season-page";
import { usePublishSeason } from "@recomenda/api-hooks";
import { publishBlockedMessage } from "@recomenda/api/api-error";
import { usePublishSeasonGuard } from "@/components/domain/season/use-publish-season-guard";

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
  const publishMutation = usePublishSeason(seasonId || "");
  const publishGuard = usePublishSeasonGuard(season?.cycle_id);

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  const handlePublish = () => {
    if (!publishGuard.canPublish) {
      toast.error(
        publishGuard.reason ??
          "Finalize 100% das compras da lista antes de publicar a safra.",
      );
      return;
    }
    publishMutation.mutate([], {
      onSuccess: () => toast.success("Safra publicada com sucesso!"),
      onError: (error: unknown) => {
        toast.error(publishBlockedMessage(error, "Falha ao publicar safra"));
      },
    });
  };

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
      onPublish={season?.status === "DRAFT" ? handlePublish : undefined}
      isPublishing={publishMutation.isPending || publishGuard.isLoading}
    />
  );
}
