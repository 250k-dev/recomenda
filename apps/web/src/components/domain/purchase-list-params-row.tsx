"use client";

import { useEffect, useRef } from "react";
import { DollarSign, PaperBag, RulerDimensionLine } from "lucide-react";
import { Input } from "@recomenda/ui/primitives/input";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";
import {
  listItemsToBuyByKey,
  DEFAULT_SPACING_M,
  type ListItem,
} from "@recomenda/domain/purchase-list/list-item";
import { useCurrencyStore, DEFAULT_GRAIN_PRICE_BRL } from "@/stores/currency";
import { useLiveFxRate } from "@/hooks/use-live-fx-rate";
import { fmt } from "@/components/domain/season/_shared";

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

/**
 * Parâmetros da lista de compra — cotação do dólar, preço da saca e
 * espaçamento — com os totais a comprar. Os três são globais (store de moeda) e
 * alimentam as contas da tabela de itens.
 *
 * `variant="plain"` tira a moldura de cartão, para a linha entrar dentro de
 * outro cartão (o herói da lista de compra).
 */
export function PurchaseListParamsRow({
  items,
  totalHa,
  readOnly = false,
  variant = "card",
  className,
}: {
  items: ListItem[];
  totalHa: number;
  readOnly?: boolean;
  variant?: "card" | "plain";
  className?: string;
}) {
  const canViewPrices = useCan("PRICE_VIEW");
  const {
    fxRate,
    setFxRate,
    grainPrice,
    setGrainPrice,
    spacing: spacingStr,
    setSpacing,
  } = useCurrencyStore();
  const fx = Number(fxRate) || 0;
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;
  const spacing = Number(spacingStr) || DEFAULT_SPACING_M;

  // Item 4: traz a cotação real do dólar como valor padrão a cada abertura da
  // lista, mas sem sobrescrever uma edição manual feita nesta tela.
  const liveFx = useLiveFxRate();
  const fxDefaultedRef = useRef(false);
  const fxUserEditedRef = useRef(false);
  useEffect(() => {
    if (readOnly || fxUserEditedRef.current || fxDefaultedRef.current) return;
    if (liveFx.rate != null) {
      fxDefaultedRef.current = true;
      setFxRate(String(liveFx.rate));
    }
  }, [liveFx.rate, readOnly, setFxRate]);

  const toBuyByKey = listItemsToBuyByKey(items, totalHa);
  const totals = items.reduce(
    (acc, it) => {
      const toBuy = toBuyByKey.get(it.key) ?? 0;
      const unitBrl = it.priceUsd && fx > 0 ? Number(it.priceUsd) * fx : Number(it.price || 0);
      const unitUsd = it.priceUsd
        ? Number(it.priceUsd)
        : it.price && fx > 0
          ? Number(it.price) / fx
          : 0;
      acc.brl += toBuy * unitBrl;
      acc.usd += toBuy * unitUsd;
      return acc;
    },
    { brl: 0, usd: 0 },
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        variant === "card"
          ? "rounded-xl border bg-card px-4 py-3 shadow-sm"
          : "mt-4 border-t pt-4",
        className,
      )}
    >
      {canViewPrices ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <DollarSign className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cotação do dólar
            </span>
            <span className="text-[11px] text-muted-foreground">
              converte produtos cotados em US$ para R$
            </span>
          </div>
          {readOnly ? (
            <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
              {fx > 0 ? fmtBrl(fx) : "—"}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className="text-sm text-muted-foreground">US$ 1 =</span>
              <MoneyInput
                placeholder="5,50"
                value={fxRate}
                onValueChange={(v) => {
                  fxUserEditedRef.current = true;
                  setFxRate(v);
                }}
                className="h-8 w-24"
              />
            </div>
          )}
        </div>
      ) : null}
      {canViewPrices ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <PaperBag className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Preço da saca
            </span>
            <span className="text-[11px] text-muted-foreground">
              converte o custo em sacas
            </span>
          </div>
          {readOnly ? (
            <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
              {fmtBrl(saca)}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <MoneyInput
                placeholder="110,00"
                value={grainPrice}
                onValueChange={(v) => setGrainPrice(v)}
                className="h-8 w-24"
              />
            </div>
          )}
        </div>
      ) : null}
      {/* Espaçamento entre linhas (m) — parâmetro único; deriva a população da semente. */}
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
          <RulerDimensionLine className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Espaçamento
          </span>
          <span className="text-[11px] text-muted-foreground">
            deriva a população da semente
          </span>
        </div>
        {readOnly ? (
          <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
            {fmt(spacing)} m
          </span>
        ) : (
          <div className="ml-2 flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              placeholder="0,65"
              value={spacingStr}
              onChange={(e) => setSpacing(e.target.value)}
              className="h-8 w-20"
            />
            <span className="text-sm text-muted-foreground">m</span>
          </div>
        )}
      </div>
      {canViewPrices ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total R$
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {fmtBrl(totals.brl)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total US$
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {totals.usd > 0 ? fmtUsd(totals.usd) : "—"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
