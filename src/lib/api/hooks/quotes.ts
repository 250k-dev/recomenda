"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateQuoteResponseInput,
  type UpdateQuoteResponseInput,
  createQuoteRequest,
  createQuoteResponse,
  getPurchaseListQuotes,
  getQuoteByToken,
  getQuoteResponse,
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
