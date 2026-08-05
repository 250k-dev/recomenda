"use client";

import { useState } from "react";
import { Eye, History } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { useStockHistory } from "@recomenda/api-hooks";
import { StockOriginsDialog } from "@/components/domain/stock-origins-dialog";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.slice(0, 10).split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function StockHistoryDialog({
  open,
  onOpenChange,
  producerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producerId: string;
}) {
  const [q, setQ] = useState("");
  const [detailProduct, setDetailProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { data, isLoading } = useStockHistory(producerId, q.trim() || undefined, open);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5" />
              Histórico de estoque
            </DialogTitle>
            <DialogDescription>
              Produtos já comprados — inclusive os que zeraram após aplicações.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome do produto…"
              autoFocus
            />

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : !data?.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto encontrado no histórico.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.map((row) => (
                  <li
                    key={row.local_product_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text-strong">
                        {row.product_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.purchase_count} compra(s) · total{" "}
                        {fmtQty(row.total_quantity)}
                        {row.dose_unit ? ` ${row.dose_unit}` : ""} · última{" "}
                        {fmtDate(row.last_purchased_at)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Ver origem"
                      onClick={() =>
                        setDetailProduct({
                          id: row.local_product_id,
                          name: row.product_name,
                        })
                      }
                    >
                      <Eye className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StockOriginsDialog
        open={detailProduct != null}
        onOpenChange={(v) => {
          if (!v) setDetailProduct(null);
        }}
        producerId={producerId}
        localProductId={detailProduct?.id ?? ""}
        productName={detailProduct?.name ?? ""}
      />
    </>
  );
}
