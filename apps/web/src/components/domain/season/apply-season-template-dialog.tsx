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
  const [templateId, setTemplateId] = useState("");

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
      onSuccess: () => {
        toast.success("Modelo aplicado às etapas deste talhão.");
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
