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
  useTimingTemplate,
  useTimingTemplates,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { zeroPeriodStageNames } from "@recomenda/domain/timing/window-days";
import { ZeroPeriodApplyDialog } from "@/components/domain/season/zero-period-apply-dialog";

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
  const [zeroOpen, setZeroOpen] = useState(false);
  const { data: templateDetail, isLoading: detailLoading } = useTimingTemplate(
    open ? templateId : "",
  );

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

  const zeroNames = useMemo(
    () => zeroPeriodStageNames(templateDetail?.stages ?? []),
    [templateDetail?.stages],
  );

  const runApply = () => {
    applyMut.mutate(templateId, {
      onSuccess: (res) => {
        const impact = res.list_impact;
        if (impact?.conflicts.length) {
          toast.warning(
            `${impact.conflicts.length} ${impact.conflicts.length === 1 ? "item já tinha compra confirmada" : "itens já tinham compra confirmada"}. A lista não mudou dose nem unidade — compre o complemento se faltar.`,
          );
        }
        if (impact?.shortages?.length) {
          toast.warning(
            `Falta comprar: ${impact.shortages.map((s) => s.product_name).join(", ")}.`,
          );
        }
        toast.success("Modelo aplicado às etapas deste talhão.");
        setZeroOpen(false);
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        toast.error(apiErrorMessage(e, "Não foi possível aplicar o modelo."));
      },
    });
  };

  const handleApply = () => {
    if (!templateId) {
      toast.error("Selecione um modelo de timing.");
      return;
    }
    if (zeroNames.length > 0) {
      setZeroOpen(true);
      return;
    }
    runApply();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar modelo de timing</DialogTitle>
          <DialogDescription>
            {hasPendingStages
              ? "As etapas pendentes deste talhão serão substituídas pelo modelo. Etapas já aplicadas ou puladas permanecem."
              : "As etapas do modelo entram neste talhão. Etapas já aplicadas ou puladas com o mesmo nome permanecem."}
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
          <p className="text-[13px] text-muted-foreground">
            A lista de compra não muda dose nem unidade. Produto ausente entra
            como fora da programação.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={applyMut.isPending || detailLoading || !templateId}
          >
            {applyMut.isPending ? "Aplicando…" : "Aplicar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ZeroPeriodApplyDialog
        open={zeroOpen}
        onOpenChange={setZeroOpen}
        stageNames={zeroNames}
        loading={applyMut.isPending}
        onConfirm={runApply}
      />
    </Dialog>
  );
}
