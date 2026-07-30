"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GripVertical, ListOrdered, RotateCcw, Save } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { useUpdateSeason } from "@recomenda/api-hooks";
import {
  DEFAULT_FORMULATION_MIX_ORDER,
  FORMULATION_MIX_OPTIONS,
  formulationOptionLabel,
  normalizeFormulationMixOrder,
  type FormulationKey,
} from "@recomenda/domain/recommendations/formulation-mix-order";
import { apiErrorMessage } from "@recomenda/api/api-error";

/**
 * Configura a ordem de mistura da calda nesta safra.
 * Default = guia oficial por formulação (SG → WP → SC → EC → SL…).
 * O agrônomo arrasta as opções e salva; export PDF/WhatsApp respeitam essa ordem.
 */
export function SeasonMixOrderDialog({
  open,
  onOpenChange,
  seasonId,
  currentOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  currentOrder?: FormulationKey[] | null;
}) {
  const updateMut = useUpdateSeason(seasonId);
  const [order, setOrder] = useState<FormulationKey[]>(
    () =>
      normalizeFormulationMixOrder(currentOrder) ?? [
        ...DEFAULT_FORMULATION_MIX_ORDER,
      ],
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrder(
      normalizeFormulationMixOrder(currentOrder) ?? [
        ...DEFAULT_FORMULATION_MIX_ORDER,
      ],
    );
  }, [open, currentOrder]);

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleSave = () => {
    updateMut.mutate(
      { mix_formulation_order: order },
      {
        onSuccess: () => {
          toast.success("Ordem de mistura salva para esta safra.");
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          toast.error(apiErrorMessage(e, "Não foi possível salvar a ordem."));
        },
      },
    );
  };

  const handleReset = () => {
    setOrder([...DEFAULT_FORMULATION_MIX_ORDER]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 shrink-0" />
            Ordem de mistura na calda
          </DialogTitle>
          <DialogDescription>
            Padrão oficial por tipo de formulação (SG, WP, SC, EC, SL…). Arraste
            para personalizar nesta safra. PDF e WhatsApp usam essa ordem.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <ul className="space-y-1.5">
            {order.map((key, index) => {
              const option = FORMULATION_MIX_OPTIONS.find((o) => o.key === key);
              const isDragging = dragIndex === index;
              return (
                <li
                  key={key}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex == null || dragIndex === index) return;
                    moveItem(dragIndex, index);
                    setDragIndex(index);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex w-full cursor-grab items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 active:cursor-grabbing ${
                    isDragging ? "opacity-60 ring-1 ring-primary/40" : ""
                  }`}
                >
                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="break-words text-sm font-medium leading-snug text-foreground">
                      {option?.label ?? formulationOptionLabel(key)}
                    </p>
                    {option?.hint ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
                        {option.hint}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={updateMut.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {updateMut.isPending ? "Salvando…" : "Salvar ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
