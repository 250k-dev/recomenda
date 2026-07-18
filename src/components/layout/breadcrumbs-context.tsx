"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/domain/breadcrumb-back";

// Contextos separados: o setter é estável (páginas publicam sem re-renderizar
// em loop) e os items só interessam ao header.
const ItemsContext = createContext<BreadcrumbItem[] | null>(null);
const SetterContext = createContext<
  ((items: BreadcrumbItem[]) => void) | null
>(null);

/** Envolve o shell para que páginas publiquem breadcrumbs no header. */
export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  return (
    <SetterContext.Provider value={setItems}>
      <ItemsContext.Provider value={items}>{children}</ItemsContext.Provider>
    </SetterContext.Provider>
  );
}

/** Items publicados pela página atual ([] fora do provider ou sem trilha). */
export function useBreadcrumbItems(): BreadcrumbItem[] {
  return useContext(ItemsContext) ?? [];
}

/** null fora do provider — sinal para BreadcrumbBack renderizar inline. */
export function useBreadcrumbSetter() {
  return useContext(SetterContext);
}
