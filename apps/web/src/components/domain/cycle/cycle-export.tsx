"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  queryKeys,
  useCycle,
  useCyclePurchaseList,
  useMe,
  useProducer,
} from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";
import { getTimeline, type Recommendation } from "@recomenda/api/seasons";
import type { DocumentCover } from "@recomenda/domain/recommendations/print-document";
import {
  FarmSeasonsExportDialog,
  type FarmExportItem,
} from "@/components/domain/farm-seasons-export-dialog";
import { CROP_LABELS, STATUS_LABELS, labelStatus } from "@recomenda/utils";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

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
  const { data: purchaseList } = useCyclePurchaseList(
    canViewPrices ? cycleId : "",
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
    loadingCycle || (open && timelineQueries.some((query) => query.isLoading));

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

  if (!hasSchedule) return null;

  return (
    <>
      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-4 text-muted-foreground" />
        Exportar
      </Button>
      <FarmSeasonsExportDialog
        open={open}
        onOpenChange={setOpen}
        farmName={cycle?.name ?? null}
        contextLabel="SAFRA"
        isLoading={exportLoading}
        items={items}
        cover={cover}
      />
    </>
  );
}
