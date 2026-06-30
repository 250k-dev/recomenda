import { api } from "@/lib/http/axios";

export interface CommoditiesQuote {
  /** Dólar (R$ por US$) — PTAX venda do BCB. */
  usd_brl: number | null;
  /** Soja em R$/saca 60 kg (Indicador CEPEA/ESALQ). */
  soja_brl_saca: number | null;
  /** Milho em R$/saca 60 kg (Indicador CEPEA/ESALQ). */
  milho_brl_saca: number | null;
  fetched_at: string;
}

/** Cotações do dia (dólar + saca de soja/milho) para o cabeçalho da programação. */
export async function getCommodities() {
  const { data } = await api.get<CommoditiesQuote>("/market/commodities");
  return data;
}
