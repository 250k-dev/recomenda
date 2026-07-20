"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFarms,
  getFarm,
  createFarm,
  updateFarm,
  getFarmPlots,
  getFarmSeasons,
  getFarmAccess,
  createPlot,
  updatePlot,
  deletePlot,
} from "@recomenda/api/farms";
import { queryKeys } from "./queryKeys";

export function useFarms() {
  return useQuery({ queryKey: queryKeys.farms, queryFn: getFarms });
}

export function useFarm(id: string) {
  return useQuery({
    queryKey: queryKeys.farm(id),
    queryFn: () => getFarm(id),
    enabled: Boolean(id),
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
    },
  });
}

export function useUpdateFarm(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; location?: string }) => updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farm(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
    },
  });
}

export function useFarmPlots(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmPlots(farmId),
    queryFn: () => getFarmPlots(farmId),
    enabled: Boolean(farmId),
  });
}

export function useFarmSeasons(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmSeasons(farmId),
    queryFn: () => getFarmSeasons(farmId),
    enabled: Boolean(farmId),
  });
}

export function useFarmAccess(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmAccess(farmId),
    queryFn: () => getFarmAccess(farmId),
    enabled: Boolean(farmId),
  });
}

/**
 * Produtor do contexto da fazenda: o da URL (`?producer_id=`) ou, na falta
 * dele, o único produtor com acesso à fazenda. `null` quando ambíguo.
 */
export function useResolvedFarmProducerId(
  farmId: string,
  producerIdFromUrl: string | null,
): string | null {
  const { data: access } = useFarmAccess(farmId);
  return useMemo(() => {
    if (producerIdFromUrl) return producerIdFromUrl;
    if (access?.length === 1) return access[0].producer_id;
    return null;
  }, [producerIdFromUrl, access]);
}

export function useCreatePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; area_hectares: number }) => createPlot(farmId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
    },
  });
}

export function useUpdatePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      area_hectares?: number;
    }) => updatePlot(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
    },
  });
}

export function useDeletePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlot,
    // Remove o talhão da lista na hora (sem esperar refetch / F5).
    onMutate: async (plotId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.farmPlots(farmId) });
      const previous = queryClient.getQueryData<
        Awaited<ReturnType<typeof getFarmPlots>>
      >(queryKeys.farmPlots(farmId));
      if (previous) {
        queryClient.setQueryData(
          queryKeys.farmPlots(farmId),
          previous.filter((p) => p.id !== plotId),
        );
      }
      return { previous };
    },
    onError: (_err, _plotId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.farmPlots(farmId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons(farmId) });
      // Contagens de talhão na carteira do produtor / cards de fazenda.
      queryClient.invalidateQueries({ queryKey: ["producer-farms"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}
