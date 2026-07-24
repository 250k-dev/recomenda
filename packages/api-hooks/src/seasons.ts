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
  updateSeason,
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
import { useWalletScopeKey } from "./use-active-scope";

/** Lista de compra espelha produtos "fora da programação" no servidor — invalida
 *  o cache da lista para a UI atualizar sem F5 (prefix match do React Query). */
function invalidatePurchaseListsAfterRecommendationChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["cycle-purchase-list"] });
  void queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
  void queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
  void queryClient.invalidateQueries({ queryKey: ["cycle-cost-plan"] });
  void queryClient.invalidateQueries({ queryKey: ["season-cost-plan"] });
}

/**
 * Registrar / pular / reverter uma etapa mexe em muito mais que o status dela:
 * o servidor **debita (ou estorna) estoque**, **reagenda as etapas PENDENTES
 * seguintes** da safra e **cria notificação**. Sem tirar tudo isso do cache, a
 * tela só corrige com F5. Usado por apply/skip/undo e pelo registro em massa.
 */
export function invalidateAfterRecommendationExecution(
  queryClient: QueryClient,
  seasonId: string,
) {
  // Lista de etapas da safra — as seguintes podem ter sido reagendadas.
  void queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
  // Cronograma agregado: tela inicial e /cronograma (prefix = todos os produtores).
  void queryClient.invalidateQueries({ queryKey: ["agronomist-agenda"] });
  // "Histórico do talhão" mostra o status (Aplicado / Pulada) da etapa.
  void queryClient.invalidateQueries({ queryKey: queryKeys.plotHistory(seasonId) });
  // Aplicar debita estoque; reverter estorna (prefix = todos os produtores).
  void queryClient.invalidateQueries({ queryKey: ["producer-stock"] });
  // O servidor grava uma notificação para o agrônomo.
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
}

export function useSeasons() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.seasons, scopeKey],
    queryFn: getSeasons,
  });
}

export function useArchivedSeasons() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.seasonsArchived, scopeKey],
    queryFn: getArchivedSeasons,
  });
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

/** Altera âncoras da safra (ex.: planting_date). O servidor recalcula as
 *  predicted_date das etapas PENDING — invalida season + timeline + agenda. */
export function useUpdateSeason(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      planting_date?: string | null;
      desiccation_date?: string | null;
    }) => updateSeason(seasonId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.season(seasonId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
      void queryClient.invalidateQueries({ queryKey: ["agronomist-agenda"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.plotHistory(seasonId) });
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
      invalidateAfterRecommendationExecution(queryClient, seasonId);
    },
  });
}

export function useSkipRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      skipRecommendation(id, notes),
    onSuccess: () => {
      invalidateAfterRecommendationExecution(queryClient, seasonId);
    },
  });
}

export function useUndoRecommendation(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => undoRecommendation(id),
    onSuccess: () => {
      invalidateAfterRecommendationExecution(queryClient, seasonId);
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
