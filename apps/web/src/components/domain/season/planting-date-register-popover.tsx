"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Label } from "@recomenda/ui/primitives/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@recomenda/ui/primitives/popover";
import { BrazilianDateInput } from "@recomenda/ui/forms/brazilian-date-input";
import { useUpdateSeason } from "@recomenda/api-hooks";
import { previewPlantingDate, type PlantingPreviewChange } from "@recomenda/api";
import { todayLocalYmd } from "@recomenda/domain/timing/window-days";
import { extractError } from "@/components/domain/season/_shared";
import { PlantingRecalcConfirmDialog } from "@/components/domain/season/planting-recalc-confirm-dialog";

/** Garante `YYYY-MM-DD` interno (API / state). Exibição fica em DD/MM/AAAA. */
function toYmd(value?: string | null): string {
  if (!value) return todayLocalYmd();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : todayLocalYmd();
}

/**
 * Registra ou altera a data de plantio da safra (âncora do cronograma).
 * O PATCH no servidor recalcula as datas previstas das etapas PENDING.
 */
export function PlantingDateRegisterPopover({
  seasonId,
  currentPlantingDate,
  mode,
  align = "end",
  trigger,
}: {
  seasonId: string;
  currentPlantingDate?: string | null;
  /** "register" = primeira vez; "edit" = alterar data existente. */
  mode: "register" | "edit";
  align?: "start" | "center" | "end";
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => toYmd(currentPlantingDate));
  const updateMut = useUpdateSeason(seasonId);
  const [checking, setChecking] = useState(false);
  // Etapas que já têm data e vão mudar — abre o aviso antes de salvar.
  const [pendingChanges, setPendingChanges] = useState<PlantingPreviewChange[] | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDate(toYmd(currentPlantingDate));
    }
  };

  const doSave = () => {
    updateMut.mutate(
      { planting_date: date },
      {
        onSuccess: () => {
          toast.success(
            mode === "edit"
              ? "Data de plantio atualizada. Etapas pendentes recalculadas."
              : "Data de plantio adicionada. Etapas pendentes recalculadas.",
          );
          setPendingChanges(null);
          setOpen(false);
        },
        onError: (error: unknown) => {
          setPendingChanges(null);
          toast.error(extractError(error) || "Não foi possível salvar a data de plantio.");
        },
      },
    );
  };

  const handleSave = async () => {
    if (!date) return;
    setChecking(true);
    try {
      const preview = await previewPlantingDate(seasonId, date);
      if (preview.changes.length > 0) {
        setPendingChanges(preview.changes);
        return;
      }
    } catch {
      // Sem prévia (rede/servidor antigo) não trava o plantio: salva direto.
    } finally {
      setChecking(false);
    }
    doSave();
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline" className="h-8 gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {mode === "edit" ? "Alterar data" : "Adicionar data"}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {mode === "edit" ? "Alterar · Data de plantio" : "Adicionar · Data de plantio"}
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-primary">
                Data de plantio
              </Label>
              <BrazilianDateInput
                value={date}
                onChange={setDate}
                placeholder="DD/MM/AAAA"
                aria-label="Data de plantio"
                className="h-10 text-sm font-semibold border-primary/30 bg-card"
              />
              <p className="text-xs text-muted-foreground">
                As datas previstas das etapas pendentes serão recalculadas com base
                nesta data.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMut.isPending || checking || !date}
              className="h-8 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {updateMut.isPending || checking ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <PlantingRecalcConfirmDialog
        open={pendingChanges != null}
        onOpenChange={(next) => {
          if (!next) setPendingChanges(null);
        }}
        plantingDate={date}
        changes={pendingChanges ?? []}
        loading={updateMut.isPending}
        onConfirm={doSave}
      />
    </>
  );
}
