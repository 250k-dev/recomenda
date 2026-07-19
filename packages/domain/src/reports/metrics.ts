import type { ComparativeReport, ReportPerSeason } from "@recomenda/api/reports";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function seasonDisplayLabel(season: ReportPerSeason): string {
  const cropVariety = season.variety
    ? `${season.crop} · ${season.variety}`
    : season.crop;
  return season.plot_name ? `${cropVariety} — ${season.plot_name}` : cropVariety;
}

export function buildReportMetrics(report: ComparativeReport) {
  const seasons = report.per_season;
  const productiveSeasons = seasons.filter(
    (season) => season.bags_per_ha != null && season.bags_per_ha > 0,
  );

  const avgCost =
    report.summary.avg_cost_per_ha_brl ??
    mean(seasons.map((season) => season.cost_per_ha_brl)) ??
    0;

  const avgBags =
    report.summary.avg_bags_per_ha ??
    mean(productiveSeasons.map((season) => season.bags_per_ha as number)) ??
    0;

  const margins =
    report.summary.avg_margin_pct != null
      ? [report.summary.avg_margin_pct]
      : seasons
          .filter(
            (season) =>
              season.bags_per_ha != null &&
              season.sale_price_per_bag_brl != null &&
              season.cost_per_ha_brl > 0,
          )
          .map((season) => {
            const revenue =
              (season.bags_per_ha as number) *
              (season.sale_price_per_bag_brl as number);
            return ((revenue - season.cost_per_ha_brl) / season.cost_per_ha_brl) * 100;
          });

  const avgMargin = mean(margins);

  const breakEvens =
    report.summary.break_even_bags_per_ha != null
      ? [report.summary.break_even_bags_per_ha]
      : seasons
          .filter(
            (season) =>
              season.sale_price_per_bag_brl != null &&
              season.sale_price_per_bag_brl > 0 &&
              season.cost_per_ha_brl > 0,
          )
          .map(
            (season) =>
              season.cost_per_ha_brl / (season.sale_price_per_bag_brl as number),
          );

  const breakEven = mean(breakEvens) ?? 0;

  const analyzedSeasons =
    report.summary.analyzed_seasons ?? productiveSeasons.length ?? seasons.length;

  const productivityRows = productiveSeasons
    .map((season) => ({
      id: season.season_id,
      label: seasonDisplayLabel(season),
      bagsPerHa: season.bags_per_ha as number,
    }))
    .sort((a, b) => b.bagsPerHa - a.bagsPerHa);

  const chartMax = Math.max(
    breakEven,
    ...productivityRows.map((row) => row.bagsPerHa),
    1,
  );

  return {
    analyzedSeasons,
    avgCost,
    avgBags,
    avgMargin,
    breakEven,
    chartMax,
    productivityRows,
    categoryBreakdown: report.category_breakdown ?? [],
  };
}

export function formatReportCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatReportMargin(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
}
