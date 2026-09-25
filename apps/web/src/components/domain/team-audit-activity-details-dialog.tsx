"use client";

import type { PurchaseListAuditItemLine, TeamActivityRow } from "@recomenda/api/consultants";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { cn } from "@recomenda/utils";

function linesFromRow(row: TeamActivityRow | null): PurchaseListAuditItemLine[] {
  if (!row?.details?.purchase_list_items?.length) return [];
  return row.details.purchase_list_items;
}

type TeamAuditActivityDetailsDialogProps = {
  row: TeamActivityRow | null;
  onOpenChange: (open: boolean) => void;
};

export function TeamAuditActivityDetailsDialog({
  row,
  onOpenChange,
}: TeamAuditActivityDetailsDialogProps) {
  const lines = linesFromRow(row);
  const open = Boolean(row && lines.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Produtos desta alteração</DialogTitle>
          <DialogDescription>
            {lines.length}{" "}
            {lines.length === 1 ? "item registrado" : "itens registrados"} neste save
            em lote.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[min(50vh,360px)] overflow-y-auto px-6 py-3">
          {lines.map((line, index) => (
            <li
              key={`${line.product_name}-${line.stage}-${index}`}
              className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
            >
              <span className="min-w-0 font-medium text-foreground">
                {line.product_name}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {line.stage}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  line.kind === "added"
                    ? "bg-primary/15 text-primary"
                    : "bg-danger-soft text-danger-strong",
                )}
              >
                {line.kind === "added" ? "Adicionado" : "Removido"}
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function hasPurchaseListAuditDetails(row: TeamActivityRow): boolean {
  return (row.details?.purchase_list_items?.length ?? 0) > 0;
}
