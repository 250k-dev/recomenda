"use client";

import dynamic from "next/dynamic";
import {
  BarChart3,
  Divide,
  Leaf,
  Package,
  Sprout,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/domain/page-header";
import { ReportPageSkeleton } from "@/components/domain/page-skeletons";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ReportsProductivityPanel } from "@/components/domain/reports/reports-productivity-panel";
import { ReportsCategoryPanel } from "@/components/domain/reports/reports-category-panel";
import { ReportsExportPanel } from "@/components/domain/reports/reports-export-panel";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { publicEnv } from "@recomenda/config";
import type { ComparativeReport } from "@recomenda/api";
import { useComparativeReport } from "@recomenda/api-hooks";
import {
  buildReportMetrics,
  formatReportCurrency,
  formatReportMargin,
} from "@recomenda/domain/reports/metrics";

function harvestReportMockEnabled(): boolean {
  const flag = publicEnv.NEXT_PUBLIC_REPORTS_MOCK_HARVEST;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "development";
}

const MOCK_REPORT: ComparativeReport = {
  summary: {
    total_seasons: 19,
    harvested_seasons: 19,
    in_progress_seasons: 0,
    compliance_rate_pct: 92,
    analyzed_seasons: 19,
    avg_cost_per_ha_brl: 4120,
    avg_bags_per_ha: 62,
    avg_margin_pct: 34,
    break_even_bags_per_ha: 48,
  },
  per_season: [
    {
      season_id: "demo-1",
      crop: "Soja",
      variety: "Brasmax Foco IPRO",
      plot_name: "T-01",
      plot_area_ha: 45.2,
      cost_per_ha_brl: 3920,
      bags_per_ha: 71,
      sale_price_per_bag_brl: 118,
    },
    {
      season_id: "demo-2",
      crop: "Soja",
      variety: "NS 8080",
      plot_name: "T-02",
      plot_area_ha: 32.0,
      cost_per_ha_brl: 4100,
      bags_per_ha: 64,
      sale_price_per_bag_brl: 118,
    },
    {
      season_id: "demo-3",
      crop: "Milho",
      variety: "safrinha",
      plot_name: "T-04",
      plot_area_ha: 28.5,
      cost_per_ha_brl: 3650,
      bags_per_ha: 52,
      sale_price_per_bag_brl: 72,
    },
    {
      season_id: "demo-4",
      crop: "Soja",
      variety: "NS 5959",
      plot_name: "T-03",
      plot_area_ha: 51.0,
      cost_per_ha_brl: 4280,
      bags_per_ha: 44,
      sale_price_per_bag_brl: 115,
    },
  ],
  category_breakdown: [
    { category: "FERTILIZER", share_pct: 38 },
    { category: "HERBICIDE", share_pct: 24 },
    { category: "FUNGICIDE", share_pct: 21 },
    { category: "INSECTICIDE", share_pct: 17 },
  ],
};

export default function ReportsPage() {
  const showMock = harvestReportMockEnabled();
  const { data: apiReport, isLoading } = useComparativeReport();
  const report = showMock ? MOCK_REPORT : apiReport;
  const metrics = report ? buildReportMetrics(report) : null;

  const showContent = showMock || apiReport;

  return (
    <>
      <PageHeader
        icon={<BarChart3 className="size-5" />}
        iconClassName="bg-ta-soft text-ta"
        section="Resultados"
        title="Relatórios"
        description="Comparativos e indicadores das suas safras."
      />

      {!showMock && isLoading ? <ReportPageSkeleton /> : null}

      {showContent && report && metrics ? (
        <div className="space-y-5 animate-fade-in">
          <KpiStrip>
            <KpiCell
              label="Safras analisadas"
              value={metrics.analyzedSeasons}
              icon={<Leaf className="size-4" />}
            />
            <KpiCell
              label="Custo médio / ha"
              value={formatReportCurrency(metrics.avgCost)}
              icon={<Divide className="size-4" />}
            />
            <KpiCell
              label="Produtividade média"
              value={
                <>
                  {Math.round(metrics.avgBags)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    sc/ha
                  </span>
                </>
              }
              icon={<Package className="size-4" />}
            />
            <KpiCell
              label="Margem média"
              value={formatReportMargin(metrics.avgMargin)}
              icon={<TrendingUp className="size-4" />}
              alert
            />
          </KpiStrip>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ReportsProductivityPanel
              rows={metrics.productivityRows}
              breakEven={metrics.breakEven}
              chartMax={metrics.chartMax}
            />

            <div className="flex flex-col gap-4">
              <ReportsCategoryPanel breakdown={metrics.categoryBreakdown} />
              <ReportsExportPanel />
            </div>
          </div>

          {!showMock && report.per_season.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Nenhuma safra colhida ainda"
              description="Os relatórios serão preenchidos automaticamente ao concluir colheitas."
            />
          ) : null}
        </div>
      ) : null}

      {!showContent && !isLoading ? (
        <EmptyState
          icon={Sprout}
          title="Sem dados disponíveis"
          description="Quando houver safras concluídas, os indicadores aparecem aqui."
        />
      ) : null}
    </>
  );
}
