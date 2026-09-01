"use client";

import { useId, useMemo, useState } from "react";
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
import { useCyclePurchaseList, useUpdateSeasonVarieties } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { SEED_CATEGORIES } from "@recomenda/domain/purchase-list/list-item";
import { fmt } from "@/components/domain/season/_shared";

export type SeasonCropVarietyDraft = {
  variety: string;
  planted_area_ha: number | null;
  thousand_plants_per_ha: number | null;
};

type Row = {
  id: string;
  variety: string;
  plantedArea: string;
  population: string;
};

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `variety-${rowSeq}`;
}

function parseNum(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function areaLabel(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function sumPlantedArea(rows: Row[]): number {
  return rows.reduce((sum, row) => {
    const n = parseNum(row.plantedArea);
    return sum + (n ?? 0);
  }, 0);
}

function rowsFromInitial(
  initial: SeasonCropVarietyDraft[] | undefined,
  fallbackVariety: string | null | undefined,
  plotAreaHa: number | null | undefined,
): Row[] {
  const plotArea = plotAreaHa != null && plotAreaHa > 0 ? String(plotAreaHa) : "";
  const list = (initial ?? []).filter((v) => v.variety.trim());
  if (list.length > 0) {
    return list.map((v, index) => ({
      id: nextRowId(),
      variety: v.variety,
      plantedArea:
        areaLabel(v.planted_area_ha) || (list.length === 1 && index === 0 ? plotArea : ""),
      population: areaLabel(v.thousand_plants_per_ha),
    }));
  }
  return [
    {
      id: nextRowId(),
      variety: fallbackVariety?.trim() ?? "",
      plantedArea: plotArea,
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
  plotAreaHa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  cycleId?: string | null;
  crop?: string | null;
  initialVarieties?: SeasonCropVarietyDraft[];
  fallbackVariety?: string | null;
  plotAreaHa?: number | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <EditSeasonCropForm
          seasonId={seasonId}
          cycleId={cycleId}
          crop={crop}
          initialVarieties={initialVarieties}
          fallbackVariety={fallbackVariety}
          plotAreaHa={plotAreaHa}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function EditSeasonCropForm({
  seasonId,
  cycleId,
  crop,
  initialVarieties,
  fallbackVariety,
  plotAreaHa,
  onClose,
}: {
  seasonId: string;
  cycleId?: string | null;
  crop?: string | null;
  initialVarieties?: SeasonCropVarietyDraft[];
  fallbackVariety?: string | null;
  plotAreaHa?: number | null;
  onClose: () => void;
}) {
  const { data: purchaseList } = useCyclePurchaseList(cycleId ?? "");
  const updateMut = useUpdateSeasonVarieties(seasonId);
  const datalistId = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromInitial(initialVarieties, fallbackVariety, plotAreaHa),
  );

  const seedOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      if (crop && item.crop && item.crop !== crop) continue;
      names.add(item.product_name);
    }
    for (const row of initialVarieties ?? []) {
      const name = row.variety.trim();
      if (name) names.add(name);
    }
    const fallback = fallbackVariety?.trim();
    if (fallback) names.add(fallback);
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [purchaseList, crop, initialVarieties, fallbackVariety]);

  const popByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      const pop = Number(item.thousand_plants_per_ha ?? 0);
      if (pop > 0) map.set(item.product_name, pop);
    }
    return map;
  }, [purchaseList]);

  const seedAreaByVariety = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      if (crop && item.crop && item.crop !== crop) continue;
      const area = Number(item.seeding_area_ha ?? 0);
      if (area > 0) map.set(item.product_name, area);
    }
    return map;
  }, [purchaseList, crop]);

  const cadastral = plotAreaHa != null && plotAreaHa > 0 ? plotAreaHa : 0;
  const planted = (() => {
    const sum = sumPlantedArea(rows);
    if (
      sum === 0 &&
      rows.length === 1 &&
      cadastral > 0 &&
      !rows[0]?.plantedArea
    ) {
      return cadastral;
    }
    return sum;
  })();
  const overPlot = cadastral > 0 && planted > cadastral;

  const allocatedForVariety = (name: string): number =>
    rows.reduce((sum, row) => {
      if (row.variety.trim() !== name) return sum;
      return sum + (parseNum(row.plantedArea) ?? 0);
    }, 0);

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
    const varieties: Array<{
      variety: string;
      planted_area_ha: number | null;
      thousand_plants_per_ha: number | null;
    }> = [];
    for (const row of rows) {
      const variety = row.variety.trim();
      if (!variety) continue;
      const fromList = !row.population ? popByName.get(row.variety) : undefined;
      const areaValue =
        row.plantedArea ||
        (rows.length === 1 && cadastral > 0 ? String(cadastral) : "");
      varieties.push({
        variety,
        planted_area_ha: parseNum(areaValue),
        thousand_plants_per_ha:
          parseNum(row.population) ??
          (fromList != null && fromList > 0 ? fromList : null),
      });
    }
    if (varieties.length === 0) {
      toast.error("Selecione pelo menos um cultivar.");
      return;
    }
    updateMut.mutate(varieties, {
      onSuccess: () => {
        toast.success("Cultivar e população atualizados.");
        onClose();
      },
      onError: (e: unknown) => {
        toast.error(apiErrorMessage(e, "Não foi possível salvar o cultivo."));
      },
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Editar cultivo do talhão</DialogTitle>
        <DialogDescription>
          Troque as variedades/híbridos já selecionados e os hectares de cada
          uma. A lista de compra da safra continua como referência; só este
          talhão muda.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            Variedades / Híbridos
          </span>
          {planted > 0 && cadastral > 0 ? (
            <span
              className={
                overPlot
                  ? "text-xs tabular-nums text-warning-strong"
                  : "text-xs tabular-nums text-muted-foreground"
              }
            >
              {fmt(planted)} de {fmt(cadastral)} ha
            </span>
          ) : null}
        </div>

        {rows.map((row, index) => {
          const name = row.variety.trim();
          const listArea = name ? seedAreaByVariety.get(name) : undefined;
          const allocated = name ? allocatedForVariety(name) : 0;
          const overList = listArea != null && allocated > listArea;
          const listPop = popByName.get(row.variety);
          return (
            <div key={row.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Cultivar</Label>
                  <Input
                    list={seedOptions.length > 0 ? datalistId : undefined}
                    value={row.variety}
                    onChange={(e) => handleVarietyChange(index, e.target.value)}
                    placeholder={
                      seedOptions.length > 0
                        ? "Selecione ou digite"
                        : "Ex: BMX Potência RR"
                    }
                    aria-label={`Variedade ${index + 1}`}
                  />
                </div>
                <div className="w-28 shrink-0 space-y-1">
                  <Label className="text-xs text-muted-foreground">Plantas/ha</Label>
                  <Input
                    inputMode="decimal"
                    value={row.population || (listPop != null ? String(listPop) : "")}
                    onChange={(e) =>
                      updateRow(index, { population: e.target.value })
                    }
                    placeholder="280000"
                  />
                </div>
                <div className="w-24 shrink-0 space-y-1">
                  <Label className="text-xs text-muted-foreground">Área (ha)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      row.plantedArea ||
                      (rows.length === 1 && cadastral > 0 ? String(cadastral) : "")
                    }
                    onChange={(e) =>
                      updateRow(index, { plantedArea: e.target.value })
                    }
                    placeholder="ha"
                    aria-label={`Área da variedade ${index + 1} (ha)`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-6 shrink-0 text-muted-foreground hover:text-danger-strong"
                  disabled={rows.length <= 1}
                  title="Remover esta variedade"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {listArea != null ? (
                <p
                  className={
                    overList
                      ? "text-xs tabular-nums text-warning-strong"
                      : "text-xs tabular-nums text-muted-foreground"
                  }
                >
                  Na lista de compra: {fmt(listArea)} ha
                  {overList
                    ? ` — alocado ${fmt(allocated)} ha, acima do que os bags cobrem`
                    : ""}
                </p>
              ) : null}
            </div>
          );
        })}

        {seedOptions.length > 0 ? (
          <datalist id={datalistId}>
            {seedOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 text-primary-strong"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { id: nextRowId(), variety: "", plantedArea: "", population: "" },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Adicionar variedade
        </Button>

        {cadastral > 0 ? (
          overPlot ? (
            <p className="text-xs text-warning-strong">
              As variedades somam {fmt(planted)} ha, acima dos {fmt(cadastral)}{" "}
              ha cadastrados — liberado, só confira a área do talhão.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Talhão tem {fmt(cadastral)} ha. Divida a área entre as variedades
              (ex.: 15 ha de cada).
            </p>
          )
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
