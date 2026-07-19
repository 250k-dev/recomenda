"use client";

import { useQueries } from "@tanstack/react-query";
import { getProducerPurchaseLists } from "@recomenda/api/purchase-lists";
import { computePortfolioPriceCoverage } from "@recomenda/domain/purchase-list/metrics";
import { queryKeys } from "./queryKeys";

export function usePortfolioPriceCoverage(producerIds: string[]) {
  const queries = useQueries({
    queries: producerIds.map((producerId) => ({
      queryKey: queryKeys.producerPurchaseLists(producerId),
      queryFn: () => getProducerPurchaseLists(producerId),
      enabled: Boolean(producerId),
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);
  const lists = queries.flatMap((query) => query.data ?? []);
  const coverage = computePortfolioPriceCoverage(lists);

  return { ...coverage, isLoading, isFetching };
}
