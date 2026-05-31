"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { StatCard } from "@/components/domain/stat-card";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useFarm,
  useFarmPlots,
  useFarmSeasons,
  useProducer,
} from "@/lib/api/hooks";
import { Eye, Leaf, MapPin, Sprout } from "lucide-react";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";

const SEASON_PRIORITY: Record<string, number> = {
  IN_PROGRESS: 0,
  PUBLISHED: 1,
  DRAFT: 2,
  HARVESTED: 3,
  ARCHIVED: 4,
};

const ACTIVE_SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);

type PlotTab = "overview" | "progress";

export default function PlotDetailPage() {
  const params = useParams<{ id: string; plotId: string }>();
  const farmId = params.id;
  const plotId = params.plotId;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");
  const [activeTab, setActiveTab] = useState<PlotTab>("progress");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: seasons, isLoading: loadingSeasons } = useFarmSeasons(farmId);

  const plot = useMemo(
    () => (plots ?? []).find((p) => p.id === plotId) ?? null,
    [plots, plotId],
  );

  const plotSeasons = useMemo(() => {
    if (!seasons) return [];
    return [...seasons]
      .filter((s) => s.plot_id === plotId)
      .sort((a, b) => {
        const byStatus =
          (SEASON_PRIORITY[a.status] ?? 99) - (SEASON_PRIORITY[b.status] ?? 99);
        if (byStatus !== 0) return byStatus;
        return (b.planting_date ?? "").localeCompare(a.planting_date ?? "");
      });
  }, [seasons, plotId]);

  const activeSeasonsCount = useMemo(
    () => plotSeasons.filter((s) => ACTIVE_SEASON_STATUSES.has(s.status)).length,
    [plotSeasons],
  );

  const farmHref = producerId
    ? `/farms/${farmId}?producer_id=${encodeURIComponent(producerId)}`
    : `/farms/${farmId}`;

  const newSeasonHref = producerId
    ? `/farms/${farmId}/season/new?producer_id=${encodeURIComponent(producerId)}`
    : `/farms/${farmId}/season/new`;

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: `/producers/${producerId}` }]
      : []),
    ...(farm ? [{ label: farm.name, href: farmHref }] : []),
    { label: plot?.name ?? "Talhão" },
  ];

  if (loadingPlots) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <TableRowsSkeleton rows={4} columns={1} />
      </>
    );
  }

  if (!plot) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <EmptyState
          title="Talhão não encontrado."
          action={<Button asChild size="sm" variant="outline"><Link href={farmHref}>Voltar à fazenda</Link></Button>}
        />
      </>
    );
  }

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHeader
        title={plot.name}
        description={
          farm
            ? `${farm.name} · ${Number(plot.area_hectares).toFixed(2)} ha`
            : `${Number(plot.area_hectares).toFixed(2)} ha`
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Área"
          value={`${Number(plot.area_hectares).toFixed(2)} ha`}
          icon={<Sprout className="h-4 w-4" />}
          accent="sun"
        />
        <StatCard
          label="Safras ativas"
          value={activeSeasonsCount}
          icon={<Leaf className="h-4 w-4" />}
          accent="sky"
        />
      </div>

      <div className="mb-6">
        <SegmentedTabs<PlotTab>
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: "progress", label: "Andamento" },
            { value: "overview", label: "Visão geral" },
          ]}
        />
      </div>

      {activeTab === "overview" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Nome</dt>
                  <dd className="font-medium text-foreground">{plot.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Área</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {Number(plot.area_hectares).toFixed(2)} ha
                  </dd>
                </div>
                {farm ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Fazenda</dt>
                    <dd>
                      <Link
                        href={farmHref}
                        className="font-medium text-primary hover:underline"
                      >
                        {farm.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "progress" && (
        <PlotProgressTab
          seasons={plotSeasons}
          isLoading={loadingSeasons}
          farmId={farmId}
          producerId={producerId}
          newSeasonHref={newSeasonHref}
          plotName={plot.name}
        />
      )}
    </>
  );
}

function PlotProgressTab({
  seasons,
  isLoading,
  farmId,
  producerId,
  newSeasonHref,
  plotName,
}: {
  seasons: Array<{
    id: string;
    plot_name: string;
    crop: string;
    variety?: string | null;
    status: string;
    planting_date?: string | null;
    cycle_days?: number | null;
  }>;
  isLoading: boolean;
  farmId: string;
  producerId: string | null;
  newSeasonHref: string;
  plotName: string;
}) {
  if (isLoading) return <TableRowsSkeleton rows={4} columns={1} />;

  if (seasons.length === 0) {
    return (
      <EmptyState
        title={`Nenhuma safra cadastrada no talhão ${plotName}.`}
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Configurar safra</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {seasons.map((season) => {
        const href = producerId
          ? `/seasons/${season.id}?farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(producerId)}`
          : `/seasons/${season.id}?farm_id=${encodeURIComponent(farmId)}`;

        return (
          <Card key={season.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {CROP_LABELS[season.crop] ?? season.crop}
                  {season.variety ? ` — ${season.variety}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[season.status] ?? "default"}>
                    {STATUS_LABELS[season.status] ?? season.status}
                  </Badge>
                  {season.planting_date ? (
                    <span className="text-xs text-muted-foreground">
                      Plantio:{" "}
                      {new Date(season.planting_date).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                  {season.cycle_days ? (
                    <span className="text-xs text-muted-foreground">
                      Ciclo: {season.cycle_days} dias
                    </span>
                  ) : null}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={href}>
                  <Eye className="h-4 w-4" />
                  Ver safra
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
