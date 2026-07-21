"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConsultantActivity,
  getConsultantSummary,
  getShareableProducers,
  getTeam,
  grantMemberProducer,
  removeConsultant,
  revokeMemberProducer,
} from "@recomenda/api/consultants";

const teamKey = ["consultants"] as const;
const shareableProducersKey = ["consultants-shareable-producers"] as const;
const memberProducersKey = (userId: string) => ["consultant-producers", userId] as const;
const consultantSummaryKey = (userId: string) => ["consultant-summary", userId] as const;
const consultantActivityKey = (userId: string) => ["consultant-activity", userId] as const;

export function useConsultants() {
  return useQuery({ queryKey: teamKey, queryFn: getTeam });
}

export function useShareableProducers(enabled = true) {
  return useQuery({
    queryKey: shareableProducersKey,
    queryFn: getShareableProducers,
    enabled,
  });
}

export function useConsultantSummary(userId: string, enabled = true) {
  return useQuery({
    queryKey: consultantSummaryKey(userId),
    queryFn: () => getConsultantSummary(userId),
    enabled: Boolean(userId) && enabled,
  });
}

export function useConsultantActivity(userId: string, enabled = true) {
  return useQuery({
    queryKey: consultantActivityKey(userId),
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
      queryClient.invalidateQueries({ queryKey: teamKey });
      queryClient.invalidateQueries({ queryKey: memberProducersKey(userId) });
      queryClient.invalidateQueries({ queryKey: consultantSummaryKey(userId) });
      queryClient.invalidateQueries({ queryKey: shareableProducersKey });
    },
  });
}

export function useRemoveConsultant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeConsultant(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKey }),
  });
}
