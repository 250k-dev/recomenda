"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CircleAlert, PackageMinus, Trash2 } from "lucide-react";
import {
  removePurchaseListItems,
  type ProductRemovalPreview,
} from "@recomenda/api/purchase-lists";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useProductRemovalPreview, useRemoveListProducts } from "@recomenda/api-hooks";
import { DOSE_UNIT_SHORT_LABELS } from "@recomenda/utils";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";

export type RemovalRow = {
  key: string;
  productId: string;
  productName: string;
  stage: string;
};

const fmtQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const unitLabel = (unit: string) =>
  (DOSE_UNIT_SHORT_LABELS as Record<string, string>)[unit] ?? unit;

/** Tem compra, estoque reservado ou aplicação: sai o produto inteiro da safra. */
export function isHeavyRemoval(p: ProductRemovalPreview): boolean {
  return p.purchased_qty > 1e-9 || p.applied.quantity > 1e-9 || p.stock_return.quantity > 1e-9;
}

function StagesLine({ stages }: { stages: ProductRemovalPreview["pending_stages"] }) {
  if (stages.length === 0) return <>Sai da lista.</>;
  const shown = stages.slice(0, 3);
  const rest = stages.length - shown.length;
  return (
    <>
      Sai da lista e de {stages.length} {stages.length === 1 ? "etapa pendente" : "etapas pendentes"}:{" "}
      {shown
        .map((s) => `${s.stage_name} (${s.plots.length} ${s.plots.length === 1 ? "talhão" : "talhões"})`)
        .join(", ")}
      {rest > 0 ? ` e mais ${rest}` : ""}.
    </>
  );
}

/**
 * "Remover da lista" depois de publicada a safra. Produto com compra, estoque
 * reservado ou aplicação sai INTEIRO (todas as linhas e etapas pendentes); o
 * reservado volta do galpão como devolução e o já aplicado fica na aba
 * "Removidos". Linha sem nada disso sai só ela, como antes.
 */
export function ProductRemovalDialog({
  open,
  onOpenChange,
  listId,
  rows,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  rows: RemovalRow[];
  /** Produtos que saíram inteiros e linhas simples que saíram. */
  onRemoved: (result: {
    wholeProductIds: Set<string>;
    rows: Array<{ productId: string; stage: string }>;
  }) => void;
}) {
  const productIds = [...new Set(rows.map((r) => r.productId).filter(Boolean))];
  const preview = useProductRemovalPreview(listId, productIds, open);
  const removeMut = useRemoveListProducts(listId);
  const [busy, setBusy] = useState(false);

  const heavy = (preview.data ?? []).filter(isHeavyRemoval);
  const heavyIds = new Set(heavy.map((p) => p.local_product_id));
  const lightRows = rows.filter((r) => r.productId && !heavyIds.has(r.productId));

  const confirm = async () => {
    setBusy(true);
    try {
      if (heavy.length > 0) await removeMut.mutateAsync([...heavyIds]);
      let removedLight: Array<{ productId: string; stage: string }> = [];
      if (lightRows.length > 0) {
        const res = await removePurchaseListItems(
          listId,
          lightRows.map((r) => ({ local_product_id: r.productId, stage: r.stage })),
          { skipHeavySync: true },
        );
        removedLight = res.removed.map((r) => ({ productId: r.local_product_id, stage: r.stage }));
        if (res.blocked.length > 0) {
          toast.error(
            `${res.blocked.map((b) => b.product_name).join(", ")} não saiu: tente de novo.`,
          );
        }
      }
      const count = heavy.length + removedLight.length;
      if (count > 0) {
        toast.success(
          heavy.some((p) => p.applied.quantity > 1e-9)
            ? "Removido. O que já foi aplicado está na aba Removidos."
            : `${count} ${count === 1 ? "produto removido" : "produtos removidos"} da lista.`,
        );
      }
      onRemoved({ wholeProductIds: heavyIds, rows: removedLight });
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível remover."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Remover da lista</DialogTitle>
          <DialogDescription>Confira o que muda na safra antes de remover.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2.5 overflow-y-auto px-6 py-4">
          {preview.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando o que muda…</p>
          ) : preview.isError ? (
            <p className="text-sm text-destructive">
              {apiErrorMessage(preview.error, "Não foi possível calcular a remoção.")}
            </p>
          ) : (
            <>
              {heavy.map((p) => {
                const unit = unitLabel(p.dose_unit);
                return (
                  <div key={p.local_product_id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <p className="text-sm font-semibold text-text-strong">{p.product_name}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      <StagesLine stages={p.pending_stages} />
                    </p>
                    {p.stock_return.quantity > 1e-9 ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-warning-strong">
                        <PackageMinus className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Devolução do galpão: {fmtQty(p.stock_return.quantity)} {unit}
                          {p.stock_return.total_brl != null ? ` (${fmtBrl(p.stock_return.total_brl)})` : ""}.
                          O custo sai junto.
                        </span>
                      </p>
                    ) : null}
                    {p.applied.quantity > 1e-9 ? (
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[13px] text-destructive">
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Já registrado em {p.applied.stages}{" "}
                          {p.applied.stages === 1 ? "etapa" : "etapas"}: {fmtQty(p.applied.quantity)} {unit}
                          {p.applied.total_brl != null ? ` (${fmtBrl(p.applied.total_brl)})` : ""}. Continua
                          registrado e vai para a aba <strong>Removidos</strong>.
                        </span>
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {lightRows.length > 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {heavy.length > 0 ? "Também saem" : "Saem"} da lista (sem compra nem aplicação):{" "}
                  {lightRows.map((r) => `${r.productName || "Produto"} — ${r.stage}`).join("; ")}. Se
                  estiverem em etapas pendentes da mesma etapa, saem de lá também.
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            disabled={busy || preview.isLoading || preview.isError}
            onClick={() => void confirm()}
          >
            <Trash2 className="size-4" />
            {busy ? "Removendo…" : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
