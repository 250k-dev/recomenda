"use client";

import { useParams, useSearchParams } from "next/navigation";
import type { BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { useCycle, useFarm, useProducer, useSeason } from "@recomenda/api-hooks";
import { CROP_LABELS, STATUS_LABELS, labelStatus } from "@recomenda/utils";
import { routes } from "@recomenda/config";

/**
 * Contexto comum das telas da safra do talhão (`/safras/[id]` e subrotas):
 * dados da safra, fazenda/produtor do contexto, títulos, hrefs e breadcrumbs.
 * As queries são compartilhadas via cache do React Query entre layout e páginas.
 *
 * Breadcrumb:
 * - Com ciclo: Produtores → Produtor → Safra → Fazenda → programação
 * - Sem ciclo (legado): Produtores → Produtor → Fazenda → programação
 */
export function useSeasonPage() {
  const params = useParams<{ id: string }>();
  const seasonId = params.id;
  const searchParams = useSearchParams();
  const farmIdFromQuery = searchParams.get("farm_id");
  const producerIdFromQuery = searchParams.get("producer_id");
  const recommendationIdFromQuery = searchParams.get("recommendation_id");

  const { data: season, isLoading: loadingSeason } = useSeason(seasonId || "");

  const farmId = farmIdFromQuery ?? "";
  const producerId = producerIdFromQuery ?? season?.producer_id ?? "";
  const openRecommendationId = recommendationIdFromQuery || null;
  const cycleId = season?.cycle_id ?? "";

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId);
  const { data: cycle } = useCycle(cycleId);

  const cropLabel = season ? (CROP_LABELS[season.crop] ?? season.crop) : "";
  const statusLabel = season
    ? labelStatus(STATUS_LABELS, season.status)
    : "";
  const varietyLabel = season
    ? (season.varieties ?? [])
        .map((v) => v.variety)
        .filter(Boolean)
        .join(" + ") || season.variety
    : "";
  const title = season
    ? varietyLabel
      ? `${cropLabel} — ${varietyLabel}`
      : cropLabel
    : "Safra";

  const ctx = { farm_id: farmIdFromQuery, producer_id: producerIdFromQuery };
  const hrefs = {
    cronograma: routes.safras.cronograma(seasonId, ctx),
    planoDeCusto: routes.safras.planoDeCusto(seasonId, ctx),
    historicoDoTalhao: routes.safras.historicoDoTalhao(seasonId, ctx),
  };

  const cycleFarmId = farmId || cycle?.farm_id || "";
  const cycleHref =
    cycleId && cycleFarmId
      ? routes.fazendas.safra(cycleFarmId, cycleId, {
          producer_id: producerId || undefined,
        })
      : null;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : []),
    ...(cycle && cycleHref
      ? [{ label: cycle.name, href: cycleHref }]
      : []),
    ...(farmId && farm
      ? [
          {
            label: farm.name,
            href: routes.fazendas.detalhe(farmId, { producer_id: producerId }),
          },
        ]
      : []),
    { label: title },
  ];

  return {
    seasonId,
    farmId,
    producerId,
    openRecommendationId,
    season,
    farm,
    producer,
    loadingSeason,
    statusLabel,
    title,
    hrefs,
    breadcrumbs,
  };
}

export type SeasonPage = ReturnType<typeof useSeasonPage>;
