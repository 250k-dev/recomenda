"use client";

import { useMemo, useState } from "react";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import { useCyclePurchaseList, useUpdateSeasonVarieties } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { SEED_CATEGORIES } from "@recomenda/domain/purchase-list/list-item";
import { fmt } from "@/components/domain/season/_shared";

export type SeasonCropVarietyDraft = {
  variety: string;
  planted_area_ha: number | null;
  thousand_plants_per_ha: number | null;
};

/** `null` = o usuário não mexeu (mostra a sugestão da lista/talhão);
 *  `""` = apagou de propósito (fica vazio e salva sem valor). */
type Row = {
  id: string;
  variety: string;
  plantedArea: string | null;
  population: string | null;
};

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `variety-${rowSeq}`;
}

function parseNum(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function areaLabel(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
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
  const plotArea = plotAreaHa != null && plotAreaHa > 0 ? String(plotAreaHa) : null;
  const list = (initial ?? []).filter((v) => v.variety.trim());
  if (list.length > 0) {
    return list.map((v, index) => ({
      id: nextRowId(),
      variety: v.variety,
      plantedArea:
        areaLabel(v.planted_area_ha) ?? (list.length === 1 && index === 0 ? plotArea : null),
      population: areaLabel(v.thousand_plants_per_ha),
    }));
  }
  return [
    {
      id: nextRowId(),
      variety: fallbackVariety?.trim() ?? "",
      plantedArea: plotArea,
      population: null,
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
  const { data: purchaseList, isLoading: listLoading } = useCyclePurchaseList(
    cycleId ?? "",
  );
  const updateMut = useUpdateSeasonVarieties(seasonId);
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromInitial(initialVarieties, fallbackVariety, plotAreaHa),
  );

  /** Só as sementes da lista de compra da safra (cultura do talhão): variedade
   *  fora da lista não puxa estoque nem preço. */
  const seedOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of purchaseList?.items ?? []) {
      if (!SEED_CATEGORIES.includes(item.category)) continue;
      if (crop && item.crop && item.crop !== crop) continue;
      names.add(item.product_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [purchaseList, crop]);

  const seedByKey = useMemo(
    () => new Map(seedOptions.map((name) => [nameKey(name), name])),
    [seedOptions],
  );
  /** Grafia da lista quando só muda maiúscula/espaço (o backend casa assim). */
  const canonical = (variety: string): string =>
    seedByKey.get(nameKey(variety)) ?? variety.trim();

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
      rows[0]?.plantedArea == null
    ) {
      return cadastral;
    }
    return sum;
  })();
  const overPlot = cadastral > 0 && planted > cadastral;

  const allocatedForVariety = (name: string): number =>
    rows.reduce((sum, row) => {
      if (canonical(row.variety) !== name) return sum;
      return sum + (parseNum(row.plantedArea) ?? 0);
    }, 0);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleVarietyChange = (index: number, variety: string) => {
    updateRow(index, { variety });
  };

  const handleSave = () => {
    const varieties: Array<{
      variety: string;
      planted_area_ha: number | null;
      thousand_plants_per_ha: number | null;
    }> = [];
    for (const row of rows) {
      const variety = canonical(row.variety);
      if (!variety) continue;
      const fromList = row.population == null ? popByName.get(variety) : undefined;
      const areaValue =
        row.plantedArea ??
        (rows.length === 1 && cadastral > 0 ? String(cadastral) : null);
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
          const name = canonical(row.variety);
          const listArea = name ? seedAreaByVariety.get(name) : undefined;
          const allocated = name ? allocatedForVariety(name) : 0;
          const overList = listArea != null && allocated > listArea;
          const listPop = popByName.get(name);
          const outOfList = !!name && !seedByKey.has(nameKey(name));
          return (
            <div key={row.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Cultivar</Label>
                  <NativeSelect
                    className="w-full"
                    value={name}
                    onChange={(e) => handleVarietyChange(index, e.target.value)}
                    aria-label={`Variedade ${index + 1}`}
                  >
                    <NativeSelectOption value="">
                      {listLoading ? "Carregando…" : "Selecione"}
                    </NativeSelectOption>
                    {outOfList ? (
                      <NativeSelectOption value={name}>
                        {name} (fora da lista)
                      </NativeSelectOption>
                    ) : null}
                    {seedOptions.map((option) => (
                      <NativeSelectOption key={option} value={option}>
                        {option}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-28 shrink-0 space-y-1">
                  <Label className="text-xs text-muted-foreground">Plantas/ha</Label>
                  <Input
                    inputMode="decimal"
                    value={row.population ?? (listPop != null ? String(listPop) : "")}
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
                      row.plantedArea ??
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
              {outOfList && !listLoading ? (
                <p className="text-xs text-warning-strong">
                  Este cultivar não está na lista de compra da safra — não puxa
                  estoque nem preço. Escolha uma semente da lista.
                </p>
              ) : null}
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

        {!listLoading && seedOptions.length === 0 ? (
          <p className="text-xs text-warning-strong">
            A lista de compra desta safra não tem sementes. Cadastre a semente na
            lista de compra para poder escolhê-la aqui.
          </p>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 text-primary-strong"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { id: nextRowId(), variety: "", plantedArea: null, population: null },
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
