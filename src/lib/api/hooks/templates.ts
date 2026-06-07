"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type TimingStage,
  type MixTemplateItem,
  getTimingTemplates,
  getTimingTemplate,
  createTimingTemplate,
  updateTimingTemplate,
  deleteTimingTemplate,
  hardDeleteTimingTemplate,
  getArchivedTimingTemplates,
  createTimingStage,
  updateTimingStage,
  deleteTimingStage,
  reorderTimingStages,
  getMixTemplates,
  getMixTemplate,
  createMixTemplate,
  updateMixTemplate,
  deleteMixTemplate,
  hardDeleteMixTemplate,
  getArchivedMixTemplates,
  createMixTemplateItem,
  updateMixTemplateItem,
  deleteMixTemplateItem,
} from "@/lib/api/templates";
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

export function useUpdateTimingStage(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<TimingStage> & { id: string }) =>
      updateTimingStage(id, payload),
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

export function useMixTemplates() {
  return useQuery({ queryKey: queryKeys.mixTemplates, queryFn: getMixTemplates });
}

export function useMixTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.mixTemplate(id),
    queryFn: () => getMixTemplate(id),
    enabled: Boolean(id),
  });
}

export function useCreateMixTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMixTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplates });
    },
  });
}

export function useUpdateMixTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateMixTemplate>[1]) =>
      updateMixTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplates });
    },
  });
}

export function useDeleteMixTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMixTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplates });
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplatesArchived });
    },
  });
}

export function useArchivedMixTemplates() {
  return useQuery({ queryKey: queryKeys.mixTemplatesArchived, queryFn: getArchivedMixTemplates });
}

export function useHardDeleteMixTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hardDeleteMixTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplatesArchived });
    },
  });
}

export function useCreateMixTemplateItem(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { local_product_id: string; dose_per_hectare: number; dose_unit?: string }) =>
      createMixTemplateItem(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(templateId) });
    },
  });
}

export function useUpdateMixTemplateItem(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Pick<MixTemplateItem, "id"> & { dose_per_hectare?: number; dose_unit?: string }) =>
      updateMixTemplateItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(templateId) });
    },
  });
}

export function useDeleteMixTemplateItem(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMixTemplateItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(templateId) });
    },
  });
}
