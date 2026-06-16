"use client";

import { useMemo } from "react";
import { Store } from "lucide-react";
import { StatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { usePurchaseListQuotes } from "@/lib/api/hooks";
import type {
  QuoteAvailability,
  QuoteComparisonResponse,
} from "@/lib/api/quotes";

const fmtQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const AVAILABILITY_LABEL: Record<QuoteAvailability, string> = {
  AVAILABLE: "Tem",
  UNAVAILABLE: "Não tem",
  PARTIAL: "Parcial",
};

function statusBadge(r: QuoteComparisonResponse) {
  return r.status === "SUBMITTED" ? (
    <StatusBadge tone="success">Enviada</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Em preenchimento</StatusBadge>
  );
}

export function QuoteComparisonSection({ listId }: { listId: string }) {
  const { data, isLoading } = usePurchaseListQuotes(listId);

  const itemUnitById = useMemo(() => {
    const map = new Map<string, string>();
    data?.items.forEach((it) => map.set(it.purchase_list_item_id, it.dose_unit));
    return map;
  }, [data]);

  if (isLoading) return <TableRowsSkeleton rows={5} columns={4} />;

  if (!data || !data.request) {
    return (
      <EmptyState
        variant="inline"
        title="Gere o link de cotação para começar a receber preços das lojas."
      />
    );
  }

  if (data.responses.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhuma loja respondeu ainda."
        description="Assim que uma loja preencher a cotação pelo link, os preços aparecem aqui."
      />
    );
  }

  const { items, responses } = data;

  // Menor preço efetivo por item (para destacar a loja mais barata).
  const cheapestByItem = new Map<string, number>();
  for (const it of items) {
    let min = Infinity;
    for (const r of responses) {
      const cell = r.items.find((ci) => ci.purchase_list_item_id === it.purchase_list_item_id);
      const eff = cell?.unit_price_brl ?? cell?.substitute_unit_price_brl ?? null;
      if (eff != null && eff < min) min = eff;
    }
    if (min !== Infinity) cheapestByItem.set(it.purchase_list_item_id, min);
  }

  const cheapestTotal = Math.min(
    ...responses.map((r) => (r.total_brl > 0 ? r.total_brl : Infinity)),
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-rail text-left align-bottom">
            <th className="sticky left-0 z-10 bg-rail px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              Produto
            </th>
            {responses.map((r) => (
              <th key={r.id} className="min-w-[150px] px-3 py-3 text-right">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-text-strong">
                    <Store className="h-3.5 w-3.5 text-primary-strong" />
                    {r.store_name}
                  </span>
                  {statusBadge(r)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const unit = itemUnitById.get(it.purchase_list_item_id) ?? it.dose_unit;
            const cheapest = cheapestByItem.get(it.purchase_list_item_id) ?? null;
            return (
              <tr key={it.purchase_list_item_id} className="border-b border-border last:border-b-0">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                  <div className="font-semibold text-text-strong">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {fmtQty(it.quantity_to_buy)} {unit} · {it.stage}
                  </div>
                </td>
                {responses.map((r) => {
                  const cell = r.items.find(
                    (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
                  );
                  const eff = cell?.unit_price_brl ?? cell?.substitute_unit_price_brl ?? null;
                  const isCheapest = eff != null && cheapest != null && eff <= cheapest;
                  return (
                    <td
                      key={r.id}
                      className={
                        "px-3 py-2.5 text-right align-top " +
                        (isCheapest ? "bg-success-soft" : "")
                      }
                    >
                      {cell == null || (eff == null && cell.availability == null) ? (
                        <span className="text-placeholder">—</span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          {cell.unit_price_brl != null ? (
                            <span
                              className={
                                isCheapest
                                  ? "font-bold tabular-nums text-success-strong"
                                  : "font-semibold tabular-nums text-text-strong"
                              }
                            >
                              {fmtBrl(cell.unit_price_brl)}
                            </span>
                          ) : cell.availability === "UNAVAILABLE" ? (
                            <span className="text-xs text-muted-foreground">
                              {AVAILABILITY_LABEL.UNAVAILABLE}
                            </span>
                          ) : null}

                          {isCheapest && cell.unit_price_brl != null ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-success-strong">
                              ★ melhor
                            </span>
                          ) : null}

                          {cell.substitute_product_name ? (
                            <span className="text-xs text-clay-strong">
                              ↪ {cell.substitute_product_name}
                              {cell.substitute_unit_price_brl != null
                                ? ` · ${fmtBrl(cell.substitute_unit_price_brl)}`
                                : ""}
                            </span>
                          ) : null}

                          {cell.availability && cell.availability !== "UNAVAILABLE" ? (
                            <span className="text-[10px] text-muted-foreground">
                              {AVAILABILITY_LABEL[cell.availability]}
                            </span>
                          ) : null}

                          {cell.notes ? (
                            <span className="max-w-[160px] text-[10px] text-muted-foreground/80">
                              {cell.notes}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-rail">
            <td className="sticky left-0 z-10 bg-rail px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-text-strong">
              Total estimado
            </td>
            {responses.map((r) => {
              const isCheapest = r.total_brl > 0 && r.total_brl <= cheapestTotal;
              return (
                <td
                  key={r.id}
                  className={
                    isCheapest
                      ? "px-3 py-3 text-right font-bold tabular-nums text-success-strong"
                      : "px-3 py-3 text-right font-semibold tabular-nums text-text-strong"
                  }
                >
                  {r.total_brl > 0 ? fmtBrl(r.total_brl) : "—"}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
