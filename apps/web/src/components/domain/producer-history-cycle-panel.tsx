"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, History, Leaf, MapPin, Maximize2 } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import {
  useCan,
  useConcludeHistoryCycle,
  useProducer,
  useProducerCycleHistory,
} from "@recomenda/api-hooks";
import type { CycleHistoryPlot } from "@recomenda/api/cycles";
import { routes } from "@recomenda/config";
import {
  CROP_LABELS,
  CYCLE_STATUS_LABELS,
  PRODUCT_CATEGORY_LABELS,
  STATUS_LABELS,
  cn,
  labelStatus,
  localYmdToDate,
} from "@recomenda/utils";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { HistoricalCycleFlag } from "@/components/domain/historical-cycle-flag";
import {
  INVERTED_HERO_CTA_CLASS,
  INVERTED_HERO_SECONDARY_CLASS,
} from "@/components/domain/export-action-class";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { HistoryStockSnapshotDialog } from "@/components/domain/history-stock-snapshot-dialog";
import {
  REC_STATUS_LABEL,
} from "@/components/domain/season/recommendation-history-row";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDay(iso: string | null) {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "—";
  return `${day}/${m}/${y}`;
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function recStatusLabel(status: string, predicted: string | null, executed: string | null) {
  if (status === "APPLIED_LATE") return "Atrasada";
  if (status === "APPLIED_ON_TIME") return "No prazo";
  if (status === "SKIPPED") return "Pulada";
  if (predicted && executed) {
    const days = differenceInCalendarDays(
      localYmdToDate(executed.slice(0, 10)),
      localYmdToDate(predicted.slice(0, 10)),
    );
    if (days > 0) return "Atrasada";
    if (days === 0) return "No prazo";
  }
  return labelStatus(REC_STATUS_LABEL, status);
}

function recBadgeVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "APPLIED_ON_TIME") return "success";
  if (status === "APPLIED_LATE") return "warning";
  return "neutral";
}

type FarmGroup = {
  farm_id: string;
  farm_name: string;
  plots: CycleHistoryPlot[];
  area_ha: number;
  recs: number;
};

function groupPlots(plots: CycleHistoryPlot[]): FarmGroup[] {
  const map = new Map<string, FarmGroup>();
  for (const plot of plots) {
    const key = plot.farm_id;
    const bucket = map.get(key) ?? {
      farm_id: plot.farm_id,
      farm_name: plot.farm_name,
      plots: [],
      area_ha: 0,
      recs: 0,
    };
    bucket.plots.push(plot);
    bucket.area_ha += plot.area_ha;
    bucket.recs += plot.recommendations.length;
    map.set(key, bucket);
  }
  return [...map.values()];
}

export function ProducerHistoryCyclePanel({
  producerId,
  cycleId,
  tab,
  onTabChange,
  onBack,
}: {
  producerId: string;
  cycleId: string;
  tab: "safra" | "estoque";
  onTabChange: (tab: "safra" | "estoque") => void;
  onBack: () => void;
}) {
  const { data: producer } = useProducer(producerId);
  const { data, isLoading } = useProducerCycleHistory(producerId, cycleId);
  const concludeHistory = useConcludeHistoryCycle(cycleId);
  const canEdit = useCan("CYCLE_CRUD");
  const [openFarm, setOpenFarm] = useState<string | null>(null);
  const [openPlot, setOpenPlot] = useState<string | null>(null);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const plots = data?.plots ?? [];
  const farms = useMemo(() => groupPlots(plots), [plots]);
  const consumption = data?.consumption ?? [];
  const maxQty = Math.max(1, ...consumption.map((c) => Math.abs(c.quantity)));
  const snapshot = data?.stock_snapshot ?? null;

  const harvestBagsHa = useMemo(() => {
    const harvested = plots.filter((p) => p.harvest_bags_per_hectare != null);
    if (harvested.length === 0) return null;
    const totalBags = harvested.reduce(
      (sum, p) => sum + (p.harvest_total_bags ?? 0),
      0,
    );
    const area = harvested.reduce((sum, p) => sum + p.area_ha, 0);
    if (area > 0) return totalBags / area;
    const avg =
      harvested.reduce((sum, p) => sum + (p.harvest_bags_per_hectare ?? 0), 0) /
      harvested.length;
    return avg;
  }, [plots]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!data?.id || !data.farm_id) {
    return (
      <EmptyState
        title="Safra não encontrada"
        description="Esta safra não pertence a este produtor ou foi removida."
        action={
          <Button variant="outline" onClick={onBack}>
            Voltar ao histórico
          </Button>
        }
      />
    );
  }

  const producerHref = routes.produtores.detalhe(producerId);

  return (
    <div className="animate-fade-in">
      <BreadcrumbBack
        items={[
          { label: "Produtores", href: routes.produtores.lista },
          {
            label: producer?.name ?? "Produtor",
            href: producerHref,
          },
          {
            label: "Histórico",
            href: routes.produtores.historico(producerId),
          },
          { label: data.name },
        ]}
      />

      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-strong"
      >
        <ArrowLeft className="size-4" />
        Histórico do produtor
      </button>

      <PageHero
        variant="inverted"
        icon={<Leaf className="size-6" />}
        eyebrow={
          data.backfill
            ? "Arquivo de safra · em preenchimento"
            : "Safra encerrada · só leitura"
        }
        title={data.name}
        titleBadge={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {data.backfill ? <HistoricalCycleFlag /> : null}
            <Badge
              variant={
                data.backfill
                  ? "neutral"
                  : data.status === "HARVESTED"
                    ? "success"
                    : "neutral"
              }
            >
              {data.backfill
                ? "Em preenchimento"
                : labelStatus(CYCLE_STATUS_LABELS, data.status)}
            </Badge>
          </span>
        }
        actions={
          data.backfill && canEdit ? (
            <>
              <Button asChild className={INVERTED_HERO_CTA_CLASS}>
                <Link
                  href={routes.fazendas.safra(data.farm_id, data.id, {
                    producer_id: producerId,
                  })}
                >
                  Continuar preenchimento
                </Link>
              </Button>
              <Button
                variant="outline"
                className={INVERTED_HERO_SECONDARY_CLASS}
                onClick={() => setConcludeOpen(true)}
              >
                Concluir no histórico
              </Button>
            </>
          ) : undefined
        }
        stats={[
          {
            label: "Culturas",
            value: data.crops.map((c) => CROP_LABELS[c] ?? c).join(" + ") || "—",
          },
          {
            label: "Fazendas",
            value: String(data.farms?.length ?? farms.length),
          },
          {
            label: "Talhões",
            value: String(data.plots_count),
          },
          {
            label: "Área",
            value: data.area_ha > 0 ? `${fmtHa(data.area_ha)} ha` : "—",
          },
          {
            label: "Colheita",
            value:
              harvestBagsHa != null
                ? `${fmtQty(harvestBagsHa)} sc/ha`
                : "—",
          },
          {
            label: "Encerrada em",
            value: fmtWhen(data.closed_at ?? data.created_at),
          },
        ]}
      />

      <div className="mb-5">
        <SegmentedTabs
          value={tab}
          onValueChange={onTabChange}
          items={[
            { value: "safra", label: "Safra" },
            { value: "estoque", label: "Estoque" },
          ]}
        />
      </div>

      {tab === "safra" ? (
        farms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum talhão programado nesta safra.
          </p>
        ) : (
          <div className="space-y-3">
            {farms.map((farm) => {
              const open = openFarm === farm.farm_id || farms.length === 1;
              return (
                <div
                  key={farm.farm_id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3.5 px-4 py-4 text-left"
                    onClick={() =>
                      setOpenFarm((cur) =>
                        cur === farm.farm_id ? null : farm.farm_id,
                      )
                    }
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                      <MapPin className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-text-strong">
                        {farm.farm_name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {farm.plots.length}{" "}
                        {farm.plots.length === 1 ? "talhão" : "talhões"}
                        {farm.area_ha > 0
                          ? ` · ${fmtHa(farm.area_ha)} ha`
                          : ""}
                      </span>
                    </span>
                    <span className="hidden text-sm font-medium text-muted-foreground sm:block">
                      {farm.recs} {farm.recs === 1 ? "etapa" : "etapas"}
                    </span>
                    <ChevronRight
                      className={cn(
                        "size-5 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  </button>
                  {open ? (
                    <div className="overflow-x-auto border-t border-border px-4 pb-4">
                      <div className="min-w-[620px]">
                        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_90px_110px_130px_26px] gap-2.5 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground">
                          <span>TALHÃO</span>
                          <span>CULTURA / VARIEDADE</span>
                          <span className="text-right">ÁREA</span>
                          <span className="text-right">COLHEITA</span>
                          <span>STATUS</span>
                          <span />
                        </div>
                        {farm.plots.map((plot) => {
                          const plotOpen = openPlot === plot.season_id;
                          const cropLabel = CROP_LABELS[plot.crop] ?? plot.crop;
                          return (
                            <div
                              key={plot.season_id}
                              className="border-t border-border"
                            >
                              <button
                                type="button"
                                className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_90px_110px_130px_26px] items-center gap-2.5 py-3 text-left"
                                onClick={() =>
                                  setOpenPlot((cur) =>
                                    cur === plot.season_id
                                      ? null
                                      : plot.season_id,
                                  )
                                }
                              >
                                <span className="truncate text-sm font-semibold">
                                  {plot.plot_name}
                                </span>
                                <span className="truncate text-sm text-muted-foreground">
                                  {[cropLabel, plot.variety]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                                <span className="text-right text-sm tabular-nums">
                                  {fmtHa(plot.area_ha)} ha
                                </span>
                                <span className="text-right text-sm font-semibold tabular-nums">
                                  {plot.harvest_bags_per_hectare != null
                                    ? `${fmtQty(plot.harvest_bags_per_hectare)} sc/ha`
                                    : "—"}
                                </span>
                                <span>
                                  <Badge
                                    variant={
                                      plot.status === "HARVESTED"
                                        ? "success"
                                        : "neutral"
                                    }
                                  >
                                    {labelStatus(STATUS_LABELS, plot.status)}
                                  </Badge>
                                </span>
                                <ChevronRight
                                  className={cn(
                                    "size-4 text-muted-foreground transition-transform",
                                    plotOpen && "rotate-90",
                                  )}
                                />
                              </button>
                              {plotOpen ? (
                                <div className="mb-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">
                                      Programação do talhão
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {plot.recommendations.length}{" "}
                                      {plot.recommendations.length === 1
                                        ? "etapa"
                                        : "etapas"}
                                    </span>
                                    <span className="flex-1" />
                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1.5 text-primary-strong"
                                    >
                                      <Link
                                        href={routes.safras.historicoDoTalhao(
                                          plot.season_id,
                                          {
                                            producer_id: producerId,
                                            farm_id: plot.farm_id,
                                          },
                                        )}
                                      >
                                        Histórico do talhão
                                        <History className="size-3.5" />
                                      </Link>
                                    </Button>
                                  </div>
                                  {plot.recommendations.length === 0 ? (
                                    <p className="py-2 text-sm text-muted-foreground">
                                      Nenhuma etapa registrada neste talhão.
                                    </p>
                                  ) : (
                                    plot.recommendations.map((rec) => (
                                      <div
                                        key={rec.id}
                                        className="grid grid-cols-[96px_minmax(0,1fr)_120px] gap-3 border-t border-border py-2.5"
                                      >
                                        <div>
                                          <div className="text-sm font-semibold tabular-nums">
                                            {fmtDay(rec.predicted_date_current)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {rec.executed_date
                                              ? `aplicada ${fmtDay(rec.executed_date)}`
                                              : "não aplicada"}
                                          </div>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold">
                                            {rec.name}
                                          </div>
                                          <div className="mt-0.5 text-sm text-muted-foreground">
                                            {rec.items
                                              .map(
                                                (item) =>
                                                  `${item.product_name} · ${fmtQty(item.dose_per_hectare)} ${item.dose_unit}/ha`,
                                              )
                                              .join(" · ") || "Sem produtos"}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <Badge
                                            variant={recBadgeVariant(rec.status)}
                                          >
                                            {recStatusLabel(
                                              rec.status,
                                              rec.predicted_date_current,
                                              rec.executed_date,
                                            )}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-base font-semibold text-text-strong">
                    Retrato do galpão
                  </h3>
                  {snapshot ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      · {fmtWhen(snapshot.captured_at)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saldos gravados no fechamento desta safra. Não reflete o
                  galpão de hoje.
                </p>
              </div>
              {snapshot ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => setSnapshotOpen(true)}
                  aria-label="Ampliar retrato do galpão"
                >
                  <Maximize2 className="size-4" />
                </Button>
              ) : null}
            </div>
            {snapshot ? (
              snapshot.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Galpão sem produtos neste fechamento.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[380px] text-sm">
                      <thead>
                        <tr className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                          <th className="pb-2 text-left font-semibold">PRODUTO</th>
                          <th className="pb-2 text-right font-semibold">SALDO</th>
                          <th className="pb-2 text-right font-semibold">PREÇO</th>
                          <th className="pb-2 text-right font-semibold">VALOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.items.map((row) => (
                          <tr key={row.local_product_id} className="border-t border-border">
                            <td className="py-3 pr-2">
                              <div className="font-semibold">{row.product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.category
                                  ? (PRODUCT_CATEGORY_LABELS[
                                      row.category as keyof typeof PRODUCT_CATEGORY_LABELS
                                    ] ?? row.category)
                                  : "—"}
                              </div>
                            </td>
                            <td className="py-3 pr-2 text-right tabular-nums whitespace-nowrap">
                              {fmtQty(row.quantity)}
                              {row.dose_unit ? ` ${row.dose_unit}` : ""}
                            </td>
                            <td className="py-3 pr-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                              {row.price_brl != null ? fmtMoney(row.price_brl) : "—"}
                            </td>
                            <td className="py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                              {row.total_brl != null ? fmtMoney(row.total_brl) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Valor do galpão no fechamento
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {snapshot.total_brl != null
                        ? fmtMoney(snapshot.total_brl)
                        : "—"}
                    </span>
                  </div>
                </>
              )
            ) : (
              <EmptyState
                variant="inline"
                title="Retrato indisponível"
                description="Esta safra foi encerrada antes do registro de retrato do galpão. O consumo ao lado continua válido."
              />
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-base font-semibold text-text-strong">
              Consumo da safra
            </h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              O que saiu do galpão nas aplicações desta safra.
            </p>
            {consumption.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum débito de aplicação registrado.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {consumption.map((item) => (
                  <div
                    key={item.local_product_id}
                    className="rounded-xl border border-border bg-surface-2/50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text-strong">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Débito de aplicação
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {fmtQty(item.quantity)}
                          {item.dose_unit ? ` ${item.dose_unit}` : ""}
                        </div>
                        {item.total_brl != null ? (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {fmtMoney(item.total_brl)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (Math.abs(item.quantity) / maxQty) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm font-medium text-muted-foreground">
                Total consumido na safra
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {data.total_brl != null ? fmtMoney(data.total_brl) : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
      {snapshot ? (
        <HistoryStockSnapshotDialog
          open={snapshotOpen}
          onOpenChange={setSnapshotOpen}
          snapshot={snapshot}
          producerName={producer?.name}
          cycleName={data.name}
          capturedLabel={fmtWhen(snapshot.captured_at)}
        />
      ) : null}
      <ConfirmDialog
        open={concludeOpen}
        onOpenChange={setConcludeOpen}
        title="Concluir no histórico?"
        description="A safra entra no arquivo como colhida. O galpão vivo de hoje não é copiado."
        confirmLabel="Concluir no histórico"
        loading={concludeHistory.isPending}
        onConfirm={async () => {
          try {
            await concludeHistory.mutateAsync();
            toast.success("Safra concluída no histórico.");
            setConcludeOpen(false);
          } catch {
            toast.error("Não foi possível concluir a safra no histórico.");
          }
        }}
      />
    </div>
  );
}
