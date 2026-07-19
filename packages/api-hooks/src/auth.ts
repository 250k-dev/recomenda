"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  getPlanQuota,
  impersonateProducer,
  exitImpersonation,
} from "@recomenda/api/auth";
import { useImpersonationStore } from "./impersonation-store";
import { queryKeys } from "./queryKeys";

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { name?: string; email?: string; phone?: string }) =>
      updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { oldPassword: string; newPassword: string }) =>
      changePassword(data.oldPassword, data.newPassword),
  });
}

export function usePlanQuota(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.quota,
    queryFn: getPlanQuota,
    enabled: options?.enabled !== false,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (result) => {
      window.location.assign(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
    },
  });
}

export function useImpersonateProducer() {
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((state) => state.startImpersonation);

  return useMutation({
    mutationFn: (producerId: string) => impersonateProducer(producerId),
    onSuccess: (_result, producerId) => {
      startImpersonation({ producerId, producerName: "Produtor" });
      queryClient.invalidateQueries();
    },
  });
}

export function useExitImpersonation() {
  const queryClient = useQueryClient();
  const clearImpersonation = useImpersonationStore((state) => state.clearImpersonation);

  return useMutation({
    mutationFn: exitImpersonation,
    onSuccess: () => {
      clearImpersonation();
      queryClient.invalidateQueries();
    },
  });
}
