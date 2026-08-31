"use client";

import { useQuery } from "@tanstack/react-query";
import { getPurchaseListsCoverage } from "@recomenda/api/purchase-lists";
import { queryKeys } from "./queryKeys";
import { useWalletScopeKey } from "./use-active-scope";

export function usePortfolioPriceCoverage(enabled = true) {
  const scopeKey = useWalletScopeKey();
  const query = useQuery({
    queryKey: queryKeys.purchaseListsCoverage(scopeKey),
    queryFn: getPurchaseListsCoverage,
    enabled,
  });

  const coverage = query.data ?? {
    totalLists: 0,
    completeLists: 0,
    pendingLists: 0,
    pct: 0,
  };

  return {
    ...coverage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
