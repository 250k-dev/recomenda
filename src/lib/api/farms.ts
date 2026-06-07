import { api } from "@/lib/http/axios";
import type { PaginatedResponse } from "@/lib/api/types";

export interface Farm {
  id: string;
  name: string;
  location?: string;
}

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  area_hectares: number;
}

export interface FarmAccess {
  producer_id: string;
  farm_id: string;
  granted_at: string;
}

export interface FarmSeason {
  id: string;
  farm_id: string;
  plot_id: string;
  plot_name: string;
  plot_area_hectares: number | null;
  crop: string;
  variety?: string | null;
  status: string;
  planting_date?: string | null;
  cycle_days?: number | null;
}

export async function getFarms() {
  const { data } = await api.get<PaginatedResponse<Farm>>("/farms");
  return data;
}

export async function getFarm(id: string) {
  const { data } = await api.get<Farm>(`/farms/${id}`);
  return data;
}

export async function createFarm(payload: { name: string; location?: string; agronomist_id?: string }) {
  const { data } = await api.post<Farm>("/farms", payload);
  return data;
}

export async function updateFarm(id: string, payload: { name?: string; location?: string }) {
  const { data } = await api.patch<Farm>(`/farms/${id}`, payload);
  return data;
}

export async function getFarmPlots(farmId: string) {
  const { data } = await api.get<Plot[]>(`/farms/${farmId}/plots`);
  return data;
}

export async function createPlot(farmId: string, payload: { name: string; area_hectares: number }) {
  const { data } = await api.post<Plot>(`/farms/${farmId}/plots`, payload);
  return data;
}

export async function updatePlot(
  id: string,
  payload: { name?: string; area_hectares?: number },
) {
  const { data } = await api.patch<Plot>(`/plots/${id}`, payload);
  return data;
}

export async function deletePlot(id: string) {
  await api.delete(`/plots/${id}`);
}

export async function getFarmSeasons(farmId: string) {
  const { data } = await api.get<{ data: FarmSeason[] } | FarmSeason[]>(`/farms/${farmId}/seasons`);
  return Array.isArray(data) ? data : data.data;
}

export async function getFarmAccess(farmId: string) {
  const { data } = await api.get<FarmAccess[]>(`/farms/${farmId}/access`);
  return data;
}

export async function grantFarmAccess(farmId: string, producerId: string) {
  const { data } = await api.post<FarmAccess>(`/farms/${farmId}/access`, { producer_id: producerId });
  return data;
}

export async function revokeFarmAccess(farmId: string, producerId: string) {
  await api.delete(`/farms/${farmId}/access/${producerId}`);
}
