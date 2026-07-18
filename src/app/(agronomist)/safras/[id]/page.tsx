"use client";

import { toast } from "sonner";
import { PageHeaderSkeleton } from "@/components/domain/page-skeletons";
import { SeasonRecommendationsView } from "@/components/domain/season/season-recommendations-view";
import { useSeasonPage } from "@/components/domain/season/use-season-page";
import { usePublishSeason } from "@/lib/api/hooks";

/** Cronograma de recomendações — tela padrão da safra (era `?tab=recommendations`). */
export default function SeasonSchedulePage() {
  const {
    seasonId,
    season,
    farmId,
    producerId,
    loadingSeason,
    statusLabel,
    title,
  } = useSeasonPage();
  const publishMutation = usePublishSeason(seasonId || "");

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  const handlePublish = () => {
    publishMutation.mutate([], {
      onSuccess: () => toast.success("Safra publicada com sucesso!"),
      onError: (error: unknown) => {
        const msg =
          error instanceof Error ? error.message : "Falha ao publicar safra";
        toast.error(`Erro: ${msg || "Falha ao publicar safra"}`);
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
      onPublish={season?.status === "DRAFT" ? handlePublish : undefined}
      isPublishing={publishMutation.isPending}
    />
  );
}
