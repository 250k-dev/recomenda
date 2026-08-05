"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { useStockOrigins } from "@recomenda/api-hooks";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.slice(0, 10).split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function StockOriginsDialog({
  open,
  onOpenChange,
  producerId,
  localProductId,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producerId: string;
  localProductId: string;
  productName: string;
}) {
  const { data, isLoading } = useStockOrigins(
    producerId,
    localProductId,
    open && Boolean(localProductId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Origem · {productName}</DialogTitle>
          <DialogDescription>
            Histórico de compras deste produto (loja, vendedor, quantidade e
            preço).
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma compra registrada para este produto.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border bg-rail/30 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text-strong">
                      {row.store_name ?? "Origem manual"}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtDate(row.purchased_at)}
                    </span>
                  </div>
                  {row.seller_name ? (
                    <div className="text-xs text-muted-foreground">
                      Vendedor: {row.seller_name}
                    </div>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-text-strong">
                    <span>Qtde: {fmtQty(row.quantity)}</span>
                    <span>
                      Preço:{" "}
                      {row.unit_price_brl != null
                        ? fmtBrl(row.unit_price_brl)
                        : "—"}
                    </span>
                  </div>
                  {row.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Obs.: {row.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
