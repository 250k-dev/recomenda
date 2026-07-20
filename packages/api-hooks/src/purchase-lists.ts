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
        queryClient.invalidateQueries({ queryKey: queryKeys.seasonCostPlan(data.season_id) });
      }
      if (data.producer_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.producerPurchaseLists(data.producer_id),
        });
      }
      if (options?.farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmPurchaseLists(options.farmId) });
      }
      // A lista da safra alimenta o editor na página da safra. Sem invalidar aqui,
      // a tela seguia mostrando os itens ANTIGOS depois de salvar — e ao reabrir a
      // edição o rascunho era semeado com esse estado velho, que o autosave então
      // gravava por cima, apagando o que tinha acabado de ser salvo.
      if (data.cycle_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.cyclePurchaseList(data.cycle_id),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(data.cycle_id) });
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

