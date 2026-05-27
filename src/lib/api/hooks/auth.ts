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
} from "@/lib/api/auth";
import { setAccessToken, setUserRole } from "@/lib/auth/token-store";
import { useImpersonationStore } from "@/stores/impersonation";
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
      if (result.user.role === "PRODUCER") {
        throw new Error("Produtores devem acessar o Recomenda App, não este painel.");
      }
      setAccessToken(result.access_token);
      setUserRole(result.user.role);
      window.location.assign(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("Produtores")) {
        throw error;
      }
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
      setUserRole("PRODUCER");
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
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      if (data.role) {
        setUserRole(data.role);
      }
      clearImpersonation();
      queryClient.invalidateQueries();
    },
  });
}
