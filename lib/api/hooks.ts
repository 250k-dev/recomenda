"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSeason,
  exitImpersonation,
  getFarms,
  getGlobalCatalog,
  getLocalCatalog,
  getMe,
  getNotifications,
  getPlanQuota,
  getProducers,
  getSeasons,
  getTimeline,
  impersonateProducer,
  login,
} from "@/lib/api/client";
import { setAccessToken } from "@/lib/auth/token-store";
import { useImpersonationStore } from "@/stores/impersonation";

export const queryKeys = {
  me: ["me"],
  quota: ["quota"],
  farms: ["farms"],
  producers: ["producers"],
  localCatalog: ["local-catalog"],
  globalCatalog: ["global-catalog"],
  seasons: ["seasons"],
  seasonTimeline: (seasonId: string) => ["season-timeline", seasonId],
  notifications: ["notifications"],
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe });
}

export function usePlanQuota() {
  return useQuery({ queryKey: queryKeys.quota, queryFn: getPlanQuota });
}

export function useFarms() {
  return useQuery({ queryKey: queryKeys.farms, queryFn: getFarms });
}

export function useProducers() {
  return useQuery({ queryKey: queryKeys.producers, queryFn: getProducers });
}

export function useLocalCatalog() {
  return useQuery({ queryKey: queryKeys.localCatalog, queryFn: getLocalCatalog });
}

export function useGlobalCatalog() {
  return useQuery({
    queryKey: queryKeys.globalCatalog,
    queryFn: getGlobalCatalog,
  });
}

export function useSeasons() {
  return useQuery({ queryKey: queryKeys.seasons, queryFn: getSeasons });
}

export function useSeasonTimeline(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonTimeline(seasonId),
    queryFn: () => getTimeline(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: getNotifications,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (result) => {
      setAccessToken(result.access_token);
      window.location.assign(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
    },
  });
}

export function useImpersonateProducer() {
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((state) => state.startImpersonation);

  return useMutation({
    mutationFn: (producerId: string) => impersonateProducer(producerId),
    onSuccess: (result, producerId) => {
      setAccessToken(result.access_token);
      startImpersonation({ producerId, producerName: "Produtor" });
      queryClient.invalidateQueries();
    },
  });
}

export function useExitImpersonation() {
  const queryClient = useQueryClient();
  const clearImpersonation = useImpersonationStore(
    (state) => state.clearImpersonation,
  );

  return useMutation({
    mutationFn: exitImpersonation,
    onSuccess: () => {
      clearImpersonation();
      queryClient.invalidateQueries();
    },
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
