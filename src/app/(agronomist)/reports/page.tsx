"use client";

import dynamic from "next/dynamic";
import { BarChart3, Sprout } from "lucide-react";

import { PageHeader } from "@/components/domain/page-header";
import { ReportPageSkeleton } from "@/components/domain/page-skeletons";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { SectionTitle } from "@/components/ui/section-title";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { ComparativeReport } from "@/lib/api/client";
import { useComparativeReport } from "@/lib/api/hooks";

function harvestReportMockEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_REPORTS_MOCK_HARVEST;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "development";
}

const MOCK_REPORT_WITH_HARVESTS: ComparativeReport = {
  summary: {
    total_seasons: 7,
    harvested_seasons: 4,
    in_progress_seasons: 2,
    compliance_rate_pct: 92,
  },
  per_season: [
    {
      season_id: "demo-1",
      crop: "Soja",
      variety: "BMX Potência RR",
      plot_area_ha: 45.2,
      cost_per_ha_brl: 3840.5,
      bags_per_ha: 58.2,
      sale_price_per_bag_brl: 118,
    },
    {
      season_id: "demo-2",
      crop: "Soja",
      variety: "NS 5909 IPRO",
      plot_area_ha: 32.0,
      cost_per_ha_brl: 3621.0,
      bags_per_ha: 61.0,
      sale_price_per_bag_brl: 122,
    },
    {
      season_id: "demo-3",
      crop: "Milho",
      variety: "P30F53",
      plot_area_ha: 28.5,
      cost_per_ha_brl: 2980.75,
      bags_per_ha: 102.4,
      sale_price_per_bag_brl: 64,
    },
    {
      season_id: "demo-4",
      crop: "Soja",
      variety: "DM 5958 IPRO",
      plot_area_ha: 51.0,
      cost_per_ha_brl: 4102.2,
      bags_per_ha: 55.8,
      sale_price_per_bag_brl: 115,
    },
  ],
};

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);

export default function ReportsPage() {
  const showMock = harvestReportMockEnabled();
  const { data: apiReport, isLoading } = useComparativeReport();
  const report = showMock ? MOCK_REPORT_WITH_HARVESTS : apiReport;

  const chartData =
    report?.per_season.map((s, i) => ({
      name: s.variety ? `${s.crop} ${s.variety}` : `Safra ${i + 1}`,
      custo_ha: s.cost_per_ha_brl,
      sacas_ha: s.bags_per_ha ?? 0,
    })) ?? [];

  const tableRows =
    report?.per_season.map((s) => [
      s.crop,
      s.variety ?? "—",
      `${s.plot_area_ha} ha`,
      `R$ ${s.cost_per_ha_brl.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      s.bags_per_ha ? `${s.bags_per_ha} sc/ha` : "—",
    ]) ?? [];

  const showContent = showMock || apiReport;

  return (
    <>
      <PageHeader icon={<BarChart3 className="h-5 w-5" />} title="Relatórios" description="Custos por hectare e produtividade por safra." />

      {!showMock && isLoading ? <ReportPageSkeleton /> : null}

      {showContent && report && (
        <div className="space-y-6 animate-fade-in">
          <KpiStrip>
            <KpiCell label="Total de safras" value={String(report.summary.total_seasons)} />
            <KpiCell label="Colhidas" value={String(report.summary.harvested_seasons)} />
            <KpiCell label="Em andamento" value={String(report.summary.in_progress_seasons)} />
            <KpiCell
              label="Conformidade"
              value={
                report.summary.compliance_rate_pct !== null
                  ? `${report.summary.compliance_rate_pct}%`
                  : "—"
              }
              alert
            />
          </KpiStrip>

          {chartData.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <SectionTitle title="Custo por hectare" description="R$/ha por safra" className="mb-4" />
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip
                        cursor={{ fill: "var(--hover)" }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar dataKey="custo_ha" fill="var(--clay)" name="R$/ha" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-4">
                <SectionTitle title="Produtividade" description="sacas por hectare" className="mb-4" />
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip
                        cursor={{ fill: "var(--hover)" }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar dataKey="sacas_ha" fill="var(--primary)" name="sc/ha" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {tableRows.length > 0 ? (
            <DataTable
              headers={["Cultura", "Variedade", "Área", "Custo/ha", "Produtividade"]}
              rows={tableRows}
            />
          ) : null}

          {!showMock && report.per_season.length === 0 && (
            <EmptyState
              icon={BarChart3}
              title="Nenhuma safra colhida ainda"
              description="Os relatórios serão preenchidos automaticamente ao concluir colheitas."
            />
          )}
        </div>
      )}

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
