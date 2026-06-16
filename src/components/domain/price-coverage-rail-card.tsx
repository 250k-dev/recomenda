"use client";

import { RailCard } from "@/components/domain/rail-card";
import { ProgressBar } from "@/components/ui/progress-bar";

type PriceCoverageRailCardProps = {
  completeLists: number;
  totalLists: number;
  pendingLists: number;
  pct: number;
  isLoading?: boolean;
};

export function PriceCoverageRailCard({
  completeLists,
  totalLists,
  pendingLists,
  pct,
  isLoading = false,
}: PriceCoverageRailCardProps) {
  const footer =
    totalLists === 0
      ? "Nenhuma lista de compra na carteira ainda."
      : pendingLists === 0
        ? "Todas as listas têm preço completo para calcular o custo por hectare."
        : pendingLists === 1
          ? "1 lista aguarda cotação das lojas para calcular o custo por hectare."
          : `${pendingLists} listas aguardam cotação das lojas para calcular o custo por hectare.`;

  return (
    <RailCard title="Cobertura de preços">
      {isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-10 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="h-2.5 animate-pulse rounded-full bg-surface-2" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Listas com preço completo
            </span>
            <span className="text-[0.95rem] font-semibold text-text-strong tabular-nums">
              {completeLists}/{totalLists}
            </span>
          </div>
          <ProgressBar value={pct} tone="primary" className="h-2.5" />
          <p className="mt-2.5 text-[12.5px] leading-snug text-muted-foreground">
            {footer}
          </p>
        </>
      )}
    </RailCard>
  );
}
