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
import { useReassignSeasonPlot } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { CycleAvailablePlot, CycleSeasonRow } from "@recomenda/api/cycles";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function ReassignSeasonPlotDialog({
  open,
  onOpenChange,
  cycleId,
  season,
  farmId,
  plots,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  season: CycleSeasonRow | null;
  farmId: string;
  plots: CycleAvailablePlot[];
}) {
  const reassign = useReassignSeasonPlot(cycleId);
  const [plotId, setPlotId] = useState("");
  const linking = Boolean(season?.plot_missing);

  const options = useMemo(
    () =>
      plots
        .filter((p) => p.farm_id === farmId)
        .map((p) => ({
          value: p.id,
          label: `${p.name} · ${fmtHa(p.area_hectares)} ha${
            p.in_other_cycle && p.other_cycle_name
              ? ` · em ${p.other_cycle_name}`
              : ""
          }`,
          disabled: p.in_other_cycle,
        })),
    [plots, farmId],
  );

  useEffect(() => {
    if (!open) return;
    setPlotId((current) =>
      current && options.some((o) => o.value === current && !o.disabled)
        ? current
        : (options.find((o) => !o.disabled)?.value ?? ""),
    );
  }, [open, options]);

  const selected = plots.find((p) => p.id === plotId && p.farm_id === farmId);
  const currentHa =
    season?.planted_area_ha ?? season?.plot_area_ha ?? 0;

  const handleConfirm = () => {
    if (!season || !plotId) {
      toast.error("Selecione um talhão.");
      return;
    }
    reassign.mutate(
      { seasonId: season.id, plotId },
      {
        onSuccess: () => {
          toast.success(
            linking
              ? "Talhão vinculado à programação."
              : "Talhão da programação atualizado.",
          );
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            apiErrorMessage(
              err,
              "Não foi possível trocar o talhão desta programação.",
            ),
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {linking ? "Vincular talhão" : "Trocar talhão"}
          </DialogTitle>
          <DialogDescription>
            {linking
              ? "O cadastro deste talhão não existe mais. Escolha outro talhão desta mesma fazenda para manter a programação."
              : "Só entram talhões desta fazenda. A programação permanece; a área plantada passa a ser a do talhão novo e a lista de compra é recalculada."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          <div>
            <Label className="text-xs text-muted-foreground">Talhão</Label>
            <Select
              className="mt-1"
              value={plotId}
              onValueChange={setPlotId}
              disabled={options.length === 0}
              placeholder={
                options.length === 0
                  ? "Nenhum talhão livre nesta fazenda"
                  : "Selecione um talhão…"
              }
              options={options}
            />
          </div>
          {selected ? (
            <p className="text-[13px] text-muted-foreground">
              Área atual: {fmtHa(currentHa)} ha → nova:{" "}
              {fmtHa(selected.area_hectares)} ha. Doses da lista acompanham os
              hectares.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Cadastre um talhão nesta fazenda para vincular ou trocar.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={reassign.isPending || !plotId}
          >
            {reassign.isPending
              ? "Salvando…"
              : linking
                ? "Vincular"
                : "Trocar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
