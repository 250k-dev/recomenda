"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";

export type MultiStoreProductGroup = {
  purchase_list_item_id: string;
  product_name: string;
  dose_unit: string;
  remaining_qty: number;
  stores: Array<{
    quote_response_item_id: string;
    store_name: string;
    unit_price_brl: number;
  }>;
};

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

export function QuoteConfirmQtyDialog({
  open,
  onOpenChange,
  groups,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: MultiStoreProductGroup[];
  loading?: boolean;
  onConfirm: (quantities: Record<string, number>) => void;
}) {
  const [qtyByQuoteItem, setQtyByQuoteItem] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (open) setQtyByQuoteItem({});
  }, [open, groups]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    for (const g of groups) {
      let sum = 0;
      for (const s of g.stores) {
        const raw = qtyByQuoteItem[s.quote_response_item_id]?.replace(",", ".");
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
          errors.push(`${g.product_name}: informe a qtde em ${s.store_name}`);
          continue;
        }
        sum += n;
      }
      if (sum > g.remaining_qty + 1e-9) {
        errors.push(
          `${g.product_name}: soma (${fmtQty(sum)}) supera o restante (${fmtQty(g.remaining_qty)} ${g.dose_unit})`,
        );
      }
    }
    return errors;
  }, [groups, qtyByQuoteItem]);

  const submit = () => {
    if (validation.length) return;
    const out: Record<string, number> = {};
    for (const g of groups) {
      for (const s of g.stores) {
        out[s.quote_response_item_id] = Number(
          qtyByQuoteItem[s.quote_response_item_id].replace(",", "."),
        );
      }
    }
    onConfirm(out);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quantidade por loja</DialogTitle>
          <DialogDescription>
            O mesmo produto foi selecionado em mais de uma loja. Informe quanto
            foi comprado em cada uma.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          {groups.map((g) => {
            const sum = g.stores.reduce((acc, s) => {
              const n = Number(
                (qtyByQuoteItem[s.quote_response_item_id] ?? "").replace(
                  ",",
                  ".",
                ),
              );
              return acc + (Number.isFinite(n) ? n : 0);
            }, 0);
            return (
              <div
                key={g.purchase_list_item_id}
                className="rounded-xl border border-border bg-rail/30 p-3"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div>
                    <div className="font-semibold text-text-strong">
                      {g.product_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Restante: {fmtQty(g.remaining_qty)} {g.dose_unit}
                    </div>
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    Soma: {fmtQty(sum)} {g.dose_unit}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {g.stores.map((s) => (
                    <div
                      key={s.quote_response_item_id}
                      className="grid grid-cols-[1fr_110px] items-end gap-2"
                    >
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {s.store_name} · {fmtBrl(s.unit_price_brl)}
                        </Label>
                      </div>
                      <Input
                        inputMode="decimal"
                        placeholder="Qtde"
                        value={qtyByQuoteItem[s.quote_response_item_id] ?? ""}
                        onChange={(e) =>
                          setQtyByQuoteItem((prev) => ({
                            ...prev,
                            [s.quote_response_item_id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {validation.length > 0 ? (
            <ul className="text-xs text-danger-strong">
              {validation.slice(0, 4).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={loading || validation.length > 0}
          >
            {loading ? "Confirmando…" : "Confirmar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
