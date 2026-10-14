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
import type { SameStageRecommendation } from "@recomenda/api/seasons";
import { allPendingSameStageIds } from "@/components/domain/export/application-data-ui";
import { StageItemReplicationPicker } from "@/components/domain/season/stage-item-replication-panel";

export function DeleteStageItemDialog({
  open,
  onOpenChange,
  productName,
  stageName,
  sameStageRows,
  sameStageLoading,
  loading,
  onOnlyHere,
  onHereAndOthers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  stageName: string;
  sameStageRows: SameStageRecommendation[];
  sameStageLoading: boolean;
  loading?: boolean;
  onOnlyHere: () => void | Promise<void>;
  onHereAndOthers: (targetRecommendationIds: string[]) => void | Promise<void>;
}) {
  const pendingOthers = useMemo(
    () => sameStageRows.filter((row) => row.status === "PENDING"),
    [sameStageRows],
  );
  const hasOthers = pendingOthers.length > 0;
  const [step, setStep] = useState<"choose" | "pick">("choose");
  const [targetIds, setTargetIds] = useState<Set<string>>(() => new Set());
  const rowsKey = sameStageRows.map((row) => `${row.id}:${row.status}`).join("|");

  useEffect(() => {
    if (!open) {
      setStep("choose");
      setTargetIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open || step !== "pick") return;
    setTargetIds(allPendingSameStageIds(sameStageRows));
  }, [open, step, rowsKey, sameStageRows]);

  const busy = Boolean(loading);

  const goToPick = () => {
    setTargetIds(allPendingSameStageIds(sameStageRows));
    setStep("pick");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] max-w-lg flex-col gap-0 overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <DialogTitle>Remover produto</DialogTitle>
          <DialogDescription className="text-left">
            {step === "choose" ? (
              <>
                Remover <span className="font-medium text-foreground">{productName}</span> da etapa{" "}
                <span className="font-medium text-foreground">{stageName}</span>?
                {hasOthers
                  ? " Você pode tirar só deste talhão ou repetir a remoção nos outros talhões com a mesma etapa pendente."
                  : " Não há outro talhão pendente com esta etapa."}
              </>
            ) : (
              <>
                Marque os talhões em que{" "}
                <span className="font-medium text-foreground">{productName}</span> também deve ser
                removido. Neste talhão a remoção já será feita.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <StageItemReplicationPicker
              rows={sameStageRows}
              loading={sameStageLoading}
              selectedIds={targetIds}
              onSelectedIdsChange={setTargetIds}
              title="Remover nos outros talhões"
              defaultExpanded
            />
          </div>
        ) : null}

        <DialogFooter className="shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-col sm:items-stretch">
          {step === "choose" ? (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                className="w-full"
                onClick={() => void onOnlyHere()}
              >
                {busy ? "Removendo…" : "Só neste talhão"}
              </Button>
              {hasOthers ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="w-full"
                  onClick={goToPick}
                >
                  Remover nos outros talhões também
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || targetIds.size === 0}
                className="w-full"
                onClick={() => void onHereAndOthers([...targetIds])}
              >
                {busy
                  ? "Removendo…"
                  : targetIds.size === 1
                    ? "Remover neste talhão e em mais 1"
                    : `Remover neste talhão e em mais ${targetIds.size}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                className="w-full"
                onClick={() => setStep("choose")}
              >
                Voltar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
