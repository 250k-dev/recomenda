"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";
import { useFarms, useProducers, useSeasons } from "@/lib/api/hooks";

export default function DashboardPage() {
  const farms = useFarms();
  const producers = useProducers();
  const seasons = useSeasons();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral de fazendas, produtores e safras em andamento."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>Fazendas: {farms.data?.pagination.total ?? 0}</Card>
        <Card>Produtores: {producers.data?.pagination.total ?? 0}</Card>
        <Card>Safras: {seasons.data?.pagination.total ?? 0}</Card>
      </div>
    </>
  );
}
