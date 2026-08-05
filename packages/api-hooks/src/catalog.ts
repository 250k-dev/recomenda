"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLocalCatalog,
  getInactiveLocalCatalog,
  getGlobalCatalog,
  getPlatformCatalog,
  getAdminPlatformActiveCatalog,
  getAdminDeactivatedCatalog,
  createLocalProduct,
  updateLocalProduct,
  deleteLocalProduct,
  resolveCustomLink,
  promoteCustomToGlobal,
  cloneGlobalProduct,
  clonePeerLocalProduct,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  importGlobalCatalogFile,
} from "@recomenda/api/catalog";
import { queryKeys } from "./queryKeys";
import { useWalletScopeKey } from "./use-active-scope";

export function useLocalCatalog() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.localCatalog, scopeKey],
    queryFn: getLocalCatalog,
  });
}

export function useInactiveLocalCatalog() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.inactiveLocalCatalog, scopeKey],
    queryFn: getInactiveLocalCatalog,
  });
}

export function useGlobalCatalog() {
  return useQuery({ queryKey: queryKeys.globalCatalog, queryFn: getGlobalCatalog });
}

export function usePlatformCatalog() {
  const scopeKey = useWalletScopeKey();
  return useQuery({
    queryKey: [...queryKeys.platformCatalog, scopeKey],
    queryFn: getPlatformCatalog,
  });
}

export function useAdminPlatformActiveCatalog() {
  return useQuery({ queryKey: queryKeys.adminPlatformActive, queryFn: getAdminPlatformActiveCatalog });
}

export function useAdminDeactivatedCatalog() {
  return useQuery({ queryKey: queryKeys.adminDeactivatedCatalog, queryFn: getAdminDeactivatedCatalog });
}

export function useCreateLocalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLocalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.localCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
    },
  });
}

export function useUpdateLocalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      category?: string;
      dose_unit?: string;
      price_brl?: string;
      price_usd?: string;
      label_url?: string;
      is_active?: boolean;
      global_product_id?: string | null;
      equivalence_group?: string | null;
    }) => updateLocalProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.localCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.inactiveLocalCatalog });
      // Preço entra no valor do estoque do produtor.
      queryClient.invalidateQueries({ queryKey: ["producer-stock"] });
    },
  });
}

/** Invalida os caches afetados quando um customizado vira/aponta para global. */
function invalidateCatalogAfterResolve(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
  queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
  queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
  queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
  queryClient.invalidateQueries({ queryKey: queryKeys.localCatalog });
  queryClient.invalidateQueries({ queryKey: queryKeys.allLocalProducts });
}

export function useResolveCustomLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, globalProductId }: { id: string; globalProductId: string }) =>
      resolveCustomLink(id, globalProductId),
    onSuccess: () => invalidateCatalogAfterResolve(queryClient),
  });
}

export function usePromoteCustomToGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof promoteCustomToGlobal>[1];
    }) => promoteCustomToGlobal(id, payload),
    onSuccess: () => invalidateCatalogAfterResolve(queryClient),
  });
}

export function useCloneGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cloneGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.localCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
    },
  });
}

export function useClonePeerLocalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clonePeerLocalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.localCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
    },
  });
}

export function useDeleteLocalProductAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLocalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.allLocalProducts });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInactiveLocalProducts });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
    },
  });
}

export function useCreateGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
    },
  });
}

export function useDeleteGlobalProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGlobalProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
    },
  });
}

export function useImportGlobalCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importGlobalCatalogFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlatformActive });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDeactivatedCatalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformCatalog });
    },
  });
}
