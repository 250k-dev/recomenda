"use client";

import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { ReportPageSkeleton } from "@/components/domain/page-skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import type { ComparativeReport } from "@/lib/api/client";
import { useComparativeReport } from "@/lib/api/hooks";

/**
 * Pré-visualização com colheitas fictícias (gráficos + tabela).
 * - Em desenvolvimento: ligado por padrão.
 * - Desligar: `NEXT_PUBLIC_REPORTS_MOCK_HARVEST=false` no `.env.local`.
 * - Forçar em qualquer build: `NEXT_PUBLIC_REPORTS_MOCK_HARVEST=true`.
 */
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
      s.variety ?? "-",
      `${s.plot_area_ha} ha`,
      `R$ ${s.cost_per_ha_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      s.bags_per_ha ? `${s.bags_per_ha} sc/ha` : "-",
    ]) ?? [];

  const showContent = showMock || apiReport;

  return (
    <>
      <PageHeader title="Relatórios" description="Custos por hectare e produtividade por safra." />

      {!showMock && isLoading ? <ReportPageSkeleton /> : null}

      {showMock ? (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <Info className="text-amber-700 dark:text-amber-400" />
          <AlertTitle>Dados de demonstração</AlertTitle>
          <AlertDescription>
            Exibindo safras colhidas fictícias para pré-visualizar gráficos e tabela. Com a API real, estes blocos
            aparecem quando houver colheitas registradas. Em desenvolvimento o mock vem ligado; use{" "}
            <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">
              NEXT_PUBLIC_REPORTS_MOCK_HARVEST=false
            </code>{" "}
            no <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">.env.local</code> para
            ver apenas dados reais.
          </AlertDescription>
        </Alert>
      ) : null}

      {showContent && report && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <p className="text-xs text-zinc-500">Total de safras</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.total_seasons}</p>
            </Card>
            <Card>
              <p className="text-xs text-zinc-500">Colhidas</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.harvested_seasons}</p>
            </Card>
            <Card>
              <p className="text-xs text-zinc-500">Em andamento</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.in_progress_seasons}</p>
            </Card>
            <Card>
              <p className="text-xs text-zinc-500">Conformidade</p>
              <p className="mt-1 text-2xl font-semibold">
                {report.summary.compliance_rate_pct !== null
                  ? `${report.summary.compliance_rate_pct}%`
                  : "-"}
              </p>
            </Card>
          </div>

          {chartData.length > 0 && (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-zinc-700">Custo por hectare (R$)</h2>
                <div className="overflow-x-auto">
                  <BarChart width={340} height={240} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="custo_ha" fill="#2f7d32" name="R$/ha" />
                  </BarChart>
                </div>
              </Card>
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-zinc-700">Produtividade (sc/ha)</h2>
                <div className="overflow-x-auto">
                  <BarChart width={340} height={240} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="sacas_ha" fill="#1565c0" name="sc/ha" />
                  </BarChart>
                </div>
              </Card>
            </div>
          )}

          {tableRows.length > 0 && (
            <DataTable
              headers={["Cultura", "Variedade", "Área", "Custo/ha", "Produtividade"]}
              rows={tableRows}
            />
          )}

          {!showMock && report.per_season.length === 0 && (
            <p className="text-sm text-zinc-500">Nenhuma safra colhida ainda.</p>
          )}
        </>
      )}
    </>
  );
}
