"use client";

import Link from "next/link";
import { Eye, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareQuoteSheet } from "@/components/domain/share-quote-sheet";
import type { PurchaseListDetail } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function computeMetrics(list: PurchaseListDetail | null) {
  if (!list) {
    return { totalValue: 0, productsCount: 0, pricedCount: 0 };
  }
  const items = list.items ?? [];
  const totalValue = items.reduce((sum, item) => {
    const price = item.price_brl_fixed ?? 0;
    return sum + item.quantity_to_buy * price;
  }, 0);
  return {
    totalValue,
    productsCount: items.length,
    pricedCount: items.filter((item) => item.price_brl_fixed).length,
  };
}

function SummaryRow({
  label,
  value,
  largeValue = false,
}: {
  label: string;
  value: string;
  largeValue?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-border py-[9px]">
      <span className="text-[13.5px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums text-text-strong",
          largeValue
            ? "font-display text-[22px] leading-none tracking-[-0.02em]"
            : "text-[15px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const actionBtnClass =
  "h-[42px] w-full gap-2 rounded-[11px] text-sm font-semibold";

export function FarmPurchaseListSummaryPanel({
  list,
  isLoading,
  producerName,
  onOpenFull,
  costPlanHref,
}: {
  list: PurchaseListDetail | null;
  isLoading: boolean;
  producerName?: string | null;
  onOpenFull: () => void;
  costPlanHref?: string | null;
}) {
  if (isLoading) {
    return (
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <div className="border-b border-border bg-rail px-[18px] py-[15px]">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-3 px-[18px] py-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[42px] w-full" />
          <Skeleton className="h-[42px] w-full" />
        </div>
      </Card>
    );
  }

  const metrics = computeMetrics(list);
  const listLabel = list?.name ?? "—";
  const productsTotal = metrics.productsCount || 0;

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <div className="border-b border-border bg-rail px-[18px] py-[15px]">
        <h4 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Lista de compra · {listLabel}
        </h4>
      </div>

      <div className="px-[18px] pb-4 pt-1.5">
        <SummaryRow
          label="Valor total"
          value={metrics.totalValue > 0 ? fmtBrl(metrics.totalValue) : "—"}
          largeValue
        />
        <SummaryRow label="Produtos" value={String(productsTotal)} />
        <SummaryRow
          label="Itens com preço"
          value={`${metrics.pricedCount}/${productsTotal}`}
        />

        <div className="my-3 rounded-[10px] border border-warning-border bg-warning-soft px-[13px] py-[11px] text-[13px] font-medium leading-snug text-warning-strong">
          Informe preços ou gere uma cotação para calcular o custo por hectare.
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="clay"
            className={actionBtnClass}
            onClick={onOpenFull}
          >
            <Store className="size-4" />
            Cotações das lojas
          </Button>

          {list ? (
            <ShareQuoteSheet
              listId={list.id}
              listName={list.name}
              producerName={producerName}
              triggerClassName={cn(
                actionBtnClass,
                "border-border-strong bg-surface text-text-strong hover:bg-hover",
              )}
            />
          ) : (
            <Button
              variant="outline"
              className={cn(actionBtnClass, "border-border-strong bg-surface")}
              disabled
            >
              Compartilhar cotação
            </Button>
          )}

          {costPlanHref ? (
            <Button
              asChild
              variant="ghost"
              className={cn(
                actionBtnClass,
                "border border-transparent text-text-strong hover:bg-hover/60",
              )}
            >
              <Link href={costPlanHref}>
                <Eye className="size-4" />
                Ver plano de custo
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              className={cn(
                actionBtnClass,
                "border border-transparent text-muted-foreground",
              )}
              disabled
            >
              <Eye className="size-4" />
              Ver plano de custo
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
