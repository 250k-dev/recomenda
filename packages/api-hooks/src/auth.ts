"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getPlanQuota,
  impersonateProducer,
  exitImpersonation,
  getMemberships,
  switchContext,
  exitContext,
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

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      resetPassword(data.token, data.password),
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

/** Carteiras de outros agrônomos onde o usuário atua (Minhas Gestões). */
export function useMemberships() {
  return useQuery({ queryKey: queryKeys.memberships, queryFn: getMemberships });
}

/**
 * Entra na carteira de outro agrônomo. Recarrega a app no dashboard para o
 * contexto ficar 100% naquela carteira (sem resíduos da conta própria).
 */
export function useSwitchContext() {
  return useMutation({
    mutationFn: (agronomistId: string) => switchContext(agronomistId),
    onSuccess: () => {
      window.location.assign("/dashboard");
    },
  });
}

/** Volta para a carteira própria com reload limpo no dashboard. */
export function useExitContext() {
  return useMutation({
    mutationFn: exitContext,
    onSuccess: () => {
      window.location.assign("/dashboard");
    },
  });
}
