"use client";

import { useState } from "react";
import type { Route } from "next";
import { PackagePlus } from "lucide-react";
import type { PublishBlockSummary } from "@recomenda/api/api-error";
import { Button } from "@recomenda/ui/primitives/button";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import { PublishBlockedDialog } from "@/components/domain/publish-blocked-dialog";

/**
 * Registro de aplicação recusado por falta de produto no galpão: o mesmo modal
 * informativo do "Não foi possível publicar", listando o que falta de cada
 * produto (precisa · no galpão · falta).
 *
 * Com `onRegisterWithoutQuote`, ganha "Registrar sem cotar": lança no galpão
 * SÓ o que falta (compra sem cotação, ligada à lista da safra) e registra.
 */
export function StockShortageDialog({
  summary,
  onClose,
  stockHref,
  onRegisterWithoutQuote,
  registering = false,
  askTotal = true,
  registerLabel = "Registrar sem cotar",
  confirmText,
}: {
  summary: PublishBlockSummary | null;
  onClose: () => void;
  stockHref?: Route | null;
  /** Recebe o valor gasto informado (opcional). */
  onRegisterWithoutQuote?: (manualTotalSpentBrl: number | null) => void;
  registering?: boolean;
  /** Pede o valor gasto (não no registro em massa: várias listas). */
  askTotal?: boolean;
  registerLabel?: string;
  /** Texto do passo de confirmação (o padrão fala de uma aplicação). */
  confirmText?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [total, setTotal] = useState("");
  const open = summary != null;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setConfirming(false);
      setTotal("");
    }
  }

  const confirm = () => {
    const value = total ? Number(total) : NaN;
    onRegisterWithoutQuote?.(Number.isFinite(value) && value > 0 ? value : null);
  };

  return (
    <PublishBlockedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !registering) onClose();
      }}
      title="Estoque insuficiente para registrar"
      message={summary?.message ?? ""}
      items={summary?.items ?? []}
      itemsLabel={(count) => (count === 1 ? "1 produto em falta" : `${count} produtos em falta`)}
      listHref={confirming ? null : stockHref ?? null}
      linkLabel="Ir ao estoque"
      hideClose={confirming}
      actions={
        !onRegisterWithoutQuote ? null : confirming ? (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={registering}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </Button>
            <Button type="button" disabled={registering} onClick={confirm}>
              {registering ? "Registrando…" : "Confirmar e registrar"}
            </Button>
          </>
        ) : (
          <Button type="button" className="gap-1.5" onClick={() => setConfirming(true)}>
            <PackagePlus className="size-4" />
            {registerLabel}
          </Button>
        )
      }
    >
      {confirming ? (
        <div className="mx-6 mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
          <p className="text-foreground">
            {confirmText ?? (
              <>
                Lança no estoque <strong>só o que falta</strong> (como compra sem cotação, na
                lista da safra) e registra a aplicação.
              </>
            )}
          </p>
          {askTotal ? (
            <label className="mt-2.5 grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Valor gasto (R$) — opcional
              </span>
              <MoneyInput
                value={total}
                onValueChange={setTotal}
                decimals={2}
                placeholder="0,00"
                className="h-9 text-right tabular-nums"
                disabled={registering}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </PublishBlockedDialog>
  );
}
