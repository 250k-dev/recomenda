import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CurrencyState {
  fxRate: string;
  setFxRate: (v: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      fxRate: "",
      setFxRate: (fxRate) => set({ fxRate }),
    }),
    { name: "recomenda-currency" }
  )
);
