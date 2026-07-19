"use client";

import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getProducers,
  getProducer,
  createProducer,
  updateProducer,
  deleteProducer,
  setProducerActive,
  getProducerFarms,
  getProducerStock,
  adjustProducerStock,
  removeFarmAccess,
  createInvitation,
  revokeInvitation,
  getInvitationByToken,
  acceptInvitation,
} from "@recomenda/api/producers";
import { getSeasonShoppingList } from "@recomenda/api/seasons";
import { queryKeys } from "./queryKeys";

export function useProducers() {
  return useQuery({ queryKey: queryKeys.producers, queryFn: getProducers });
}

export function useProducer(id: string) {
  return useQuery({
    queryKey: queryKeys.producer(id),
    queryFn: () => getProducer(id),
    enabled: Boolean(id),
  });
}

export function useCreateProducer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProducer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useUpdateProducer(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; email?: string; phone?: string }) => updateProducer(producerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producer(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useDeleteProducer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProducer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useSetProducerActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      setProducerActive(vars.id, vars.is_active),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producer(vars.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useProducerFarms(producerId: string) {
  return useQuery({
    queryKey: queryKeys.producerFarms(producerId),
    queryFn: () => getProducerFarms(producerId),
    enabled: Boolean(producerId),
  });
}

export function useProducerStock(producerId: string) {
  return useQuery({
    queryKey: queryKeys.producerStock(producerId),
    queryFn: () => getProducerStock(producerId),
    enabled: Boolean(producerId),
  });
}

export function useAdjustProducerStock(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { local_product_id: string; new_quantity: number; notes?: string }) =>
      adjustProducerStock(producerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(producerId) });
    },
  });
}

export function useRemoveFarmAccess(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (farmId: string) => removeFarmAccess(producerId, farmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producerFarms(producerId) });
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useInvitationByToken(token: string) {
  return useQuery({
    queryKey: queryKeys.invitationToken(token),
    queryFn: () => getInvitationByToken(token),
    enabled: Boolean(token),
  });
}

export function useAcceptInvitation(token: string) {
  return useMutation({
    mutationFn: (payload: { name: string; password: string }) => acceptInvitation(token, payload),
  });
}

export function useFarmAggregatedShoppingList(seasonIds: string[]) {
  const queries = useQueries({
    queries: seasonIds.map((seasonId) => ({
      queryKey: queryKeys.seasonShoppingList(seasonId),
      queryFn: () => getSeasonShoppingList(seasonId),
      enabled: Boolean(seasonId),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const items = queries.flatMap((q) => q.data ?? []).reduce<
    Map<
      string,
      {
        local_product_id: string;
        product_name: string;
        dose_unit: string;
        total_quantity: number;
        current_stock: number;
        quantity_to_buy: number;
      }
    >
  >((map, item) => {
    const existing = map.get(item.local_product_id);
    if (existing) {
      existing.total_quantity += Number(item.total_quantity ?? 0);
      existing.quantity_to_buy += Number(item.quantity_to_buy ?? 0);
    } else {
      map.set(item.local_product_id, {
        local_product_id: item.local_product_id,
        product_name: item.product_name,
        dose_unit: item.dose_unit,
        total_quantity: Number(item.total_quantity ?? 0),
        current_stock: Number(item.current_stock ?? 0),
        quantity_to_buy: Number(item.quantity_to_buy ?? 0),
      });
    }
    return map;
  }, new Map());

  return {
    items: [...items.values()],
    isLoading,
  };
}
