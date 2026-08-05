"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCycleFarm,
  applyCycleBlock,
  createCycle,
  deleteCycle,
  getCycle,
  getCycleAvailablePlots,
  getCycleCostPlan,
  getFarmCycles,
  getProducerCycles,
  publishCycle,
  removeCycleFarm,
  updateCycle,
  type ApplyBlockPayload,
} from "@recomenda/api/cycles";
import { getPurchaseListByCycle } from "@recomenda/api/purchase-lists";
import { queryKeys } from "./queryKeys";

export function useFarmCycles(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmCycles(farmId),
    queryFn: () => getFarmCycles(farmId),
    enabled: Boolean(farmId),
  });
}

export function useProducerCycles(producerId: string) {
  return useQuery({
    queryKey: queryKeys.producerCycles(producerId),
    queryFn: () => getProducerCycles(producerId),
    enabled: Boolean(producerId),
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
    mutationFn: (payload: {
      producer_id: string;
      name: string;
      crops: string[];
      farm_ids?: string[];
    }) => createCycle(farmId, payload),
    onSuccess: (cycle) => {
      // Invalida a fazenda da URL e todas as fazendas participantes da safra —
      // uma safra multi-fazenda aparece na lista de cada uma.
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(cycle.producer_id),
      });
      for (const farm of cycle.farms) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farm.id) });
      }
    },
  });
}

/** Atualiza nome/culturas/status da safra. */
export function useUpdateCycle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; crops?: string[]; status?: string }) =>
      updateCycle(id, payload),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(cycle.producer_id),
      });
      for (const farm of cycle.farms) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farm.id) });
      }
      if (cycle.farm_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmCycles(cycle.farm_id),
        });
      }
    },
  });
}

/** Exclui (arquiva) a safra — some das listagens e remove a lista de compra. */
export function useDeleteCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCycle(id),
    onSuccess: (result) => {
      if (result.producer_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.producerCycles(result.producer_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.producerFarms(result.producer_id),
        });
      }
      const farmIds = result.farm_ids?.length
        ? result.farm_ids
        : result.farm_id
          ? [result.farm_id]
          : [];
      for (const farmId of farmIds) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmCycles(farmId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(result.id) });
      void queryClient.invalidateQueries({ queryKey: ["farm-cycles"] });
      void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
    },
  });
}

/** Vincula uma fazenda a mais à safra. Invalida a safra e as listas de safras
 *  de todas as fazendas afetadas (a nova e as que já faziam parte). */
export function useAddCycleFarm(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (farmId: string) => addCycleFarm(id, farmId),
    onSuccess: (cycle, farmId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleAvailablePlots(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(cycle.producer_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerFarms(cycle.producer_id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
      for (const farm of cycle.farms) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farm.id) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmPurchaseLists(farm.id),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
    },
  });
}

/** Desvincula uma fazenda da safra. Ver códigos de erro em `apiErrorMessage`
 *  (`FARM_HAS_ACTIVE_SEASONS`, `FARM_LOCKED_BY_PURCHASES`). */
export function useRemoveCycleFarm(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (farmId: string) => removeCycleFarm(id, farmId),
    onSuccess: (cycle, farmId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleAvailablePlots(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
      for (const farm of cycle.farms) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farm.id) });
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
      const farmIds = new Set<string>([
        result.cycle.farm_id,
        ...(result.cycle.farms ?? []).map((f) => f.id),
      ]);
      for (const farmId of farmIds) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons(farmId) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmPurchaseLists(farmId),
        });
      }
      // Mixes podem espelhar produtos fora da programação na lista de compra.
      queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(id) });
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
