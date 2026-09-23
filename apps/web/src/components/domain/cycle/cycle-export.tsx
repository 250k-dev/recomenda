"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";
import { EXPORT_ACTION_CLASS } from "@/components/domain/export-action-class";
import {
  queryKeys,
  useCycle,
  useCyclePurchaseList,
  useMe,
  useProducer,
  useProducerStock,
} from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";
import { getTimeline, type Recommendation } from "@recomenda/api/seasons";
import type { DocumentCover } from "@recomenda/domain/recommendations/print-document";
import type {
  FieldSheet,
  FieldSheetRow,
  NotebookModelBlock,
  NotebookPlotRow,
  SeasonNotebookData,
} from "@recomenda/domain/season-notebook/notebook-document";
import { windowToTargetDay } from "@recomenda/domain/timing/window-days";
import type { StockExportItem } from "@recomenda/domain/stock/stock-export";
import {
  FarmSeasonsExportDialog,
  type FarmExportItem,
} from "@/components/domain/farm-seasons-export-dialog";
import {
  CROP_LABELS,
  PRODUCT_CATEGORY_LABELS,
  STATUS_LABELS,
  labelStatus,
} from "@recomenda/utils";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

function byPlotName(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

function stageKey(name: string): string {
  return name.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Cada bloco da safra é um modelo (template salvo ou montado na hora) aplicado
 * a um conjunto de talhões. O cronograma do talhão é o modelo: a timeline nem
 * sempre traz o id, então o vínculo também sai pelo conjunto de etapas.
 */
function modelsFromCycle(
  blocks: Array<{
    timing_template_id: string;
    template_name: string;
    stage_names: string[];
    plots?: Array<{ plot_name: string; farm_name: string }>;
  }>,
  items: FarmExportItem[],
): NotebookModelBlock[] {
  const owner = new Map<string, string>();
  for (const item of items) {
    let best: { id: string; score: number } | null = null;
    const names = new Set(item.data.recommendations.map((rec) => stageKey(rec.name)));
    for (const block of blocks) {
      const byId = item.data.recommendations.some(
        (rec) => rec.source_timing_template_id === block.timing_template_id,
      );
      let score = 0;
      if (byId) {
        score = 1_000_000;
      } else if (names.size > 0 && block.stage_names.length > 0) {
        const hit = block.stage_names.filter((name) => names.has(stageKey(name))).length;
        if (hit === block.stage_names.length) {
          score = hit * 1000 - Math.abs(names.size - block.stage_names.length);
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: block.timing_template_id, score };
      }
    }
    if (best) owner.set(item.id, best.id);
  }

  return blocks.flatMap((block) => {
    const members = items
      .filter((item) => owner.get(item.id) === block.timing_template_id)
      .sort((a, b) =>
        byPlotName(a.data.plotName ?? a.label, b.data.plotName ?? b.label),
      );
    const fromBlock = (block.plots ?? []).map((plot) => ({
      plotName: plot.plot_name,
      farmName: plot.farm_name,
    }));
    const fromItems = members.map((item) => ({
      plotName: item.data.plotName ?? item.label.replace(/^Talhão\s+/i, ""),
      farmName: item.data.spec?.farmName ?? null,
    }));
    const plots = (fromBlock.length > 0 ? fromBlock : fromItems).sort((a, b) =>
      byPlotName(a.plotName, b.plotName),
    );
    const source = members[0];
    const all = source?.data.recommendations ?? [];
    const wanted = new Set(block.stage_names.map(stageKey));
    const byTemplate = all.filter(
      (rec) => rec.source_timing_template_id === block.timing_template_id,
    );
    const byStage = all.filter((rec) => wanted.has(stageKey(rec.name)));
    const recommendations = (byTemplate.length > 0 ? byTemplate : byStage)
      .slice()
      .sort((a, b) => a.order_index - b.order_index);
    if (recommendations.length === 0 && plots.length === 0) return [];
    return [{ name: block.template_name, plots, recommendations }];
  });
}

function plotKey(farm: string | null | undefined, plot: string): string {
  return `${(farm ?? "").trim().toLocaleLowerCase("pt-BR")}\0${plot.trim().toLocaleLowerCase("pt-BR")}`;
}

function compareFieldRows(a: FieldSheetRow, b: FieldSheetRow): number {
  return byPlotName(a.farmName ?? "", b.farmName ?? "") || byPlotName(a.plotName, b.plotName);
}

/** A dose impressa no caderno usa a unidade da lista de compra, não a da etapa. */
function withPurchaseListUnits(
  recommendations: Recommendation[],
  unitByProduct: Map<string, string>,
): Recommendation[] {
  if (unitByProduct.size === 0) return recommendations;
  return recommendations.map((rec) => ({
    ...rec,
    items: rec.items.map((item) => {
      const unit = unitByProduct.get(item.local_product_id);
      if (!unit || unit === item.dose_unit) return item;
      return { ...item, dose_unit: unit };
    }),
  }));
}

/**
 * Uma grade por conjunto de etapas. Talhão sem modelo entra numa grade só
 * com as colunas fixas (plantio, ciclo, colheita).
 */
function fieldSheetsFrom(
  models: NotebookModelBlock[],
  seasons: Array<{
    plot_name: string;
    farm_name?: string | null;
    plot_area_ha: number | null;
    variety: string | null;
    varieties?: Array<{ variety: string }>;
    planting_date: string | null;
    cycle_days: number | null;
  }>,
): FieldSheet[] {
  const rowFrom = (season: (typeof seasons)[number]): FieldSheetRow => ({
    farmName: season.farm_name ?? null,
    plotName: season.plot_name,
    variety:
      (season.varieties ?? []).map((item) => item.variety).filter(Boolean).join(", ") ||
      season.variety ||
      null,
    areaHa: season.plot_area_ha,
    plantingDate: season.planting_date,
    cycleDays: season.cycle_days,
  });
  const byPlot = new Map(
    seasons.map((season) => [plotKey(season.farm_name, season.plot_name), season]),
  );
  const used = new Set<string>();
  const buckets = new Map<string, FieldSheet>();

  for (const model of models) {
    const stages = model.recommendations
      .map((rec) => ({
        name: rec.name,
        dap: windowToTargetDay(rec.window_start_days, rec.window_end_days),
        order: rec.order_index,
      }))
      .sort((a, b) => a.dap - b.dap || a.order - b.order)
      .map(({ name, dap }) => ({ name, dap }));
    const signature = stages.map((stage) => `${stage.dap}:${stageKey(stage.name)}`).join("|");
    const bucket = buckets.get(signature) ?? {
      modelName: model.name,
      stages,
      rows: [],
    };
    for (const plot of model.plots) {
      const key = plotKey(plot.farmName, plot.plotName);
      if (used.has(key)) continue;
      used.add(key);
      const season = byPlot.get(key);
      bucket.rows.push(
        season
          ? rowFrom(season)
          : {
              farmName: plot.farmName,
              plotName: plot.plotName,
              variety: null,
              areaHa: null,
              plantingDate: null,
              cycleDays: null,
            },
      );
    }
    if (bucket.rows.length > 0) buckets.set(signature, bucket);
  }

  const leftover = seasons
    .filter((season) => !used.has(plotKey(season.farm_name, season.plot_name)))
    .map(rowFrom);
  const sheets = [...buckets.values()];
  if (leftover.length > 0) {
    sheets.push({
      modelName: sheets.length > 0 ? "Sem modelo" : null,
      stages: [],
      rows: leftover,
    });
  }
  const several = sheets.length > 1;
  return sheets.map((sheet) => ({
    ...sheet,
    modelName: several ? sheet.modelName : null,
    rows: [...sheet.rows].sort(compareFieldRows),
  }));
}

/**
 * Exporta a safra aberta (PDF/WhatsApp), não a primeira da fazenda.
 * Sem cronograma o botão não aparece.
 */
export function CycleExportButton({
  cycleId,
  producerId,
}: {
  cycleId: string;
  producerId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: cycle, isLoading: loadingCycle } = useCycle(cycleId);
  const { data: producer } = useProducer(producerId);
  // Lido fora dos memos: o React Compiler infere `producer` e reclama de
  // dependência menos específica que `producer?.name`.
  const producerName = producer?.name ?? null;
  const { data: me } = useMe();
  const canViewPrices = useCan("PRICE_VIEW");
  // Sem PRICE_VIEW a lista vem sem preço, mas o Caderno de Safra precisa dela
  // de qualquer forma (produtos, doses, volumes). A tela da safra já busca esta
  // mesma query, então na prática sai do cache.
  const { data: purchaseList } = useCyclePurchaseList(cycleId);
  // Estoque é do galpão do produtor, não da safra: safra de arquivo (backfill)
  // não o inclui — o retrato daquela safra é outro. Só busca com o modal aberto.
  const includeStock = open && !cycle?.backfill;
  const { data: stock, isLoading: loadingStock } = useProducerStock(
    includeStock ? producerId : "",
  );

  const hasSchedule = (cycle?.seasons ?? []).some(
    (season) => season.recommendations_total > 0,
  );

  const unitPrices = useMemo(() => {
    if (!canViewPrices) return undefined;
    const map: Record<string, number> = {};
    for (const item of purchaseList?.items ?? []) {
      const price = Number(item.unit_price_brl);
      if (price > 0 && map[item.local_product_id] == null) {
        map[item.local_product_id] = price;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [canViewPrices, purchaseList]);

  // Memoizado: `?? []` cria um array novo a cada render e faria os memos de
  // itens/capa recalcularem sempre.
  const seasons = useMemo(() => cycle?.seasons ?? [], [cycle]);
  const timelineQueries = useQueries({
    queries: seasons.map((season) => ({
      queryKey: queryKeys.seasonTimeline(season.id),
      queryFn: () => getTimeline(season.id),
      enabled: open && Boolean(cycleId),
    })),
  });
  const exportLoading =
    loadingCycle ||
    loadingStock ||
    (open && timelineQueries.some((query) => query.isLoading));

  const items = useMemo<FarmExportItem[]>(() => {
    if (!cycle) return [];
    return seasons.reduce<FarmExportItem[]>((acc, season, index) => {
      const rows = timelineQueries[index]?.data;
      const recommendations = (
        Array.isArray(rows) ? rows : []
      ) as Recommendation[];
      if (recommendations.length === 0) return acc;

      const cropLabel = CROP_LABELS[season.crop] ?? season.crop;
      const title = season.variety
        ? `${cropLabel} — ${season.variety}`
        : cropLabel;
      const done = recommendations.filter((rec) =>
        APPLIED.has(rec.status),
      ).length;

      acc.push({
        id: season.id,
        label: `Talhão ${season.plot_name}`,
        data: {
          title,
          plotName: season.plot_name,
          plantingDate: season.planting_date,
          statusLabel: labelStatus(STATUS_LABELS, season.status),
          producerName,
          agronomistName: me?.name ?? null,
          done,
          total: recommendations.length,
          recommendations,
          spec: {
            farmName: season.farm_name ?? null,
            farmLocation:
              cycle.farms.find((f) => f.id === season.farm_id)?.location ??
              null,
            cycleName: cycle.name,
            cropLabel,
            areaHa: season.plot_area_ha,
            plantedAreaHa: season.planted_area_ha,
            varieties: (season.varieties ?? []).map((v) => ({
              variety: v.variety,
              plantedAreaHa: v.planted_area_ha,
              thousandPlantsPerHa: v.thousand_plants_per_ha ?? null,
            })),
            spacingM: purchaseList?.spacing_m ?? null,
            cycleDays: season.cycle_days,
            desiccationDate: season.desiccation_date,
          },
          unitPriceByProduct: unitPrices,
        },
      });
      return acc;
    }, []);
  }, [cycle, me?.name, producerName, purchaseList, seasons, timelineQueries, unitPrices]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        byPlotName(a.data.plotName ?? a.label, b.data.plotName ?? b.label),
      ),
    [items],
  );

  const cover = useMemo<DocumentCover | null>(() => {
    if (!cycle) return null;
    const areaHa = seasons.reduce((sum, s) => sum + (s.plot_area_ha ?? 0), 0);
    const farms = new Set(seasons.map((s) => s.farm_id ?? cycle.farm_id));
    const crops = cycle.crops
      .map((crop) => CROP_LABELS[crop] ?? crop)
      .join(" e ");
    const stats: DocumentCover["stats"] = [];
    if (farms.size > 1) stats.push({ label: "Fazendas", value: String(farms.size) });
    stats.push({ label: "Talhões", value: String(seasons.length) });
    stats.push({
      label: "Área",
      value: `${areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`,
    });
    return {
      kicker: "Programação da safra",
      title: cycle.name,
      tags: [
        ...(producerName ? [`Produtor: ${producerName}`] : []),
        ...(farms.size === 1 && seasons[0]?.farm_name
          ? [`Fazenda ${seasons[0].farm_name}`]
          : []),
        ...(crops ? [crops] : []),
      ],
      stats,
    };
  }, [cycle, producerName, seasons]);

  const stockItems = useMemo<StockExportItem[]>(() => {
    if (!includeStock) return [];
    return (stock ?? []).map((item) => {
      const price =
        item.price_brl != null && Number.isFinite(Number(item.price_brl))
          ? Number(item.price_brl)
          : null;
      const quantity = Number(item.quantity) || 0;
      const category = item.category ?? "";
      return {
        product_name: item.product_name ?? "Produto",
        category,
        category_label:
          PRODUCT_CATEGORY_LABELS[
            category as keyof typeof PRODUCT_CATEGORY_LABELS
          ] ?? category,
        quantity,
        dose_unit: item.dose_unit ?? "",
        price_brl: price,
        value_brl: price != null ? price * quantity : null,
      };
    });
  }, [includeStock, stock]);

  /** Talhão · material (variedade) · área — ordenado como o produtor lê. */
  const notebookPlots = useMemo<NotebookPlotRow[]>(
    () =>
      seasons
        .map((season) => ({
          plotName: season.plot_name,
          farmName: season.farm_name ?? null,
          material:
            (season.varieties ?? []).map((v) => v.variety).join(", ") ||
            season.variety ||
            null,
          areaHa: season.plot_area_ha ?? null,
        }))
        .sort((a, b) => byPlotName(a.plotName, b.plotName)),
    [seasons],
  );

  const notebook = useMemo<SeasonNotebookData | null>(() => {
    if (!cycle) return null;
    const farmNames = [
      ...new Set(
        seasons
          .map((season) => season.farm_name)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const models = modelsFromCycle(cycle.blocks ?? [], sortedItems);
    const unitByProduct = new Map<string, string>();
    for (const item of purchaseList?.items ?? []) {
      if (!unitByProduct.has(item.local_product_id)) {
        unitByProduct.set(item.local_product_id, item.dose_unit);
      }
    }
    const modelsForNotebook = models.map((model) => ({
      ...model,
      recommendations: withPurchaseListUnits(model.recommendations, unitByProduct),
    }));
    return {
      cycleName: cycle.name,
      producerName,
      agronomistName: me?.name ?? null,
      farmNames: farmNames.length ? farmNames : cycle.farms.map((f) => f.name),
      cropLabels: cycle.crops.map((crop) => CROP_LABELS[crop] ?? crop),
      plots: notebookPlots,
      models: modelsForNotebook,
      purchaseList: purchaseList ?? null,
      stockItems,
      schedule: sortedItems.map((item) => ({
        ...item.data,
        recommendations: withPurchaseListUnits(
          item.data.recommendations,
          unitByProduct,
        ),
      })),
      fieldSheets: fieldSheetsFrom(models, seasons),
      note: cycle.backfill
        ? "Arquivo de safra: o estoque do galpão de hoje não entra neste caderno."
        : null,
    };
  }, [
    cycle,
    sortedItems,
    me?.name,
    notebookPlots,
    producerName,
    purchaseList,
    seasons,
    stockItems,
  ]);

  if (!hasSchedule) return null;

  return (
    <>
      <Button
        className={cn("gap-1.5", EXPORT_ACTION_CLASS)}
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-4" />
        Exportar
      </Button>
      <FarmSeasonsExportDialog
        open={open}
        onOpenChange={setOpen}
        farmName={cycle?.name ?? null}
        contextLabel="SAFRA"
        isLoading={exportLoading}
        items={sortedItems}
        cover={cover}
        notebook={notebook}
        notebookUnavailable={
          cycle?.backfill
            ? { stock: "Safra de arquivo: o estoque de hoje não é o desta safra." }
            : undefined
        }
      />
    </>
  );
}
