"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import { useCyclePurchaseList, useUpdateSeasonVarieties } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { SEED_CATEGORIES } from "@recomenda/domain/purchase-list/list-item";

export type SeasonCropVarietyDraft = {
  variety: string;
  planted_area_ha: number | null;
  thousand_plants_per_ha: number | null;
};

type Row = {
  variety: string;
  plantedArea: string;
  population: string;
};

function parseNum(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rowsFromInitial(
  initial: SeasonCropVarietyDraft[] | undefined,
  fallbackVariety?: string | null,
): Row[] {
  const list = (initial ?? []).filter((v) => v.variety.trim());
  if (list.length > 0) {
    return list.map((v) => ({
      variety: v.variety,
      plantedArea: v.planted_area_ha != null ? String(v.planted_area_ha) : "",
      population:
        v.thousand_plants_per_ha != null ? String(v.thousand_plants_per_ha) : "",
    }));
  }
  return [
    {
      variety: fallbackVariety?.trim() ?? "",
      plantedArea: "",
      population: "",
    },
  ];
}

export function EditSeasonCropDialog({
  open,
  onOpenChange,
  seasonId,
  cycleId,
  crop,
  initialVarieties,
  fallbackVariety,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  cycleId?: string | null;
  crop?: string | null;
  initialVarieties?: SeasonCropVarietyDraft[];
  fallbackVariety?: string | null;
}) {
  const { data: purchaseList } = useCyclePurchaseList(cycleId ?? "");
  const updateMut = useUpdateSeasonVarieties(seasonId);
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromInitial(initialVarieties, fallbackVariety),
  );

  const seedOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      if (crop && item.crop && item.crop !== crop) continue;
      names.add(item.product_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [purchaseList, crop]);

  const popByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      const pop = Number(item.thousand_plants_per_ha ?? 0);
      if (pop > 0) map.set(item.product_name, pop);
    }
    return map;
  }, [purchaseList]);

  useEffect(() => {
    if (!open) return;
    const next = rowsFromInitial(initialVarieties, fallbackVariety);
    setRows(
      next.map((row) => {
        if (row.population) return row;
        const fromList = popByName.get(row.variety);
        return fromList
          ? { ...row, population: String(fromList) }
          : row;
      }),
    );
  }, [open, initialVarieties, fallbackVariety, popByName]);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleVarietyChange = (index: number, variety: string) => {
    const fromList = popByName.get(variety);
    updateRow(index, {
      variety,
      ...(fromList && !rows[index]?.population
        ? { population: String(fromList) }
        : {}),
    });
  };

  const handleSave = () => {
    const varieties = rows
      .map((row) => ({
        variety: row.variety.trim(),
        planted_area_ha: parseNum(row.plantedArea),
        thousand_plants_per_ha: parseNum(row.population),
      }))
      .filter((v) => v.variety.length > 0);
    if (varieties.length === 0) {
      toast.error("Selecione pelo menos um cultivar.");
      return;
    }
    updateMut.mutate(varieties, {
      onSuccess: () => {
        toast.success("Cultivar e população atualizados.");
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        toast.error(apiErrorMessage(e, "Não foi possível salvar o cultivo."));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cultivo do talhão</DialogTitle>
          <DialogDescription>
            Altere o cultivar e a população deste talhão. A lista de compra da
            safra continua como referência; só este talhão muda.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_8rem_7rem_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cultivar</Label>
                {seedOptions.length > 0 ? (
                  <Select
                    value={row.variety}
                    onValueChange={(value) => handleVarietyChange(index, value)}
                    placeholder="Selecione…"
                    options={seedOptions.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                  />
                ) : (
                  <Input
                    value={row.variety}
                    onChange={(e) => updateRow(index, { variety: e.target.value })}
                    placeholder="Nome do cultivar"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Plantas/ha</Label>
                <Input
                  inputMode="decimal"
                  value={row.population}
                  onChange={(e) => updateRow(index, { population: e.target.value })}
                  placeholder="280000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Área (ha)</Label>
                <Input
                  inputMode="decimal"
                  value={row.plantedArea}
                  onChange={(e) => updateRow(index, { plantedArea: e.target.value })}
                  placeholder="—"
                />
              </div>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="self-end text-muted-foreground hover:text-danger-strong"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          ))}
          {seedOptions.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { variety: "", plantedArea: "", population: "" },
                ])
              }
            >
              <Plus className="size-3.5" />
              Outro cultivar
            </Button>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
