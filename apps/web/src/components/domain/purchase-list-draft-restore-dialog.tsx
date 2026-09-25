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
import {
  applyDraftRecoverySelection,
  listDraftRecoveryCandidates,
  type ListItem,
} from "@recomenda/domain";
import { cn } from "@recomenda/utils";

type PurchaseListDraftRestoreDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverItems: ListItem[];
  backupItems: ListItem[];
  listCrop?: string | null;
  onConfirm: (draft: ListItem[]) => void;
};

export function PurchaseListDraftRestoreDialog({
  open,
  onOpenChange,
  serverItems,
  backupItems,
  listCrop,
  onConfirm,
}: PurchaseListDraftRestoreDialogProps) {
  const changes = useMemo(
    () => listDraftRecoveryCandidates(serverItems, backupItems, listCrop),
    [serverItems, backupItems, listCrop],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(changes.map((c) => c.key)));
  }, [open, changes]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const recoverSelected = () => {
    if (selected.size === 0) return;
    onConfirm(applyDraftRecoverySelection(serverItems, backupItems, selected));
    onOpenChange(false);
  };

  const newCount = changes.filter((c) => c.kind === "new").length;
  const changedCount = changes.filter((c) => c.kind === "changed").length;

  const changeSummary = useMemo(() => {
    if (changes.length === 0) {
      return "Nada a recuperar: o rascunho é igual ao que está salvo. Descarte o aviso no banner.";
    }
    const bits: string[] = [];
    if (newCount > 0) bits.push(`${newCount} ${newCount === 1 ? "novo" : "novos"}`);
    if (changedCount > 0) {
      bits.push(`${changedCount} ${changedCount === 1 ? "editado" : "editados"}`);
    }
    const n = changes.length;
    return `${n} ${n === 1 ? "alteração" : "alterações"} (${bits.join(", ")}). Salve a lista para gravar no servidor.`;
  }, [changes.length, newCount, changedCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recuperar alterações do navegador</DialogTitle>
          <DialogDescription>{changeSummary}</DialogDescription>
        </DialogHeader>

        {changes.length > 0 ? (
          <div className="max-h-[min(50vh,320px)] overflow-y-auto px-6 py-3">
            <ul className="space-y-1">
              {changes.map((row) => (
                <li key={row.key}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                      selected.has(row.key)
                        ? "border-primary/30 bg-primary-soft/40"
                        : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      checked={selected.has(row.key)}
                      onChange={() => toggle(row.key)}
                    />
                    <span className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="font-medium text-foreground">
                        {row.item.productName || "Produto sem nome"}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {row.item.stage || "sem etapa"}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs font-semibold",
                          row.kind === "new" ? "text-primary" : "text-warning-strong",
                        )}
                      >
                        {row.kind === "new" ? "ainda não está na lista salva" : "editado no rascunho"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {changes.length === 0 ? "Fechar" : "Cancelar"}
          </Button>
          {changes.length > 0 ? (
            <Button
              type="button"
              variant="clay"
              disabled={selected.size === 0}
              onClick={recoverSelected}
            >
              Recuperar {selected.size === 1 ? "1 alteração" : `${selected.size} alterações`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
