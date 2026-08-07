"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConsultantActivity,
  getConsultantSummary,
  getShareableProducers,
  getTeam,
  getTeamOverview,
  getWalletActivity,
  grantMemberProducer,
  removeConsultant,
  revokeMemberProducer,
  type WalletActivityQuery,
} from "@recomenda/api/consultants";
import { useWalletScopeKey } from "./use-active-scope";

const teamKey = (scope: string) => ["consultants", scope] as const;
const overviewKey = (scope: string) => ["consultants-overview", scope] as const;
const shareableProducersKey = (scope: string) =>
  ["consultants-shareable-producers", scope] as const;
const memberProducersKey = (userId: string, scope: string) =>
  ["consultant-producers", userId, scope] as const;
const consultantSummaryKey = (userId: string, scope: string) =>
  ["consultant-summary", userId, scope] as const;
const consultantActivityKey = (userId: string, scope: string) =>
  ["consultant-activity", userId, scope] as const;
const walletActivityKey = (scope: string, params: WalletActivityQuery) =>
  ["consultants-wallet-activity", scope, params] as const;

export function useConsultants() {
  const scopeKey = useWalletScopeKey();
  return useQuery({ queryKey: teamKey(scopeKey), queryFn: getTeam });
}

export function useTeamOverview(enabled = true) {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: overviewKey(scopeKey),
    queryFn: getTeamOverview,
    enabled,
  });
}

export function useWalletActivity(params: WalletActivityQuery = {}, enabled = true) {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: walletActivityKey(scopeKey, params),
    queryFn: () => getWalletActivity(params),
    enabled,
  });
}

export function useShareableProducers(enabled = true) {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: shareableProducersKey(scopeKey),
    queryFn: getShareableProducers,
    enabled,
  });
}

export function useConsultantSummary(userId: string, enabled = true) {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: consultantSummaryKey(userId, scopeKey),
    queryFn: () => getConsultantSummary(userId),
    enabled: Boolean(userId) && enabled,
  });
}

export function useConsultantActivity(userId: string, enabled = true) {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: consultantActivityKey(userId, scopeKey),
    queryFn: () => getConsultantActivity(userId),
    enabled: Boolean(userId) && enabled,
  });
}

/**
 * Aplica de uma vez as inclusões e exclusões escolhidas na tela. Existe para o
 * botão de confirmar: um clique por produtor disparava uma chamada e quatro
 * invalidações de cache cada, e o acesso ia sendo liberado enquanto a pessoa
 * ainda estava decidindo.
 */
export function useSetMemberProducers(userId: string) {
  const queryClient = useQueryClient();
  const scopeKey = useWalletScopeKey();
  return useMutation({
    mutationFn: async ({ add, remove }: { add: string[]; remove: string[] }) => {
      for (const producerId of add) {
        await grantMemberProducer(userId, producerId);
      }
      for (const producerId of remove) {
        await revokeMemberProducer(userId, producerId);
      }
      return { added: add.length, removed: remove.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultants"] });
      queryClient.invalidateQueries({ queryKey: ["consultants-overview"] });
      queryClient.invalidateQueries({ queryKey: memberProducersKey(userId, scopeKey) });
      queryClient.invalidateQueries({ queryKey: consultantSummaryKey(userId, scopeKey) });
      queryClient.invalidateQueries({ queryKey: ["consultants-shareable-producers"] });
    },
  });
}

export function useRemoveConsultant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeConsultant(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultants"] });
      queryClient.invalidateQueries({ queryKey: ["consultants-overview"] });
    },
  });
}
