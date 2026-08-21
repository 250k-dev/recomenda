"use client";

import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getProducers,
  getProducer,
  createProducer,
  inviteProducerAccess,
  updateProducer,
  deleteProducer,
  setProducerActive,
  getProducerFarms,
  getProducerStock,
  adjustProducerStock,
  deleteProducerStock,
  createInvitation,
  revokeInvitation,
  getInvitations,
  resendInvitation,
  deleteInvitation,
  getInvitationByToken,
  acceptInvitation,
} from "@recomenda/api/producers";
import { getStockHistory, getStockOrigins } from "@recomenda/api/purchases";
import { getSeasonShoppingList } from "@recomenda/api/seasons";
import { queryKeys } from "./queryKeys";
import { useWalletScopeKey } from "./use-active-scope";

export function useProducers() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.producers, scopeKey],
    queryFn: getProducers,
  });
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

export function useInviteProducerAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (producerId: string) => inviteProducerAccess(producerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
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
    mutationFn: (payload: {
      local_product_id: string;
      new_quantity: number;
      notes?: string;
      price_brl?: number | null;
    }) => adjustProducerStock(producerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerPurchaseLists(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerCycles(producerId) });
    },
  });
}

export function useDeleteProducerStock(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (localProductId: string) => deleteProducerStock(producerId, localProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerPurchaseLists(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerCycles(producerId) });
    },
  });
}

export function useStockOrigins(producerId: string, localProductId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.stockOrigins(producerId, localProductId),
    queryFn: () => getStockOrigins(producerId, localProductId),
    enabled: Boolean(producerId && localProductId) && enabled,
  });
}

export function useStockHistory(producerId: string, q?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.stockHistory(producerId, q),
    queryFn: () => getStockHistory(producerId, q),
    enabled: Boolean(producerId) && enabled,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmTeamAll });
      queryClient.invalidateQueries({ queryKey: ["farm-team"] });
    },
  });
}

/** Convites de um tipo (`CONSULTANT` carteira · `FARM_TEAM` fazenda). */
export function useInvitations(
  kind?: "PRODUCER" | "CONSULTANT" | "FARM_TEAM",
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.invitations(kind),
    queryFn: () => getInvitations(kind),
    enabled: options?.enabled !== false,
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useDeleteInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
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
    mutationFn: (payload: { name?: string; password?: string }) =>
      acceptInvitation(token, payload),
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
