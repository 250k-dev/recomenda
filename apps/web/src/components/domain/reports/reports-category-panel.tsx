"use client";

import { RailCard } from "@/components/domain/rail-card";
import type { ReportCategoryBreakdown } from "@recomenda/api/reports";
import {
  categoryBarClass,
  categoryToken,
  type GlobalProductCategory,
  PRODUCT_CATEGORY_LABELS,
} from "@recomenda/utils";

function categoryLabel(category: string): string {
  return (
    PRODUCT_CATEGORY_LABELS[category as GlobalProductCategory] ??
    category.replace(/_/g, " ").toLowerCase()
  );
}

function categoryBarColor(category: string): string {
  return categoryBarClass[categoryToken(categoryLabel(category))];
}

export function ReportsCategoryPanel({
  breakdown,
}: {
  breakdown: ReportCategoryBreakdown[];
}) {
  return (
    <RailCard title="Custo por categoria" bodyClassName="px-4.5 py-4">
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem dados de custo por categoria nas safras colhidas.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {breakdown.map((item) => (
            <div key={item.category}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-text-strong">
                  {categoryLabel(item.category)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.share_pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${categoryBarColor(item.category)}`}
                  style={{ width: `${item.share_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </RailCard>
  );
}
