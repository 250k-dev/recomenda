"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getSeasons,
  getSeason,
  archiveSeason,
  hardDeleteSeason,
  publishSeason,
  getArchivedSeasons,
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
} from "@recomenda/api/seasons";
import { queryKeys } from "./queryKeys";

/** Lista de compra espelha produtos "fora da programação" no servidor — invalida
 *  o cache da lista para a UI atualizar sem F5 (prefix match do React Query). */
function invalidatePurchaseListsAfterRecommendationChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["cycle-purchase-list"] });
  void queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
  void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
  void queryClient.invalidateQueries({ queryKey: ["cycle-cost-plan"] });
  void queryClient.invalidateQueries({ queryKey: ["season-cost-plan"] });
}

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
      invalidatePurchaseListsAfterRecommendationChange(queryClient);
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
      invalidatePurchaseListsAfterRecommendationChange(queryClient);
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
