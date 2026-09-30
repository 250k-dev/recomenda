"use client";

import type { Route } from "next";
import type { PublishBlockSummary } from "@recomenda/api/api-error";
import { PublishBlockedDialog } from "@/components/domain/publish-blocked-dialog";

/**
 * Registro de aplicação recusado por falta de produto no galpão: o mesmo modal
 * informativo do "Não foi possível publicar", listando o que falta de cada
 * produto (precisa · no galpão · falta).
 */
export function StockShortageDialog({
  summary,
  onClose,
  stockHref,
}: {
  summary: PublishBlockSummary | null;
  onClose: () => void;
  stockHref?: Route | null;
}) {
  return (
    <PublishBlockedDialog
      open={summary != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Estoque insuficiente para registrar"
      message={summary?.message ?? ""}
      items={summary?.items ?? []}
      itemsLabel={(count) => (count === 1 ? "1 produto em falta" : `${count} produtos em falta`)}
      listHref={stockHref ?? null}
      linkLabel="Ir ao estoque"
    />
  );
}
