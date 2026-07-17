"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConsultantActivity,
  getConsultantSummary,
  getMemberProducers,
  getShareableProducers,
  getTeam,
  grantMemberProducer,
  removeConsultant,
  revokeMemberProducer,
} from "@/lib/api/consultants";

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

export function useMemberProducers(userId: string, enabled = true) {
  return useQuery({
    queryKey: memberProducersKey(userId),
    queryFn: () => getMemberProducers(userId),
    enabled: Boolean(userId) && enabled,
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

export function useMemberProducerActions(userId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: teamKey });
    queryClient.invalidateQueries({ queryKey: memberProducersKey(userId) });
    queryClient.invalidateQueries({ queryKey: consultantSummaryKey(userId) });
    queryClient.invalidateQueries({ queryKey: shareableProducersKey });
  };
  const grant = useMutation({
    mutationFn: (producerId: string) => grantMemberProducer(userId, producerId),
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: (producerId: string) => revokeMemberProducer(userId, producerId),
    onSuccess: invalidate,
  });
  return { grant, revoke };
}

export function useRemoveConsultant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeConsultant(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKey }),
  });
}
