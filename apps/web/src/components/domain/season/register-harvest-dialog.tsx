"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Wheat } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@recomenda/ui/primitives/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { useRegisterHarvest } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { todayLocalYmd } from "@recomenda/domain/timing/window-days";

export function fmtBags(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function fmtScHa(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function cycleHarvestFromSeasons(
  seasons: Array<{
    harvest_total_bags?: number | null;
    planted_area_ha?: number | null;
    plot_area_ha: number;
  }>,
) {
  const harvested = seasons.filter((s) => s.harvest_total_bags != null);
  if (harvested.length === 0) {
    return { totalBags: null as number | null, bagsPerHectare: null as number | null };
  }
  const totalBags = harvested.reduce((sum, s) => sum + Number(s.harvest_total_bags), 0);
  const area = harvested.reduce(
    (sum, s) => sum + (s.planted_area_ha ?? s.plot_area_ha),
    0,
  );
  return {
    totalBags,
    bagsPerHectare: area > 0 ? totalBags / area : null,
  };
}

export function RegisterHarvestDialog({
  open,
  onOpenChange,
  seasonId,
  plotLabel,
  pendingCount,
  plantedAreaHa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  plotLabel: string;
  pendingCount: number;
  plantedAreaHa: number;
}) {
  const register = useRegisterHarvest(seasonId);
  const [step, setStep] = useState<"confirm" | "bags">("confirm");
  const [harvestDate, setHarvestDate] = useState(todayLocalYmd());
  const [totalBags, setTotalBags] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("confirm");
    setHarvestDate(todayLocalYmd());
    setTotalBags("");
  }, [open]);

  const parsedTotal = Number(totalBags.replace(",", "."));
  const scHa = useMemo(() => {
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0 || plantedAreaHa <= 0) {
      return null;
    }
    return parsedTotal / plantedAreaHa;
  }, [parsedTotal, plantedAreaHa]);

  const handleConfirmDate = () => {
    if (!harvestDate) {
      toast.error("Informe a data da colheita.");
      return;
    }
    setStep("bags");
  };

  const handleSave = () => {
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      toast.error("Informe o total de sacas deste talhão.");
      return;
    }
    register.mutate(
      { harvest_date: harvestDate, total_bags: parsedTotal },
      {
        onSuccess: () => {
          toast.success("Colheita registrada.");
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(apiErrorMessage(err, "Não foi possível registrar a colheita.")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Registrar colheita</DialogTitle>
              <DialogDescription>{plotLabel}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              {pendingCount > 0 ? (
                <Alert>
                  <Wheat />
                  <AlertTitle>Etapas ainda pendentes</AlertTitle>
                  <AlertDescription>
                    Confirmar registra as {pendingCount}{" "}
                    {pendingCount === 1 ? "etapa pendente" : "etapas pendentes"}{" "}
                    como aplicadas na data da colheita. Etapas puladas
                    continuam puladas.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="harvest-date">Data da colheita</Label>
                <Input
                  id="harvest-date"
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmDate}>Continuar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Sacas colhidas</DialogTitle>
              <DialogDescription>
                Total deste talhão. O sc/ha sai da área plantada (
                {plantedAreaHa.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                ha).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="harvest-total">Total de sacas</Label>
                <Input
                  id="harvest-total"
                  inputMode="decimal"
                  placeholder="Ex: 1240"
                  value={totalBags}
                  onChange={(e) => setTotalBags(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {scHa != null
                  ? `${fmtScHa(scHa)} sc/ha neste talhão`
                  : "Informe o total para ver o rendimento por hectare."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("confirm")}>
                Voltar
              </Button>
              <Button disabled={register.isPending} onClick={handleSave}>
                {register.isPending ? "Registrando…" : "Confirmar colheita"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
