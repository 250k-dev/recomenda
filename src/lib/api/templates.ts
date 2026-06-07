import { api } from "@/lib/http/axios";

export interface TimingStage {
  id: string;
  timing_template_id: string;
  order_index: number;
  name: string;
  trigger_type: string;
  window_start_days: number;
  window_end_days: number;
  default_mix_template_id?: string | null;
  notes?: string | null;
}

export interface TimingTemplate {
  id: string;
  name: string;
  crop: string;
  producer_id?: string | null;
  is_archived: boolean;
  stages?: TimingStage[];
}

export interface MixTemplateItem {
  id: string;
  mix_template_id: string;
  local_product_id: string;
  dose_per_hectare: number;
  product_name?: string;
  dose_unit?: string;
}

export interface MixTemplate {
  id: string;
  name: string;
  crop: string;
  is_archived: boolean;
  items?: MixTemplateItem[];
}

export async function getTimingTemplates(producerId: string) {
  const { data } = await api.get<TimingTemplate[]>("/timing_templates", {
    params: { producer_id: producerId },
  });
  return data;
}

export async function getTimingTemplate(id: string) {
  const { data } = await api.get<TimingTemplate & { stages: TimingStage[] }>(
    `/timing_templates/${id}`,
  );
  return data;
}

export async function createTimingTemplate(payload: {
  name: string;
  crop: string;
  producer_id: string;
}) {
  const { data } = await api.post<TimingTemplate>("/timing_templates", payload);
  return data;
}

export async function updateTimingTemplate(id: string, payload: Partial<TimingTemplate>) {
  const { data } = await api.patch<TimingTemplate>(`/timing_templates/${id}`, payload);
  return data;
}

export async function deleteTimingTemplate(id: string) {
  await api.delete(`/timing_templates/${id}`);
}

export async function getArchivedTimingTemplates(producerId: string) {
  const { data } = await api.get<TimingTemplate[] | { data: TimingTemplate[] } | null>(
    "/timing_templates/archived",
    { params: { producer_id: producerId } },
  );
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.data)) return data.data;
  return [];
}

export async function hardDeleteTimingTemplate(id: string) {
  await api.delete(`/timing_templates/${id}/hard`);
}

export async function createTimingStage(
  templateId: string,
  payload: Omit<TimingStage, "id" | "timing_template_id">,
) {
  const { data } = await api.post<TimingStage>(`/timing_templates/${templateId}/stages`, payload);
  return data;
}

export async function updateTimingStage(id: string, payload: Partial<TimingStage>) {
  const { data } = await api.patch<TimingStage>(`/timing_stages/${id}`, payload);
  return data;
}

export async function deleteTimingStage(id: string) {
  await api.delete(`/timing_stages/${id}`);
}

export async function reorderTimingStages(templateId: string, stageIdsInOrder: string[]) {
  await api.post(`/timing_templates/${templateId}/stages/reorder`, {
    stage_ids_in_order: stageIdsInOrder,
  });
}

export async function getMixTemplates() {
  const { data } = await api.get<MixTemplate[]>("/mix_templates");
  return data;
}

export async function getMixTemplate(id: string) {
  const { data } = await api.get<MixTemplate & { items: MixTemplateItem[] }>(
    `/mix_templates/${id}`,
  );
  return data;
}

export async function createMixTemplate(payload: { name: string; crop: string }) {
  const { data } = await api.post<MixTemplate>("/mix_templates", payload);
  return data;
}

export async function updateMixTemplate(id: string, payload: Partial<MixTemplate>) {
  const { data } = await api.patch<MixTemplate>(`/mix_templates/${id}`, payload);
  return data;
}

export async function deleteMixTemplate(id: string) {
  await api.delete(`/mix_templates/${id}`);
}

export async function getArchivedMixTemplates() {
  const { data } = await api.get<MixTemplate[] | { data: MixTemplate[] } | null>("/mix_templates/archived");
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.data)) return data.data;
  return [];
}

export async function hardDeleteMixTemplate(id: string) {
  await api.delete(`/mix_templates/${id}/hard`);
}

export async function createMixTemplateItem(
  templateId: string,
  payload: { local_product_id: string; dose_per_hectare: number; dose_unit?: string },
) {
  const { data } = await api.post<MixTemplateItem>(`/mix_templates/${templateId}/items`, payload);
  return data;
}

export async function updateMixTemplateItem(
  id: string,
  payload: { dose_per_hectare?: number; dose_unit?: string },
) {
  const { data } = await api.patch<MixTemplateItem>(`/mix_template_items/${id}`, payload);
  return data;
}

export async function deleteMixTemplateItem(id: string) {
  await api.delete(`/mix_template_items/${id}`);
}
