"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Calculator,
  ChevronRight,
  Leaf,
  Plus,
  ShoppingCart,
  SquareCheckBig,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { type PageHeroStat } from "@/components/domain/page-hero";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { CycleBlockWizard } from "@/components/domain/cycle-block-wizard";
import {
  CyclePageShell,
  useCyclePage,
} from "@/components/domain/cycle/cycle-page-shell";
import { useArchiveSeason, useCyclePurchaseList } from "@/lib/api/hooks";
import { useCan } from "@/lib/auth/use-can";
import type { CycleSeasonRow } from "@recomenda/api/cycles";
import {
  CROP_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from "@recomenda/utils";
import { routes } from "@recomenda/config";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Nome de exibição da programação: cultura + variedade(s). */
function seasonDisplayName(season: CycleSeasonRow): string {
  const varietyNames = (season.varieties ?? [])
    .map((v) => v.variety)
    .filter(Boolean);
  const varietyLabel =
    varietyNames.length > 0 ? varietyNames.join(" + ") : (season.variety ?? "");
  return `${CROP_LABELS[season.crop] ?? season.crop}${
    varietyLabel ? ` — ${varietyLabel}` : ""
  }`;
}

export default function CycleDetailPage() {
  const router = useRouter();
  const canListCrud = useCan("LIST_CRUD");
  const page = useCyclePage();
  const { farmId, cycleId, producerId, cycle, seasons } = page;

  const { data: purchaseList } = useCyclePurchaseList(cycleId);
  const archiveSeason = useArchiveSeason();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [plotFilter, setPlotFilter] = useState("");

  const totalRecs = seasons.reduce(
    (s, row) => s + row.recommendations_total,
    0,
  );
  const doneRecs = seasons.reduce((s, row) => s + row.recommendations_done, 0);
  const progressPct =
    totalRecs > 0 ? Math.round((doneRecs / totalRecs) * 100) : 0;
  const areaByPlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seasons) {
      map.set(s.plot_id, s.planted_area_ha ?? s.plot_area_ha);
    }
    return map;
  }, [seasons]);
  const totalArea = [...areaByPlot.values()].reduce((s, v) => s + v, 0);
  // Conta as programações realmente listadas (uma por linha). areaByPlot deduplica
  // por plot_id — quando o mesmo talhão tem duas culturas/ciclos na safra ele
  // aparece em duas linhas, então o contador precisa bater com o que está na tela
  // (e com o chip do bloco), não com o nº de talhões físicos distintos.
  const plotCount = seasons.length;
  const filteredSeasons = useMemo(() => {
    const query = plotFilter.trim().toLocaleLowerCase("pt-BR");
    if (!query) return seasons;
    return seasons.filter((season) =>
      season.plot_name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [plotFilter, seasons]);

  if (wizardOpen && cycle) {
    return (
      <>
        <BreadcrumbBack
          items={[...page.breadcrumbs.slice(0, -1), { label: cycle.name }]}
        />
        <CycleBlockWizard
          cycle={cycle}
          producerId={producerId}
          onDone={() => setWizardOpen(false)}
          onCancel={() => setWizardOpen(false)}
        />
      </>
    );
  }

  const isPlanning = seasons.length === 0;

  const heroStats: PageHeroStat[] = [
    { label: "Talhões", value: plotCount },
    { label: "Área", value: `${fmtHa(totalArea)} ha` },
    {
      label: "Aplicações",
      value: totalRecs > 0 ? `${doneRecs}/${totalRecs}` : "—",
      sub: totalRecs > 0 ? `${progressPct}%` : undefined,
    },
    {
      label: purchaseList?.name ?? "Lista de compra",
      value: purchaseList ? (purchaseList.items ?? []).length : 0,
      sub: "produtos",
      onClick: () => router.push(page.hrefs.listaDeCompra),
    },
  ];

  return (
    <CyclePageShell
      page={page}
      stats={heroStats}
      actions={
        <>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={page.hrefs.planoDeCusto}>
              <Calculator className="size-4" />
              Plano de custo
            </Link>
          </Button>
          <Button asChild variant="clay" className="gap-1.5">
            <Link href={page.hrefs.listaDeCompra}>
              <ShoppingCart className="size-4" />
              Lista de compra
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!isPlanning ? (
          <SectionToolbar
            title="Talhões desta safra"
            search={{
              value: plotFilter,
              onChange: setPlotFilter,
              placeholder: "Filtrar talhão…",
            }}
            actions={
              <Button
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="size-4" />
                Adicionar talhão
              </Button>
            }
          />
        ) : null}

        {isPlanning ? (
          <EmptyState
            icon={Leaf}
            title="Programação ainda não montada."
            description="Adicione os talhões escolhendo um modelo de recomendação — você pode aplicar modelos diferentes a grupos de talhões diferentes antes de publicar."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {!purchaseList && canListCrud ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                  >
                    <Link href={page.hrefs.novaListaDeCompra}>
                      <ShoppingCart className="size-4" />
                      Montar lista de compra
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setWizardOpen(true)}
                >
                  <Plus className="size-4" />
                  Adicionar talhão
                </Button>
              </div>
            }
          />
        ) : filteredSeasons.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nenhum talhão encontrado."
            description={`Não há talhões com o nome "${plotFilter.trim()}".`}
          />
        ) : (
          <>
            {/* Desktop: tabela de talhões da safra */}
            <div className="hidden overflow-hidden border shadow-sm rounded-xl border-border bg-card md:block">
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 bg-surface-2 px-5 py-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <span>Talhão</span>
                <span>Cultura / variedade</span>
                <span>Área</span>
                <span>Progresso</span>
                <span>Status</span>
                <span className="text-right">Ações</span>
              </div>
              {filteredSeasons.map((season) => {
                const row = seasonRowData(season, farmId, producerId);
                return (
                  <div
                    key={season.id}
                    className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 border-t border-border px-5 py-3.5 text-sm"
                  >
                    <span className="font-semibold truncate text-text-strong">
                      Talhão {season.plot_name}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-muted-foreground">
                        {row.displayName}
                      </span>
                      {row.varietiesBreakdown ? (
                        <span className="block text-xs truncate text-muted-foreground/80">
                          {row.varietiesBreakdown}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">
                      {fmtHa(row.area)} ha
                      {row.partialArea ? (
                        <span className="block text-xs text-muted-foreground">
                          de {fmtHa(season.plot_area_ha)} ha
                        </span>
                      ) : null}
                    </span>
                    <span>
                      {season.recommendations_total > 0 ? (
                        <span className="flex items-center gap-2">
                          <ProgressBar
                            value={row.pct}
                            className="h-1.5 flex-1 bg-surface-2"
                          />
                          <span className="text-xs font-semibold shrink-0 tabular-nums text-primary-strong">
                            {row.pct}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span>
                      <Badge
                        variant={STATUS_VARIANTS[season.status] ?? "default"}
                      >
                        {STATUS_LABELS[season.status] ?? season.status}
                      </Badge>
                    </span>
                    <span className="flex justify-end gap-4">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={row.recommendationHref}>
                          Recomendações
                          <ChevronRight />
                        </Link>
                      </Button>
                      {season.status !== "ARCHIVED" ? (
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() =>
                            setArchiveConfirm({
                              id: season.id,
                              name: `${season.plot_name} — ${row.displayName}`,
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: cards */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {filteredSeasons.map((season) => {
                const row = seasonRowData(season, farmId, producerId);
                return (
                  <div
                    key={season.id}
                    className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-text-strong">
                          Talhão {season.plot_name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.displayName} · {fmtHa(row.area)}
                          {row.partialArea
                            ? ` de ${fmtHa(season.plot_area_ha)}`
                            : ""}{" "}
                          ha
                        </p>
                      </div>
                      <Badge
                        className="shrink-0"
                        variant={STATUS_VARIANTS[season.status] ?? "default"}
                      >
                        {STATUS_LABELS[season.status] ?? season.status}
                      </Badge>
                    </div>
                    {season.recommendations_total > 0 ? (
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {season.recommendations_done}/
                            {season.recommendations_total} aplicadas
                          </span>
                          <span className="font-semibold tabular-nums text-primary-strong">
                            {row.pct}%
                          </span>
                        </div>
                        <ProgressBar value={row.pct} className="h-1.5" />
                      </div>
                    ) : null}
                    <div className="flex gap-2 mt-3">
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={row.recommendationHref}>
                          <SquareCheckBig />
                          Recomendações
                        </Link>
                      </Button>
                      {season.status !== "ARCHIVED" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            setArchiveConfirm({
                              id: season.id,
                              name: `${season.plot_name} — ${row.displayName}`,
                            })
                          }
                        >
                          <Trash2 />
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!isPlanning ? (
          <StickyMobileCta>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="size-4" />
              Adicionar talhão
            </Button>
          </StickyMobileCta>
        ) : null}
      </div>

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Remover talhão da safra"
        description={
          archiveConfirm
            ? `A programação de "${archiveConfirm.name}" será movida para Removidas.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={archiveSeason.isPending}
        onConfirm={async () => {
          if (!archiveConfirm) return;
          await new Promise<void>((resolve, reject) =>
            archiveSeason.mutate(archiveConfirm.id, {
              onSuccess: () => {
                setArchiveConfirm(null);
                toast.success("Talhão removido da safra.");
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </CyclePageShell>
  );
}

/** Dados derivados de uma linha de talhão (tabela desktop e card mobile). */
function seasonRowData(
  season: CycleSeasonRow,
  farmId: string,
  producerId: string,
) {
  const recommendationHref = routes.safras.cronograma(season.id, {
    farm_id: farmId,
    producer_id: producerId,
  });
  const pct =
    season.recommendations_total > 0
      ? Math.round(
          (season.recommendations_done / season.recommendations_total) * 100,
        )
      : 0;
  const seasonVarieties = season.varieties ?? [];
  const varietiesBreakdown =
    seasonVarieties.length > 1
      ? seasonVarieties
          .map(
            (v) =>
              `${v.variety}${
                v.planted_area_ha != null
                  ? ` (${fmtHa(v.planted_area_ha)} ha)`
                  : ""
              }`,
          )
          .join(" · ")
      : null;
  const partialArea =
    season.planted_area_ha != null &&
    season.planted_area_ha !== season.plot_area_ha;
  return {
    recommendationHref,
    pct,
    displayName: seasonDisplayName(season),
    varietiesBreakdown,
    partialArea,
    area: season.planted_area_ha ?? season.plot_area_ha,
  };
}
