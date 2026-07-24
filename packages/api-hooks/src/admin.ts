"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminAgronomists,
  getAdminAgronomistDetail,
  createAdminAgronomist,
  updateAdminAgronomist,
  deleteAdminAgronomist,
  getAdminProducers,
  patchAdminProducer,
  deleteAdminProducer,
  getAdminTeamMembers,
  promoteAdminTeamMember,
  getPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
} from "@recomenda/api/admin";
import { queryKeys } from "./queryKeys";

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: getPlans });
}

export function useCreateAdminPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans });
    },
  });
}

export function useUpdateAdminPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      payload: Partial<{
        name: string;
        plot_quota: number;
        timing_template_quota: number;
        price_brl_monthly: number | string;
        is_active: boolean;
      }>;
    }) => updateAdminPlan(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans });
    },
  });
}

export function useDeleteAdminPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans });
    },
  });
}

export function useAdminAgronomists(status: "active" | "inactive" = "active") {
  return useQuery({
    queryKey: queryKeys.adminAgronomists(status),
    queryFn: () => getAdminAgronomists({ status }),
  });
}

export function useAdminAgronomistDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.adminAgronomistDetail(id),
    queryFn: () => getAdminAgronomistDetail(id),
    enabled: Boolean(id),
  });
}

export function useCreateAdminAgronomist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminAgronomist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agronomists"] });
    },
  });
}

export function useUpdateAdminAgronomist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      plan_id?: string;
      plan_started_at?: string;
      user?: { name?: string; email?: string; password?: string; is_active?: boolean };
    }) => {
      const { id, ...body } = vars;
      return updateAdminAgronomist(id, body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agronomists"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAgronomistDetail(variables.id) });
    },
  });
}

export function useDeleteAdminAgronomist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminAgronomist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agronomists"] });
    },
  });
}

export function useAdminProducers() {
  return useQuery({ queryKey: queryKeys.adminProducers, queryFn: getAdminProducers });
}

export function usePatchAdminProducer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) => patchAdminProducer(vars.id, { is_active: vars.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProducers });
    },
  });
}

export function useDeleteAdminProducer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminProducer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProducers });
    },
  });
}

export function useAdminTeamMembers(filters?: { agronomist_id?: string; temporary?: boolean }) {
  return useQuery({
    queryKey: queryKeys.adminTeamMembers(filters),
    queryFn: () => getAdminTeamMembers(filters),
  });
}

export function usePromoteAdminTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; planId: string }) =>
      promoteAdminTeamMember(vars.userId, vars.planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-team-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agronomists"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agronomist-detail"] });
    },
  });
}
