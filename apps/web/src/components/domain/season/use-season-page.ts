"use client";

import { useParams, useSearchParams } from "next/navigation";
import type { BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { useFarm, useProducer, useSeason } from "@/lib/api/hooks";
import { CROP_LABELS, STATUS_LABELS } from "@/lib/season-constants";
import { routes } from "@/config/routes";

/**
 * Contexto comum das telas da safra do talhão (`/safras/[id]` e subrotas):
 * dados da safra, fazenda/produtor do contexto, títulos, hrefs e breadcrumbs.
 * As queries são compartilhadas via cache do React Query entre layout e páginas.
 */
export function useSeasonPage() {
  const params = useParams<{ id: string }>();
  const seasonId = params.id;
  const searchParams = useSearchParams();
  const farmIdFromQuery = searchParams.get("farm_id");
  const producerIdFromQuery = searchParams.get("producer_id");

  const { data: season, isLoading: loadingSeason } = useSeason(seasonId || "");

  const farmId = farmIdFromQuery ?? "";
  const producerId = producerIdFromQuery ?? season?.producer_id ?? "";

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId);

  const cropLabel = season ? (CROP_LABELS[season.crop] ?? season.crop) : "";
  const statusLabel = season
    ? (STATUS_LABELS[season.status] ?? season.status)
    : "";
  const title = season
    ? season.variety
      ? `${cropLabel} — ${season.variety}`
      : cropLabel
    : "Safra";

  const ctx = { farm_id: farmIdFromQuery, producer_id: producerIdFromQuery };
  const hrefs = {
    cronograma: routes.safras.cronograma(seasonId, ctx),
    planoDeCusto: routes.safras.planoDeCusto(seasonId, ctx),
    historicoDoTalhao: routes.safras.historicoDoTalhao(seasonId, ctx),
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
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
