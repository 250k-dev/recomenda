"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFarms,
  getFarm,
  createFarm,
  updateFarm,
  getFarmPlots,
  getFarmSeasons,
  getFarmAccess,
  grantFarmAccess,
  revokeFarmAccess,
  createPlot,
  deletePlot,
} from "@/lib/api/farms";
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

export function useGrantFarmAccess(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (producerId: string) => grantFarmAccess(farmId, producerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmAccess(farmId) });
    },
  });
}

export function useRevokeFarmAccess(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (producerId: string) => revokeFarmAccess(farmId, producerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmAccess(farmId) });
    },
  });
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

export function useDeletePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
    },
  });
}
