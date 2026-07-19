import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Preço da saca (R$) usado como padrão quando o usuário não informa um valor. */
export const DEFAULT_GRAIN_PRICE_BRL = 110;

/** Espaçamento entre linhas (m) padrão — usado para derivar a população. */
export const DEFAULT_SPACING_M = 0.65;

interface CurrencyState {
  fxRate: string;
  setFxRate: (v: string) => void;
  /** Preço da saca (R$) — converte custo em sacas na lista de compra. */
  grainPrice: string;
  setGrainPrice: (v: string) => void;
  /** Espaçamento entre linhas (m) — deriva a população das sementes. */
  spacing: string;
  setSpacing: (v: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      fxRate: "",
      setFxRate: (fxRate) => set({ fxRate }),
      grainPrice: "",
      setGrainPrice: (grainPrice) => set({ grainPrice }),
      spacing: "",
      setSpacing: (spacing) => set({ spacing }),
    }),
    { name: "recomenda-currency" }
  )
);
