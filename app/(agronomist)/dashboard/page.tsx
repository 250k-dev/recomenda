"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";
import { DashboardKpiSkeleton } from "@/components/domain/page-skeletons";
import { useFarms, useProducers, useSeasons } from "@/lib/api/hooks";
import { useMemo } from "react";

export default function DashboardPage() {
  const farms = useFarms();
  const producers = useProducers();
  const seasons = useSeasons();

  const producerCount = useMemo(
    () => (producers.data?.data ?? []).filter((p) => p.row_type === "producer").length,
    [producers.data],
  );

  const loading = farms.isLoading || producers.isLoading || seasons.isLoading;

  const kpis = [
    { label: "Fazendas", value: farms.data?.pagination?.total ?? 0 },
    { label: "Produtores", value: producerCount },
    { label: "Safras", value: seasons.data?.pagination?.total ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral de fazendas, produtores e safras em andamento."
      />
      {loading ? (
        <DashboardKpiSkeleton cards={3} />
      ) : (
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} size="sm">
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </>
  );
}
