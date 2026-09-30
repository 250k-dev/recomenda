"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PurchaseListInput,
  createPurchaseList,
  deletePurchaseList,
  getPurchaseListBySeason,
  getPurchaseListTemplates,
  updatePurchaseList,
  getProducerPurchaseLists,
  getFarmPurchaseLists,
  getPlanSurplus,
  adjustPlanToUsage,
} from "@recomenda/api/purchase-lists";
import { queryKeys } from "./queryKeys";

export function useSeasonCostPlan(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonCostPlan(seasonId),
    queryFn: () => getPurchaseListBySeason(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useUpdatePurchaseList(id: string, options?: { farmId?: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PurchaseListInput>) => updatePurchaseList(id, payload),
    onSuccess: (data) => {
      if (data.season_id) {
        queryClient.setQueryData(queryKeys.seasonCostPlan(data.season_id), data);
      }
      if (data.producer_id) {
        queryClient.setQueryData(
          queryKeys.producerPurchaseLists(data.producer_id),
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            return old.map((row: { id: string }) => (row.id === data.id ? data : row));
          },
        );
      }
      if (options?.farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmPurchaseLists(options.farmId) });
      }
      if (data.cycle_id) {
        queryClient.setQueryData(queryKeys.cyclePurchaseList(data.cycle_id), data);
      }
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

// --- Templates de compra ------------------------------------------------------

export function usePurchaseListTemplates() {
  return useQuery({
    queryKey: queryKeys.purchaseListTemplates(),
    queryFn: getPurchaseListTemplates,
  });
}

export function useCreatePurchaseListTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PurchaseListInput) =>
      createPurchaseList({ ...payload, is_template: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListTemplates() });
    },
  });
}

export function useUpdatePurchaseListTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PurchaseListInput>) => updatePurchaseList(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListTemplates() });
    },
  });
}

export function useDeletePurchaseListTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePurchaseList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListTemplates() });
    },
  });
}


/** Produtos programados bem acima do uso nas etapas. */
export function usePlanSurplus(listId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchaseListPlanSurplus(listId),
    queryFn: () => getPlanSurplus(listId),
    enabled: Boolean(listId) && enabled,
  });
}

/** "Ajustar ao uso": o excesso deixa de ser reservado e sai do "falta comprar". */
export function useAdjustPlanToUsage(listId: string, opts: { cycleId?: string; producerId?: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (localProductId: string) => adjustPlanToUsage(listId, localProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListPlanSurplus(listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListProgress(listId) });
      if (opts.cycleId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(opts.cycleId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.cycle(opts.cycleId) });
      }
      if (opts.producerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(opts.producerId) });
      }
    },
  });
}
