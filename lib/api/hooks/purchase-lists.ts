"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PurchaseListInput,
  getPurchaseListBySeason,
  updatePurchaseList,
  getProducerPurchaseLists,
  getFarmPurchaseLists,
} from "@/lib/api/purchase-lists";
import { queryKeys } from "./queryKeys";

export function useSeasonCostPlan(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonCostPlan(seasonId),
    queryFn: () => getPurchaseListBySeason(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useUpdatePurchaseList(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PurchaseListInput>) => updatePurchaseList(id, payload),
    onSuccess: (data) => {
      if (data.season_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.seasonCostPlan(data.season_id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.producerPurchaseLists(data.producer_id) });
    },
  });
}

export function useProducerPurchaseLists(producerId: string) {
  return useQuery({
    queryKey: queryKeys.producerPurchaseLists(producerId),
    queryFn: () => getProducerPurchaseLists(producerId),
    enabled: Boolean(producerId),
  });
}

export function useFarmPurchaseLists(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmPurchaseLists(farmId),
    queryFn: () => getFarmPurchaseLists(farmId),
    enabled: Boolean(farmId),
  });
}
