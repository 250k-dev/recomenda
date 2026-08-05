"use client";

import { useMemo } from "react";
import {
  useCyclePurchaseList,
  usePurchaseListProgress,
} from "@recomenda/api-hooks";

/**
 * Gate de UI: só libera publicar quando a lista do ciclo está 100% comprada
 * (ou quando não há lista / nada a comprar).
 */
export function usePublishSeasonGuard(cycleId?: string | null) {
  const listQuery = useCyclePurchaseList(cycleId ?? "");
  const listId = listQuery.data?.id ?? "";
  const progressQuery = usePurchaseListProgress(listId, Boolean(listId));

  return useMemo(() => {
    if (!cycleId) {
      return {
        canPublish: true,
        isLoading: false,
        reason: null as string | null,
        percent: 100,
        listId: null as string | null,
      };
    }
    if (listQuery.isLoading || (listId && progressQuery.isLoading)) {
      return {
        canPublish: false,
        isLoading: true,
        reason: null as string | null,
        percent: 0,
        listId: listId || null,
      };
    }
    if (!listQuery.data) {
      return {
        canPublish: true,
        isLoading: false,
        reason: null as string | null,
        percent: 100,
        listId: null as string | null,
      };
    }
    const progress = progressQuery.data;
    if (!progress) {
      return {
        canPublish: false,
        isLoading: true,
        reason: null as string | null,
        percent: 0,
        listId,
      };
    }
    if (!progress.is_complete) {
      return {
        canPublish: false,
        isLoading: false,
        reason: `Compras da lista em ${progress.percent}% — confirme 100% das compras antes de publicar.`,
        percent: progress.percent,
        listId,
      };
    }
    return {
      canPublish: true,
      isLoading: false,
      reason: null as string | null,
      percent: progress.percent,
      listId,
    };
  }, [
    cycleId,
    listId,
    listQuery.data,
    listQuery.isLoading,
    progressQuery.data,
    progressQuery.isLoading,
  ]);
}
