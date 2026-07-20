"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type TimingStage,
  getTimingTemplates,
  getTimingTemplate,
  createTimingTemplate,
  updateTimingTemplate,
  deleteTimingTemplate,
  hardDeleteTimingTemplate,
  getArchivedTimingTemplates,
  createTimingStage,
  deleteTimingStage,
  reorderTimingStages,
} from "@recomenda/api/templates";
import { queryKeys } from "./queryKeys";

export function useTimingTemplates(producerId: string) {
  return useQuery({
    queryKey: queryKeys.timingTemplates(producerId),
    queryFn: () => getTimingTemplates(producerId),
    enabled: Boolean(producerId),
  });
}

export function useTimingTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.timingTemplate(id),
    queryFn: () => getTimingTemplate(id),
    enabled: Boolean(id),
  });
}

export function useCreateTimingTemplate(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; crop: string }) =>
      createTimingTemplate({ ...payload, producer_id: producerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates(producerId) });
    },
  });
}

export function useUpdateTimingTemplate(id: string, producerId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateTimingTemplate>[1]) =>
      updateTimingTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(id) });
      if (producerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates(producerId) });
      }
    },
  });
}

export function useDeleteTimingTemplate(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTimingTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplatesArchived(producerId) });
    },
  });
}

export function useArchivedTimingTemplates(producerId: string) {
  return useQuery({
    queryKey: queryKeys.timingTemplatesArchived(producerId),
    queryFn: () => getArchivedTimingTemplates(producerId),
    enabled: Boolean(producerId),
  });
}

export function useHardDeleteTimingTemplate(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hardDeleteTimingTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplatesArchived(producerId) });
    },
  });
}

export function useCreateTimingStage(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<TimingStage, "id" | "timing_template_id">) =>
      createTimingStage(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(templateId) });
    },
  });
}

export function useDeleteTimingStage(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTimingStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(templateId) });
    },
  });
}

export function useReorderTimingStages(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageIdsInOrder: string[]) => reorderTimingStages(templateId, stageIdsInOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(templateId) });
    },
  });
}

