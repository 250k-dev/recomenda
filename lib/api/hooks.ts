"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvitation,
  archiveSeason,
  changePassword,
  createAdminAgronomist,
  createAdminPlan,
  createFarm,
  createGlobalProduct,
  createInvitation,
  createLocalProduct,
  createMixTemplate,
  createMixTemplateItem,
  createPlot,
  createSeason,
  createTimingStage,
  createTimingTemplate,
  cloneGlobalProduct,
  deleteGlobalProduct,
  deleteAdminAgronomist,
  deleteAdminProducer,
  deleteMixTemplate,
  deleteMixTemplateItem,
  deletePlot,
  deleteTimingStage,
  deleteTimingTemplate,
  exitImpersonation,
  getAdminAgronomists,
  getAdminProducers,
  getComparativeReport,
  getFarm,
  getFarmAccess,
  getFarmPlots,
  getFarms,
  getGlobalCatalog,
  getInvitationByToken,
  getLocalCatalog,
  getMe,
  getMixTemplate,
  getMixTemplates,
  getNotifications,
  getPlans,
  getPlanQuota,
  patchAdminProducer,
  getProducer,
  getProducerFarms,
  getProducerStock,
  getProducers,
  getSeason,
  getSeasons,
  getSeasonShoppingList,
  getTimeline,
  getTimingTemplate,
  getTimingTemplates,
  getArchivedMixTemplates,
  getArchivedSeasons,
  getArchivedTimingTemplates,
  grantFarmAccess,
  hardDeleteMixTemplate,
  hardDeleteSeason,
  hardDeleteTimingTemplate,
  impersonateProducer,
  login,
  MixTemplateItem,
  publishSeason,
  removeFarmAccess,
  reorderTimingStages,
  revokeFarmAccess,
  TimingStage,
  updateAdminAgronomist,
  updateAdminPlan,
  updateFarm,
  updateGlobalProduct,
  updateLocalProduct,
  updateMixTemplate,
  updateMixTemplateItem,
  updateProducer,
  updateProfile,
  updateTimingStage,
  updateTimingTemplate,
} from "@/lib/api/client";
import { setAccessToken, setUserRole } from "@/lib/auth/token-store";
import { useImpersonationStore } from "@/stores/impersonation";

export const queryKeys = {
  timingTemplatesArchived: ["timing-templates-archived"],
  mixTemplatesArchived: ["mix-templates-archived"],
  seasonsArchived: ["seasons-archived"],
  me: ["me"],
  quota: ["quota"],
  farms: ["farms"],
  farmPlots: (farmId: string) => ["farm-plots", farmId],
  farmAccess: (farmId: string) => ["farm-access", farmId],
  producers: ["producers"],
  localCatalog: ["local-catalog"],
  globalCatalog: ["global-catalog"],
  seasons: ["seasons"],
  season: (id: string) => ["season", id],
  seasonTimeline: (seasonId: string) => ["season-timeline", seasonId],
  seasonShoppingList: (seasonId: string) => ["season-shopping-list", seasonId],
  notifications: ["notifications"],
  timingTemplates: ["timing-templates"],
  timingTemplate: (id: string) => ["timing-template", id],
  mixTemplates: ["mix-templates"],
  mixTemplate: (id: string) => ["mix-template", id],
  plans: ["plans"],
  adminAgronomists: (status: "active" | "inactive") => ["admin-agronomists", status] as const,
  adminProducers: ["admin-producers"],
  producerStock: (producerId: string) => ["producer-stock", producerId],
  producer: (id: string) => ["producer", id],
};

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

export function useArchivedSeasons() {
  return useQuery({ queryKey: queryKeys.seasonsArchived, queryFn: getArchivedSeasons });
}

export function useArchiveSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonsArchived });
    },
  });
}

export function useHardDeleteSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hardDeleteSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonsArchived });
    },
  });
}

export function useSeason(id: string) {
  return useQuery({
    queryKey: queryKeys.season(id),
    queryFn: () => getSeason(id),
    enabled: Boolean(id),
  });
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

export function usePublishSeason(seasonId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (initialStock?: Array<{ local_product_id: string; quantity: number }>) =>
      publishSeason(seasonId, initialStock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.season(seasonId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonTimeline(seasonId) });
    },
  });
}

export function useTimingTemplates() {
  return useQuery({
    queryKey: queryKeys.timingTemplates,
    queryFn: getTimingTemplates,
  });
}

export function useTimingTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.timingTemplate(id),
    queryFn: () => getTimingTemplate(id),
    enabled: Boolean(id),
  });
}

export function useCreateTimingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTimingTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates });
    },
  });
}

export function useUpdateTimingTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateTimingTemplate>[1]) =>
      updateTimingTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates });
    },
  });
}

export function useDeleteTimingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTimingTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplates });
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplatesArchived });
    },
  });
}

export function useArchivedTimingTemplates() {
  return useQuery({
    queryKey: queryKeys.timingTemplatesArchived,
    queryFn: getArchivedTimingTemplates,
  });
}

export function useHardDeleteTimingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hardDeleteTimingTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplatesArchived });
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
  return useQuery({
    queryKey: queryKeys.mixTemplatesArchived,
    queryFn: getArchivedMixTemplates,
  });
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
    mutationFn: (payload: { local_product_id: string; dose_per_hectare: number }) =>
      createMixTemplateItem(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(templateId) });
    },
  });
}

export function useUpdateMixTemplateItem(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Pick<MixTemplateItem, "id"> & { dose_per_hectare: number }) =>
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

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: getPlans });
}

export function useAdminAgronomists(status: "active" | "inactive" = "active") {
  return useQuery({
    queryKey: queryKeys.adminAgronomists(status),
    queryFn: () => getAdminAgronomists({ status }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agronomists"] });
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
  return useQuery({
    queryKey: queryKeys.adminProducers,
    queryFn: getAdminProducers,
  });
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
        price_brl_monthly: number | string;
        is_active: boolean;
      }>;
    }) => updateAdminPlan(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans });
    },
  });
}

export function useCreateGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
    },
  });
}

export function useUpdateGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      payload: Parameters<typeof updateGlobalProduct>[1];
    }) => updateGlobalProduct(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
    },
  });
}

export function useDeleteGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
    },
  });
}

export function useInvitationByToken(token: string) {
  return useQuery({
    queryKey: ["invitation-token", token],
    queryFn: () => getInvitationByToken(token),
    enabled: Boolean(token),
  });
}

export function useAcceptInvitation(token: string) {
  return useMutation({
    mutationFn: (payload: { name: string; password: string }) => acceptInvitation(token, payload),
  });
}

export function useFarmPlots(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmPlots(farmId),
    queryFn: () => getFarmPlots(farmId),
    enabled: Boolean(farmId),
  });
}

export function useCreatePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; area_hectares: number }) => createPlot(farmId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
    },
  });
}

export function useDeletePlot(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPlots(farmId) });
    },
  });
}

export function useFarmAccess(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmAccess(farmId),
    queryFn: () => getFarmAccess(farmId),
    enabled: Boolean(farmId),
  });
}

export function useGrantFarmAccess(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (producerId: string) => grantFarmAccess(farmId, producerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmAccess(farmId) });
    },
  });
}

export function useRevokeFarmAccess(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (producerId: string) => revokeFarmAccess(farmId, producerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmAccess(farmId) });
    },
  });
}

export function useFarm(id: string) {
  return useQuery({
    queryKey: ["farm", id],
    queryFn: () => getFarm(id),
    enabled: Boolean(id),
  });
}

export function useUpdateFarm(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; location?: string }) => updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm", id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
    },
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
    },
  });
}

export function useSeasonShoppingList(seasonId: string) {
  return useQuery({
    queryKey: queryKeys.seasonShoppingList(seasonId),
    queryFn: () => getSeasonShoppingList(seasonId),
    enabled: Boolean(seasonId),
  });
}

export function useProducerStock(producerId: string) {
  return useQuery({
    queryKey: queryKeys.producerStock(producerId),
    queryFn: () => getProducerStock(producerId),
    enabled: Boolean(producerId),
  });
}

export function useProducer(id: string) {
  return useQuery({
    queryKey: queryKeys.producer(id),
    queryFn: () => getProducer(id),
    enabled: Boolean(id),
  });
}

export function useProducerFarms(producerId: string) {
  return useQuery({
    queryKey: ["producer-farms", producerId],
    queryFn: () => getProducerFarms(producerId),
    enabled: Boolean(producerId),
  });
}

export function useUpdateProducer(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string }) => updateProducer(producerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producer(producerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useRemoveFarmAccess(producerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (farmId: string) => removeFarmAccess(producerId, farmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producer-farms", producerId] });
    },
  });
}

export function useComparativeReport() {
  return useQuery({ queryKey: ["comparative-report"], queryFn: getComparativeReport });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.producers });
    },
  });
}

export function useCreateLocalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLocalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-catalog"] });
    },
  });
}

export function useCloneGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cloneGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-catalog"] });
    },
  });
}

export function useUpdateLocalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; category?: string; dose_unit?: string; price_brl?: string; label_url?: string }) =>
      updateLocalProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-catalog"] });
    },
  });
}
