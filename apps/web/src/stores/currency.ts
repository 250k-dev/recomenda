import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Preço da saca (R$) usado como padrão quando o usuário não informa um valor. */
export const DEFAULT_GRAIN_PRICE_BRL = 110;

/** Espaçamento entre linhas (m) padrão — usado para derivar a população. */
export const DEFAULT_SPACING_M = 0.65;

interface CurrencyState {
  fxRate: string;
  /** true depois da primeira edição manual da cotação — a API ao vivo não sobrescreve. */
  fxRateUserEdited: boolean;
  setFxRate: (v: string) => void;
  setFxRateFromUser: (v: string) => void;
  /** Preço da saca (R$) — converte custo em sacas na lista de compra. */
  grainPrice: string;
  setGrainPrice: (v: string) => void;
  /** Safra com mais de uma cultura: preço da saca das demais (cultura → R$). */
  grainPrices: Record<string, string>;
  setGrainPrices: (v: Record<string, string>) => void;
  /** Espaçamento entre linhas (m) — deriva a população das sementes. */
  spacing: string;
  setSpacing: (v: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      fxRate: "",
      fxRateUserEdited: false,
      setFxRate: (fxRate) => set({ fxRate }),
      setFxRateFromUser: (fxRate) => set({ fxRate, fxRateUserEdited: true }),
      grainPrice: "",
      setGrainPrice: (grainPrice) => set({ grainPrice }),
      grainPrices: {},
      setGrainPrices: (grainPrices) => set({ grainPrices }),
      spacing: "",
      setSpacing: (spacing) => set({ spacing }),
    }),
    { name: "recomenda-currency" }
  )
);

/** Preços extras da store → números (> 0) para o servidor e para as contas. */
export function grainPricesToNumbers(extras: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [crop, raw] of Object.entries(extras)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) out[crop] = n;
  }
  return out;
}

/** `grain_prices_brl` da lista → campos extras (sem a cultura principal). */
export function grainPricesFromList(
  prices: Record<string, number> | null | undefined,
  mainCrop: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [crop, value] of Object.entries(prices ?? {})) {
    if (crop === mainCrop || !(Number(value) > 0)) continue;
    out[crop] = String(value);
  }
  return out;
}

/** Payload `grain_prices_brl`: a principal + as demais culturas da safra. */
export function grainPricesPayload(
  mainCrop: string | null | undefined,
  mainPrice: number,
  extras: Record<string, string>,
): Record<string, number> {
  const out = grainPricesToNumbers(extras);
  if (mainCrop && mainCrop !== "ANY" && mainPrice > 0) out[mainCrop] = mainPrice;
  return out;
}
