import { api } from "./http/axios";
import type { PaginatedResponse } from "./types";

export interface Product {
  id: string;
  name: string;
  category?: string;
  dose_unit?: string;
  price_brl?: string;
  label_url?: string;
}

export interface GlobalProduct extends Product {
  category: string;
  dose_unit: string;
  default_label_url?: string | null;
  equivalence_group?: string | null;
  is_active?: boolean;
}

export type PlatformCatalogEntry = {
  entry_type: "GLOBAL" | "OWN_CUSTOM" | "PEER_CUSTOM";
  local_product_id: string | null;
  global_product_id: string | null;
  peer_local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  equivalence_group?: string | null;
  label_url?: string | null;
  price_brl?: string | null;
  owner_name?: string | null;
  /** Empresa titular do registro no MAPA (AGROFIT). Nulo em adjuvante,
   *  fertilizante, foliar e semente — não têm registro de agrotóxico. */
  manufacturer?: string | null;
  /** Número do registro no MAPA. */
  mapa_registration?: string | null;
  can_edit: boolean;
  can_deactivate: boolean;
  can_clone_to_my_catalog: boolean;
};

export type AdminPlatformActiveEntry = {
  entry_type: "GLOBAL" | "CUSTOM";
  global_product_id: string | null;
  local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  label_url?: string | null;
  price_brl?: string | null;
  equivalence_group?: string | null;
  default_label_url?: string | null;
  is_active?: boolean;
  owner_agronomist_id?: string | null;
  owner_name?: string | null;
  linked_global_name?: string | null;
};

export type AdminDeactivatedCatalogEntry = {
  entry_type: "GLOBAL_INACTIVE" | "CUSTOM_INACTIVE";
  global_product_id: string | null;
  local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  label_url?: string | null;
  price_brl?: string | null;
  agronomist_name?: string | null;
};

export type GlobalCatalogImportResult = {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export async function getLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/local");
  return data;
}

export async function getInactiveLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/local/inactive");
  return data;
}

export async function getAllInactiveLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product & { agronomist_name?: string }>>("/catalog/local/inactive/all");
  return data;
}

export async function getAllLocalProducts() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/admin/local-all");
  return data;
}

export async function createLocalProduct(payload: {
  name: string;
  category?: string;
  dose_unit?: string;
  label_url?: string;
  equivalence_group?: string | null;
}) {
  const { data } = await api.post<Product>("/catalog/local", payload);
  return data;
}

export async function updateLocalProduct(
  id: string,
  payload: {
    name?: string;
    category?: string;
    dose_unit?: string;
    price_brl?: string;
    price_usd?: string;
    label_url?: string;
    is_active?: boolean;
    global_product_id?: string | null;
    equivalence_group?: string | null;
  },
) {
  const { data } = await api.patch<Product>(`/catalog/local/${id}`, payload);
  return data;
}

export async function deleteLocalProduct(id: string) {
  await api.delete(`/catalog/local/${encodeURIComponent(id)}`);
}

/** Vincular: o customizado deixa de existir e tudo passa a apontar para o global. */
export async function resolveCustomLink(id: string, globalProductId: string) {
  const { data } = await api.post<Product>(
    `/catalog/local/${encodeURIComponent(id)}/resolve-link`,
    { global_product_id: globalProductId },
  );
  return data;
}

/** Cadastrar produto: cria o global a partir do customizado (editável) e o promove. */
export async function promoteCustomToGlobal(
  id: string,
  payload: {
    name: string;
    category: string;
    dose_unit: string;
    default_label_url?: string | null;
    equivalence_group?: string | null;
  },
) {
  const { data } = await api.post<{ global: GlobalProduct; local: Product }>(
    `/catalog/local/${encodeURIComponent(id)}/promote-global`,
    payload,
  );
  return data;
}

export async function cloneGlobalProduct(globalId: string) {
  const { data } = await api.post<Product>(`/catalog/local/from-global/${globalId}`);
  return data;
}

export async function clonePeerLocalProduct(sourceLocalId: string) {
  const { data } = await api.post<Product>(`/catalog/local/from-peer/${encodeURIComponent(sourceLocalId)}`);
  return data;
}

export async function getGlobalCatalog(): Promise<PaginatedResponse<GlobalProduct>> {
  const { data } = await api.get<GlobalProduct[] | PaginatedResponse<GlobalProduct>>("/catalog/global");
  if (Array.isArray(data)) {
    return {
      data,
      pagination: {
        page: 1,
        page_size: data.length,
        total: data.length,
        total_pages: 1,
      },
    };
  }
  return data;
}

export async function createGlobalProduct(payload: {
  name: string;
  category: string;
  dose_unit: string;
  default_label_url?: string | null;
  equivalence_group?: string | null;
  is_active?: boolean;
}) {
  const { data } = await api.post<GlobalProduct>("/catalog/global", payload);
  return data;
}

export async function updateGlobalProduct(
  id: string,
  payload: Partial<{
    name: string;
    category: string;
    dose_unit: string;
    default_label_url: string | null;
    equivalence_group: string | null;
    is_active: boolean;
  }>,
) {
  const { data } = await api.patch<GlobalProduct>(`/catalog/global/${id}`, payload);
  return data;
}

export async function deleteGlobalProduct(id: string) {
  await api.delete(`/catalog/global/${id}`);
}

export async function importGlobalCatalogFile(file: File): Promise<GlobalCatalogImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<GlobalCatalogImportResult>("/catalog/admin/global/import", formData);
  return data;
}

export async function getPlatformCatalog() {
  const { data } = await api.get<{ data: PlatformCatalogEntry[] }>("/catalog/platform");
  return data;
}

export async function getAdminPlatformActiveCatalog() {
  const { data } = await api.get<{ data: AdminPlatformActiveEntry[] }>("/catalog/admin/platform-active");
  return data;
}

export async function getAdminDeactivatedCatalog() {
  const { data } = await api.get<{ data: AdminDeactivatedCatalogEntry[] }>("/catalog/admin/deactivated");
  return data;
}
