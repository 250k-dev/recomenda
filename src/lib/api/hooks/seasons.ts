"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSeasons,
  getSeason,
  createSeason,
  archiveSeason,
  hardDeleteSeason,
  publishSeason,
  getArchivedSeasons,
  getSeasonShoppingList,
  getTimeline,
  getPlotHistory,
  createRecommendation,
  reorderRecommendations,
  patchRecommendation,
  applyRecommendation,
  skipRecommendation,
  undoRecommendation,
  createRecommendationItem,
  updateRecommendationItem,
  deleteRecommendationItem,
} from "@/lib/api/seasons";
import { queryKeys } from "./queryKeys";

export function useSeasons() {
  return useQuery({ queryKey: queryKeys.seasons, queryFn: getSeasons });
}

export function useArchivedSeasons() {
  return useQuery({ queryKey: queryKeys.seasonsArchived, queryFn: getArchivedSeasons });
}

export function useSeason(id: string) {
  return useQuery({
    queryKey: queryKeys.season(id),
    queryFn: () => getSeason(id),
    enabled: Boolean(id),
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
    },
  });
}

export function useArchiveSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonsArchived });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "farm-seasons",
      });
    },
  });
}

export function useHardDeleteSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hardDeleteSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonsArchived });
    },
  });
}

export function usePublishSeason(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (initialStock?: Array<{ local_product_id: string; quantity: number }>) =>
      publishSeason(seasonId, initialStock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.season(seasonId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useSeasonTimeline(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonTimeline(seasonId),
    queryFn: () => getTimeline(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useSeasonShoppingList(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonShoppingList(seasonId),
    queryFn: () => getSeasonShoppingList(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useCreateRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      predicted_date_current?: string | null;
      trigger_type?: string;
      notes?: string | null;
    }) => createRecommendation(seasonId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useReorderRecommendations(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recommendationIdsInOrder: string[]) =>
      reorderRecommendations(seasonId, recommendationIdsInOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function usePatchRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Parameters<typeof patchRecommendation>[1] & { id: string }) =>
      patchRecommendation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useApplyRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, executed_date, notes }: { id: string; executed_date: string; notes?: string }) =>
      applyRecommendation(id, { executed_date, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useSkipRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      skipRecommendation(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useUndoRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => undoRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useCreateRecommendationItem(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRecommendationItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useUpdateRecommendationItem(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; dose_per_hectare?: number; dose_unit?: string }) =>
      updateRecommendationItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useDeleteRecommendationItem(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRecommendationItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function usePlotHistory(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.plotHistory(seasonId),
    queryFn: () => getPlotHistory(seasonId),
    enabled: Boolean(seasonId),
  });
}
