"use client";

import type { Route } from "next";
import Link from "next/link";
import { Eye, Store } from "lucide-react";
import { Card } from "@recomenda/ui/primitives/card";
import { Button } from "@recomenda/ui/primitives/button";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { ShareQuoteSheet } from "@/components/domain/share-quote-sheet";
import { FulfillWithoutQuoteButton } from "@/components/domain/fulfill-without-quote-dialog";
import type { PurchaseListDetail } from "@recomenda/api";
import { useCurrencyStore, DEFAULT_GRAIN_PRICE_BRL } from "@/stores/currency";
import { useCan } from "@recomenda/api-hooks/use-can";
import {
  applyManualTotalSpent,
  computePurchaseListMetrics,
  detailItemToListItem,
  usesManualListTotal,
} from "@recomenda/domain/purchase-list/breakdown";
import { cn } from "@recomenda/utils";

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function computeMetrics(
  list: PurchaseListDetail | null,
  fx: number,
  saca: number,
) {
  if (!list) {
    return {
      totalProductsValue: 0,
      totalSeedsValue: 0,
      totalValue: 0,
      seedVolume: 0,
      seedSacksPerHa: 0,
      totalSacks: 0,
      costSacksPerHa: 0,
      productsCount: 0,
      categoriesCount: 0,
      pricedCount: 0,
      categoryBreakdown: [],
    };
  }
  const items = (list.items ?? []).map(detailItemToListItem);
  const base = computePurchaseListMetrics(items, list.total_hectares ?? 0, fx, saca);
  return applyManualTotalSpent(
    base,
    list.manual_total_spent_brl,
    saca,
    list.total_hectares ?? 0,
  );
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
  costPlanHref?: Route | null;
}) {
  const canViewPrices = useCan("PRICE_VIEW");
  const canQuoteCrud = useCan("QUOTE_CRUD");
  const fxRate = useCurrencyStore((state) => state.fxRate);
  const grainPrice = useCurrencyStore((state) => state.grainPrice);
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

  const fx = Number(fxRate) || 0;
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;
  const metrics = computeMetrics(list, fx, saca);
  const listLabel = list?.name ?? "—";
  const productsTotal = metrics.productsCount || 0;
  const manualTotalLabel = usesManualListTotal(
    metrics,
    list?.manual_total_spent_brl,
  );
  const hasPendingBuy = (list?.items ?? []).some(
    (it) => (it.quantity_to_buy ?? 0) > 1e-9,
  );
  const showPriceHint = canViewPrices && metrics.totalValue <= 0;

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <div className="border-b border-border bg-rail px-[18px] py-[15px]">
        <h4 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Lista de compra · {listLabel}
        </h4>
      </div>

      <div className="px-[18px] pb-4 pt-1.5">
        {canViewPrices ? (
          <SummaryRow
            label={manualTotalLabel ? "Total gasto (informado)" : "Valor total"}
            value={metrics.totalValue > 0 ? fmtBrl(metrics.totalValue) : "—"}
            largeValue
          />
        ) : null}
        {canViewPrices ? (
          <SummaryRow
            label="Volume de sacas"
            value={metrics.totalSacks > 0 ? `${fmtQty(metrics.totalSacks)} sc` : "—"}
          />
        ) : null}
        {canViewPrices ? (
          <SummaryRow
            label="Custo (sc/ha)"
            value={
              metrics.costSacksPerHa > 0
                ? `${fmtQty(metrics.costSacksPerHa)} sc/ha`
                : "—"
            }
          />
        ) : null}
        <SummaryRow label="Produtos" value={String(productsTotal)} />

        {showPriceHint ? (
          <div className="my-3 rounded-[10px] border border-warning-border bg-warning-soft px-[13px] py-[11px] text-[13px] font-medium leading-snug text-warning-strong">
            Informe preços, gere uma cotação ou registre sem cotação. Sem valor, o
            custo por hectare não é calculado.
          </div>
        ) : null}

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

          {canQuoteCrud && list ? (
            <FulfillWithoutQuoteButton
              listId={list.id}
              pending={hasPendingBuy}
              size="default"
              className={actionBtnClass}
            />
          ) : null}

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
