"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCycleFarm,
  addCyclePlots,
  applyCycleBlock,
  concludeHistoryCycle,
  createCycle,
  createProducerHistoricalCycle,
  deleteCycle,
  getCycle,
  getCycleAvailablePlots,
  getCycleCostPlan,
  getCycleRestorePreview,
  getFarmCycles,
  getProducerCycles,
  getProducerPlotCycleUsage,
  publishCycle,
  removeCycleFarm,
  removeCyclePlot,
  restoreCycle,
  syncCycleListDoses,
  updateCycle,
  updateCyclePlotArea,
  type ApplyBlockPayload,
  type CycleDetail,
  type CyclePlotInput,
  type CycleRestorePosition,
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

/**
 * Realinha as doses da lista de compra com a programação da safra.
 * Não entra no apply de modelo — só quando o agrônomo pede o alinhamento.
 */
export function useSyncCycleListDoses(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncCycleListDoses(cycleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cycle-purchase-list"] });
      void queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
      void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
      void queryClient.invalidateQueries({ queryKey: ["cycle-cost-plan"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cycle(cycleId) });
    },
  });
}

export function useCreateCycle(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createCycle>[1]) => createCycle(farmId, payload),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({
        queryKey: ["producer-plot-cycle-usage", cycle.producer_id],
      });
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

export function useConcludeHistoryCycle(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => concludeHistoryCycle(cycleId),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(cycleId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(cycle.producer_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycleHistory(cycle.producer_id, cycleId),
      });
      for (const farm of cycle.farms ?? []) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farm.id) });
      }
    },
  });
}

export function useCreateHistoricalCycle(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      crops: string[];
      farm_ids: string[];
      closed_at: string;
      status: "HARVESTED" | "ARCHIVED";
      stock_items?: Array<{
        local_product_id: string;
        quantity: number;
        price_brl?: number | null;
      }>;
    }) => createProducerHistoricalCycle(producerId, payload),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(producerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycleHistory(producerId, cycle.id),
      });
      for (const farm of cycle.farms ?? []) {
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

/** Em quais safras ativas cada talhão do produtor já está (aviso na criação). */
export function useProducerPlotCycleUsage(producerId: string, enabled = true) {
  return useQuery({
    queryKey: ["producer-plot-cycle-usage", producerId],
    queryFn: () => getProducerPlotCycleUsage(producerId),
    enabled: Boolean(producerId) && enabled,
  });
}

/**
 * Mexer nos talhões da safra muda a área da lista de compra, o plano de custo e
 * a reserva do galpão — invalida tudo isso (invalidação faltando = lista velha
 * semeando o rascunho e encolhendo no autosave).
 */
function invalidateCyclePlots(
  queryClient: ReturnType<typeof useQueryClient>,
  cycle: CycleDetail,
) {
  queryClient.setQueryData(queryKeys.cycle(cycle.id), cycle);
  queryClient.invalidateQueries({ queryKey: queryKeys.cycle(cycle.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cycleAvailablePlots(cycle.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(cycle.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(cycle.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.producerCycles(cycle.producer_id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(cycle.producer_id) });
  queryClient.invalidateQueries({ queryKey: ["producer-plot-cycle-usage", cycle.producer_id] });
  queryClient.invalidateQueries({ queryKey: ["farm-cycles"] });
  queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
  queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
}

/** Inclui talhões na safra (ou atualiza a área). */
export function useAddCyclePlots(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plots: CyclePlotInput[]) => addCyclePlots(cycleId, plots),
    onSuccess: (cycle) => invalidateCyclePlots(queryClient, cycle),
  });
}

/** Área do talhão na safra (`null` = cadastral). */
export function useUpdateCyclePlotArea(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plotId, areaHa }: { plotId: string; areaHa: number | null }) =>
      updateCyclePlotArea(cycleId, plotId, areaHa),
    onSuccess: (cycle) => invalidateCyclePlots(queryClient, cycle),
  });
}

/** Tira o talhão da safra. */
export function useRemoveCyclePlot(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plotId: string) => removeCyclePlot(cycleId, plotId),
    onSuccess: (cycle) => invalidateCyclePlots(queryClient, cycle),
  });
}

/** Prévia de "Recuperar safra" (impacto no galpão). Só busca com o diálogo aberto. */
export function useCycleRestorePreview(id: string | null) {
  return useQuery({
    queryKey: ["cycle-restore-preview", id],
    queryFn: () => getCycleRestorePreview(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

/** Recupera safra arquivada. Mexe em safras, listas e na divisão do galpão. */
export function useRestoreCycle(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: CycleRestorePosition }) =>
      restoreCycle(id, position),
    onSuccess: (cycle, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producerCycles(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerFarms(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerPurchaseLists(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cyclePurchaseList(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCostPlan(id) });
      queryClient.invalidateQueries({ queryKey: ["cycle-restore-preview"] });
      queryClient.invalidateQueries({ queryKey: ["farm-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
      queryClient.invalidateQueries({ queryKey: ["cycle-purchase-list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(cycle.farm_id) });
    },
  });
}

/** Vincula uma fazenda a mais à safra. Invalida a safra e as listas de safras
 *  de todas as fazendas afetadas (a nova e as que já faziam parte). */
export function useAddCycleFarm(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { farmId: string; plots?: CyclePlotInput[] }) =>
      typeof input === "string"
        ? addCycleFarm(id, input)
        : addCycleFarm(id, input.farmId, input.plots),
    onSuccess: (cycle, input) => {
      const farmId = typeof input === "string" ? input : input.farmId;
      queryClient.invalidateQueries({
        queryKey: ["producer-plot-cycle-usage", cycle.producer_id],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.producerStock(cycle.producer_id) });
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
