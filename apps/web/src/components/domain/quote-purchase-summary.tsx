"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

export function QuotePurchaseSummary({
  selectedCount,
  totalBrl,
  hint,
  disabled,
  loading,
  onConfirm,
  className,
}: {
  selectedCount: number;
  totalBrl: number;
  hint?: string | null;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "sticky top-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Resumo da compra
      </h3>
      <p className="m-0 text-sm text-text-strong">
        {selectedCount === 0
          ? "0 itens selecionados"
          : `${selectedCount} item${selectedCount === 1 ? "" : "s"} selecionado${selectedCount === 1 ? "" : "s"}`}
      </p>
      {hint ? (
        <p className="m-0 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-display text-xl font-semibold tabular-nums text-text-strong">
          {fmtBrl(totalBrl)}
        </span>
      </div>
      <Button
        type="button"
        className="h-11 w-full gap-2"
        disabled={disabled || selectedCount === 0 || loading}
        onClick={onConfirm}
      >
        <ShoppingCart className="size-4" />
        {loading
          ? "Confirmando…"
          : `Confirmar compra (${selectedCount})`}
      </Button>
    </aside>
  );
}
