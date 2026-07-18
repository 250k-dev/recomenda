"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateQuoteResponseInput,
  type UpdateQuoteResponseInput,
  createQuoteRequest,
  createQuoteResponse,
  deleteQuoteItem,
  deleteQuoteResponse,
  getPurchaseListQuoteTrash,
  getPurchaseListQuotes,
  getQuoteByToken,
  getQuoteResponse,
  restoreQuoteItem,
  restoreQuoteResponse,
  softDeleteQuoteItem,
  softDeleteQuoteResponse,
  updateQuoteResponse,
} from "@/lib/api/quotes";
import { queryKeys } from "./queryKeys";

// --- Agrônomo -----------------------------------------------------------------

export function useCreateQuoteRequest(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createQuoteRequest(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListQuotes(listId) });
    },
  });
}

export function usePurchaseListQuotes(listId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchaseListQuotes(listId),
    queryFn: () => getPurchaseListQuotes(listId),
    enabled: Boolean(listId) && enabled,
  });
}

export function usePurchaseListQuoteTrash(listId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchaseListQuoteTrash(listId),
    queryFn: () => getPurchaseListQuoteTrash(listId),
    enabled: Boolean(listId) && enabled,
  });
}

/** Mutations da lixeira de cotações — todas revalidam comparação + lixeira. */
export function useQuoteTrashActions(listId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListQuotes(listId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseListQuoteTrash(listId) });
  };

  const softDeleteResponse = useMutation({
    mutationFn: (responseId: string) => softDeleteQuoteResponse(listId, responseId),
    onSuccess: invalidate,
  });
  const restoreResponse = useMutation({
    mutationFn: (responseId: string) => restoreQuoteResponse(listId, responseId),
    onSuccess: invalidate,
  });
  const deleteResponse = useMutation({
    mutationFn: (responseId: string) => deleteQuoteResponse(listId, responseId),
    onSuccess: invalidate,
  });
  const softDeleteItem = useMutation({
    mutationFn: (vars: { responseId: string; itemId: string }) =>
      softDeleteQuoteItem(listId, vars.responseId, vars.itemId),
    onSuccess: invalidate,
  });
  const restoreItem = useMutation({
    mutationFn: (vars: { responseId: string; itemId: string }) =>
      restoreQuoteItem(listId, vars.responseId, vars.itemId),
    onSuccess: invalidate,
  });
  const deleteItem = useMutation({
    mutationFn: (vars: { responseId: string; itemId: string }) =>
      deleteQuoteItem(listId, vars.responseId, vars.itemId),
    onSuccess: invalidate,
  });

  return {
    softDeleteResponse,
    restoreResponse,
    deleteResponse,
    softDeleteItem,
    restoreItem,
    deleteItem,
  };
}

// --- Público (lojista) --------------------------------------------------------

export function useQuoteByToken(token: string) {
  return useQuery({
    queryKey: queryKeys.quoteByToken(token),
    queryFn: () => getQuoteByToken(token),
    enabled: Boolean(token),
  });
}

export function useCreateQuoteResponse(token: string) {
  return useMutation({
    mutationFn: (payload: CreateQuoteResponseInput) => createQuoteResponse(token, payload),
  });
}

export function useQuoteResponse(responseToken: string) {
  return useQuery({
    queryKey: queryKeys.quoteResponse(responseToken),
    queryFn: () => getQuoteResponse(responseToken),
    enabled: Boolean(responseToken),
  });
}

export function useUpdateQuoteResponse(responseToken: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateQuoteResponseInput) =>
      updateQuoteResponse(responseToken, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quoteResponse(responseToken), data);
    },
  });
}
