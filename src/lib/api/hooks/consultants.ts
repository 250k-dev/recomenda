"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConsultantActivity,
  getConsultantFarms,
  getConsultants,
  getConsultantSummary,
  grantConsultantFarm,
  removeConsultant,
  revokeConsultantFarm,
} from "@/lib/api/consultants";

const consultantsKey = ["consultants"] as const;
const consultantFarmsKey = (userId: string) => ["consultant-farms", userId] as const;
const consultantSummaryKey = (userId: string) =>
  ["consultant-summary", userId] as const;
const consultantActivityKey = (userId: string) =>
  ["consultant-activity", userId] as const;

export function useConsultants() {
  return useQuery({ queryKey: consultantsKey, queryFn: getConsultants });
}

export function useConsultantFarms(userId: string, enabled = true) {
  return useQuery({
    queryKey: consultantFarmsKey(userId),
    queryFn: () => getConsultantFarms(userId),
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

export function useConsultantFarmActions(userId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: consultantsKey });
    queryClient.invalidateQueries({ queryKey: consultantFarmsKey(userId) });
    queryClient.invalidateQueries({ queryKey: consultantSummaryKey(userId) });
  };
  const grant = useMutation({
    mutationFn: (farmId: string) => grantConsultantFarm(userId, farmId),
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: (farmId: string) => revokeConsultantFarm(userId, farmId),
    onSuccess: invalidate,
  });
  return { grant, revoke };
}

export function useRemoveConsultant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeConsultant(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultantsKey }),
  });
}
