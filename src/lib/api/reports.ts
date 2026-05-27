import { api } from "@/lib/http/axios";

export interface ReportSummary {
  total_seasons: number;
  harvested_seasons: number;
  in_progress_seasons: number;
  compliance_rate_pct: number | null;
}

export interface ReportPerSeason {
  season_id: string;
  crop: string;
  variety?: string;
  plot_area_ha: number;
  cost_per_ha_brl: number;
  bags_per_ha: number | null;
  sale_price_per_bag_brl: number | null;
}

export interface ComparativeReport {
  summary: ReportSummary;
  per_season: ReportPerSeason[];
}

export async function getComparativeReport() {
  const { data } = await api.get<ComparativeReport>("/agronomists/me/reports");
  return data;
}
