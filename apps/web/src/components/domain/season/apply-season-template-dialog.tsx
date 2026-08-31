"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import {
  useApplySeasonTemplate,
  useSeason,
  useSyncCycleListDoses,
  useTimingTemplates,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";

export function ApplySeasonTemplateDialog({
  open,
  onOpenChange,
  seasonId,
  producerId,
  crop,
  hasPendingStages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  producerId: string;
  crop?: string | null;
  hasPendingStages: boolean;
}) {
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const applyMut = useApplySeasonTemplate(seasonId);
  const { data: season } = useSeason(seasonId);
  const cycleId = season?.cycle_id ?? "";
  const syncListDoses = useSyncCycleListDoses(cycleId);
  const [templateId, setTemplateId] = useState("");
  // A programação passa a usar a dose do modelo; sem isto a lista de compra
  // ficaria com a dose antiga.
  const [syncList, setSyncList] = useState(true);

  const options = useMemo(
    () =>
      (templates ?? [])
        .filter(
          (t) =>
            !t.is_archived && (!crop || t.crop === crop || t.crop === "ANY"),
        )
        .map((t) => ({ value: t.id, label: t.name })),
    [templates, crop],
  );

  useEffect(() => {
    if (!open) return;
    setTemplateId((current) =>
      current && options.some((o) => o.value === current)
        ? current
        : (options[0]?.value ?? ""),
    );
  }, [open, options]);

  const handleApply = () => {
    if (!templateId) {
      toast.error("Selecione um modelo de timing.");
      return;
    }
    applyMut.mutate(templateId, {
      onSuccess: async () => {
        let listMsg = "";
        if (syncList && cycleId) {
          try {
            const res = await syncListDoses.mutateAsync();
            if (res.updated > 0) {
              listMsg = ` ${res.updated} ${res.updated === 1 ? "item" : "itens"} da lista ${res.updated === 1 ? "atualizado" : "atualizados"}.`;
            }
            if (res.conflicts.length > 0) {
              toast.warning(
                `${res.conflicts.length} ${res.conflicts.length === 1 ? "item não foi alterado" : "itens não foram alterados"} por já ter compra confirmada.`,
              );
            }
          } catch {
            toast.warning(
              "Modelo aplicado, mas não deu para atualizar a lista de compra.",
            );
          }
        }
        toast.success(`Modelo aplicado às etapas deste talhão.${listMsg}`);
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        toast.error(apiErrorMessage(e, "Não foi possível aplicar o modelo."));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar modelo de timing</DialogTitle>
          <DialogDescription>
            {hasPendingStages
              ? "As etapas pendentes deste talhão serão substituídas pelo modelo. Etapas já aplicadas permanecem."
              : "As etapas do modelo entram neste talhão. Você pode editar depois."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-6 py-4">
          <Label className="text-xs text-muted-foreground">Modelo</Label>
          <Select
            value={templateId}
            onValueChange={setTemplateId}
            disabled={isLoading || options.length === 0}
            placeholder={
              isLoading ? "Carregando…" : "Selecione um modelo…"
            }
            options={options}
          />
          {options.length === 0 && !isLoading ? (
            <p className="text-xs text-muted-foreground">
              Nenhum modelo desta cultura para o produtor.
            </p>
          ) : null}
          {cycleId ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={syncList}
                onChange={(e) => setSyncList(e.target.checked)}
              />
              <span className="text-[13px]">
                <span className="font-semibold text-text-strong">
                  Atualizar a lista de compra com as doses do modelo
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  Estoque, preços e itens com compra confirmada não são alterados.
                </span>
              </span>
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={applyMut.isPending || !templateId}
          >
            {applyMut.isPending ? "Aplicando…" : "Aplicar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
