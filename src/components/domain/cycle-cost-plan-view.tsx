"use client";

import Link from "next/link";
import { Calculator, MapPin, ShoppingCart, Sprout, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { useCycleCostPlan } from "@/lib/api/hooks";
import { CROP_LABELS } from "@/lib/season-constants";

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

const CATEGORY_LABELS: Record<string, string> = {
  SEED: "Sementes",
  CULTIVAR_SOJA: "Cultivar de soja",
  HIBRIDO_MILHO: "Híbrido de milho",
  SEED_TREATMENT: "Tratamento de sementes",
  HERBICIDE: "Herbicidas",
  FUNGICIDE: "Fungicidas",
  INSECTICIDE: "Inseticidas",
  ADJUVANT: "Adjuvantes",
  BIOLOGICAL: "Biológicos",
  FOLIAR: "Foliares",
  FERTILIZER: "Fertilizantes",
  OTHER: "Outros",
};

/** Plano de custo agregado da safra: totais da lista de compra única sobre a
 *  área dos talhões, com quebra por talhão, por categoria e por cultura. */
export function CycleCostPlanView({
  cycleId,
  producerName,
  farmName,
  onOpenPurchaseList,
}: {
  cycleId: string;
  producerName?: string | null;
  farmName?: string | null;
  onOpenPurchaseList: () => void;
}) {
  const { data: plan, isLoading } = useCycleCostPlan(cycleId);

  if (isLoading) return <ListCardsSkeleton count={3} />;

  if (!plan?.purchase_list_id || !plan.cost_summary) {
    return (
      <EmptyState
        icon={Calculator}
        title="Sem plano de custo ainda."
        description="O plano de custo da safra é calculado a partir da lista de compra. Monte a lista para ver os custos por talhão e por cultura."
        action={
          <Button size="sm" className="gap-1.5" onClick={onOpenPurchaseList}>
            <ShoppingCart className="size-4" />
            Montar lista de compra
          </Button>
        }
      />
    );
  }

  const summary = plan.cost_summary;
  const contextLine = [producerName, farmName, `${fmtNum(plan.total_hectares)} ha`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{contextLine}</p>

      <KpiStrip>
        <KpiCell
          label="Custo total da safra"
          value={fmtBrl(summary.grand_total_brl)}
          icon={<Calculator className="size-4" />}
        />
        <KpiCell
          label="Custo por hectare"
          value={fmtBrl(summary.cost_per_ha_brl)}
          icon={<Sprout className="size-4" />}
        />
        <KpiCell
          label="Equivalente em sacas"
          value={summary.total_sacks > 0 ? fmtNum(summary.total_sacks, 0) : "—"}
          sub={
            summary.sacks_per_ha > 0
              ? `${fmtNum(summary.sacks_per_ha)} sc/ha`
              : undefined
          }
          icon={<Wheat className="size-4" />}
        />
        <KpiCell
          label="Área da lista"
          value={`${fmtNum(plan.total_hectares)} ha`}
          icon={<MapPin className="size-4" />}
        />
      </KpiStrip>

      {plan.by_crop.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display text-base font-semibold text-text-strong">
              Custo por cultura
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Cultura</th>
                    <th className="py-2 pr-4 text-right font-medium">Total</th>
                    <th className="py-2 pr-4 text-right font-medium">% da safra</th>
                    <th className="py-2 text-right font-medium">Sacas</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.by_crop.map((row) => (
                    <tr key={row.crop} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {row.crop === "COMMON"
                          ? "Comum às culturas"
                          : (CROP_LABELS[row.crop] ?? row.crop)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {fmtBrl(row.total_brl)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {fmtNum(row.share_pct, 1)}%
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.total_sacks != null ? fmtNum(row.total_sacks, 0) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {plan.by_plot.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display text-base font-semibold text-text-strong">
              Custo por talhão
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Custo/ha da lista aplicado à área plantada de cada talhão.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Talhão</th>
                    <th className="py-2 pr-4 font-medium">Cultura</th>
                    <th className="py-2 pr-4 text-right font-medium">Área (ha)</th>
                    <th className="py-2 pr-4 text-right font-medium">Custo/ha</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.by_plot.map((row) => (
                    <tr key={row.season_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {row.plot_name}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {CROP_LABELS[row.crop] ?? row.crop}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {fmtNum(row.area_ha)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {fmtBrl(row.cost_per_ha_brl)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {fmtBrl(row.total_brl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary.category_breakdown.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display text-base font-semibold text-text-strong">
              Custo por categoria
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Categoria</th>
                    <th className="py-2 pr-4 text-right font-medium">Total</th>
                    <th className="py-2 pr-4 text-right font-medium">% da safra</th>
                    <th className="py-2 text-right font-medium">sc/ha</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.category_breakdown.map((row) => (
                    <tr key={row.category} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {CATEGORY_LABELS[row.category] ?? row.category}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {fmtBrl(row.total_brl)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {fmtNum(row.share_pct, 1)}%
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.sacks_per_ha > 0 ? fmtNum(row.sacks_per_ha) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
