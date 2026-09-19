"use client";

import { useEffect, useRef, useState } from "react";
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
  inverted = false,
  className,
}: {
  items: ListItem[];
  totalHa: number;
  readOnly?: boolean;
  variant?: "card" | "plain";
  /** Sobre o verde do herói: texto e ícones claros. */
  inverted?: boolean;
  className?: string;
}) {
  const canViewPrices = useCan("PRICE_VIEW");
  const chipClass = inverted
    ? "bg-white/15 text-white"
    : "bg-primary-soft text-primary-strong";
  const labelClass = inverted
    ? "text-primary-foreground/80"
    : "text-muted-foreground";
  const hintClass = inverted
    ? "text-primary-foreground/70"
    : "text-muted-foreground";
  const valueClass = inverted ? "text-primary-foreground" : "text-foreground";
  const {
    fxRate,
    setFxRate,
    setFxRateFromUser,
    fxRateUserEdited,
    grainPrice,
    setGrainPrice,
    spacing: spacingStr,
    setSpacing,
  } = useCurrencyStore();
  const fx = Number(fxRate) || 0;
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;
  const spacing = Number(spacingStr) || DEFAULT_SPACING_M;

  // Cotação ao vivo só entra como padrão enquanto o usuário nunca editou o
  // campo (flag persistida). Depois da primeira digitação, o valor dele fica.
  const liveFx = useLiveFxRate();
  const fxDefaultedRef = useRef(false);
  const [storeHydrated, setStoreHydrated] = useState(
    () => useCurrencyStore.persist.hasHydrated(),
  );
  useEffect(() => {
    const unsub = useCurrencyStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
    if (useCurrencyStore.persist.hasHydrated()) setStoreHydrated(true);
    return unsub;
  }, []);
  useEffect(() => {
    if (
      !storeHydrated ||
      readOnly ||
      fxRateUserEdited ||
      fxDefaultedRef.current
    ) {
      return;
    }
    if (liveFx.rate != null) {
      fxDefaultedRef.current = true;
      setFxRate(String(liveFx.rate));
    }
  }, [storeHydrated, liveFx.rate, readOnly, fxRateUserEdited, setFxRate]);

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
          : cn("mt-4 border-t pt-4", inverted && "border-white/20"),
        className,
      )}
    >
      {canViewPrices ? (
        <div className="flex items-center gap-2">
          <span className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              chipClass,
            )}>
            <DollarSign className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", labelClass)}>
              Cotação do dólar
            </span>
            <span className={cn("text-[11px]", hintClass)}>
              converte produtos cotados em US$ para R$
            </span>
          </div>
          {readOnly ? (
            <span className={cn("ml-2 self-end text-sm font-semibold tabular-nums", valueClass)}>
              {fx > 0 ? fmtBrl(fx) : "—"}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className={cn("text-sm", hintClass)}>US$ 1 =</span>
              <MoneyInput
                placeholder="5,50"
                value={fxRate}
                onValueChange={setFxRateFromUser}
                className="h-8 w-24"
              />
            </div>
          )}
        </div>
      ) : null}
      {canViewPrices ? (
        <div className="flex items-center gap-2">
          <span className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              chipClass,
            )}>
            <PaperBag className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", labelClass)}>
              Preço da saca
            </span>
            <span className={cn("text-[11px]", hintClass)}>
              converte o custo em sacas
            </span>
          </div>
          {readOnly ? (
            <span className={cn("ml-2 self-end text-sm font-semibold tabular-nums", valueClass)}>
              {fmtBrl(saca)}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className={cn("text-sm", hintClass)}>R$</span>
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
        <span className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              chipClass,
            )}>
          <RulerDimensionLine className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wide", labelClass)}>
            Espaçamento
          </span>
          <span className={cn("text-[11px]", hintClass)}>
            deriva a população da semente
          </span>
        </div>
        {readOnly ? (
          <span className={cn("ml-2 self-end text-sm font-semibold tabular-nums", valueClass)}>
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
            <span className={cn("text-sm", hintClass)}>m</span>
          </div>
        )}
      </div>
      {canViewPrices ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end">
            <span className={cn("text-[10px] uppercase tracking-wide", labelClass)}>
              Total R$
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", valueClass)}>
              {fmtBrl(totals.brl)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className={cn("text-[10px] uppercase tracking-wide", labelClass)}>
              Total US$
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", hintClass)}>
              {totals.usd > 0 ? fmtUsd(totals.usd) : "—"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
