"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyCycleBlock,
  createCycle,
  getCycle,
  getCycleAvailablePlots,
  getCycleCostPlan,
  getFarmCycles,
  publishCycle,
  updateCycle,
  type ApplyBlockPayload,
} from "@/lib/api/cycles";
import { getPurchaseListByCycle } from "@/lib/api/purchase-lists";
import { queryKeys } from "./queryKeys";

export function useFarmCycles(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmCycles(farmId),
    queryFn: () => getFarmCycles(farmId),
    enabled: Boolean(farmId),
  });
}

export function useCycle(id: string) {
  return useQuery({
    queryKey: queryKeys.cycle(id),
    queryFn: () => getCycle(id),
    enabled: Boolean(id),
  });
}

export function useCycleAvailablePlots(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cycleAvailablePlots(id),
    queryFn: () => getCycleAvailablePlots(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useCycleCostPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.cycleCostPlan(id),
    queryFn: () => getCycleCostPlan(id),
    enabled: Boolean(id),
  });
}

export function useCyclePurchaseList(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.cyclePurchaseList(cycleId),
    queryFn: () => getPurchaseListByCycle(cycleId),
    enabled: Boolean(cycleId),
  });
}

export function useCreateCycle(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { producer_id: string; name: string; crops: string[] }) =>
      createCycle(farmId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
    },
  });
}

export function useUpdateCycle(id: string, farmId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; crops?: string[]; status?: string }) =>
      updateCycle(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      if (farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
      }
    },
  });
}

export function useApplyCycleBlock(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplyBlockPayload) => applyCycleBlock(id, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleAvailablePlots(id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmCycles(result.cycle.farm_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmSeasons(result.cycle.farm_id),
      });
      // Mixes podem espelhar produtos fora da programação na lista de compra.
      queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmPurchaseLists(result.cycle.farm_id),
      });
      void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
    },
  });
}

export function usePublishCycle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => publishCycle(id),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(cycle.farm_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons(cycle.farm_id) });
    },
  });
}
