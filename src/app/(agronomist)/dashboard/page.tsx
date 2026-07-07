"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  Users,
  Building2,
  Leaf,
  CircleAlert,
  CalendarDays,
  Plus,
  ArrowRight,
  Sparkles,
  BellRing,
  Info,
  FileText,
  UserCog,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { RailCard, RailRow } from "@/components/domain/rail-card";
import { PriceCoverageRailCard } from "@/components/domain/price-coverage-rail-card";
import { StatusBadge } from "@/components/domain/status-badge";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompactListSkeleton,
  DashboardKpiSkeleton,
} from "@/components/domain/page-skeletons";
import {
  useFarms,
  useProducers,
  useMe,
  usePlanQuota,
  usePortfolioPriceCoverage,
} from "@/lib/api/hooks";
import { activeAgronomistProducerAccounts } from "@/lib/api/producers";
import { useAgronomistAgenda, type AgendaEvent } from "@/lib/api/hooks/agenda";

type AttentionTab = "late" | "today" | "pending" | "week";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const farms = useFarms();
  const producers = useProducers();
  const { data: me } = useMe();
  const { data: planData, isLoading: planLoading } = usePlanQuota();
  const agenda = useAgronomistAgenda(new Date());

  const [tab, setTab] = useState<AttentionTab>("late");

  const activeProducers = useMemo(
    () => activeAgronomistProducerAccounts(producers.data?.data ?? []),
    [producers.data],
  );

  const producerCount = activeProducers.length;

  const plotCount = useMemo(
    () =>
      activeProducers.reduce((sum, producer) => sum + (producer.plots_count ?? 0), 0),
    [activeProducers],
  );

  const producerIds = useMemo(
    () => activeProducers.map((producer) => producer.producer_id),
    [activeProducers],
  );

  const priceCoverage = usePortfolioPriceCoverage(producerIds);

  // Safras ativas = cycles (a safra de verdade), já vem pronto por produtor no
  // endpoint de carteira — soma aqui em vez de buscar todas as `seasons`
  // (uma por talhão) só para contar, que era mais uma chamada e o número errado.
  const activeCyclesCount = useMemo(
    () => activeProducers.reduce((sum, producer) => sum + (producer.active_cycles_count ?? 0), 0),
    [activeProducers],
  );

  const statsLoading = farms.isLoading || producers.isLoading;
  const kpiLoading = statsLoading || agenda.isLoading;

  // Dedupe agenda events (one per recommendation) and bucket by state.
  const buckets = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");
    const byRec = new Map<string, AgendaEvent>();
    for (const ev of Object.values(agenda.eventsByDay).flat()) {
      const key = ev.id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
      const existing = byRec.get(key);
      if (!existing || ev.ymd < existing.ymd) byRec.set(key, ev);
    }
    const recs = [...byRec.values()];
    // Dessecação nunca é "atrasada" (isLate já vem false do agenda) — cai em Pendentes.
    const inToday = (r: AgendaEvent) =>
      !r.isLate && r.ymd <= today && r.windowEndYmd >= today;
    const inWeek = (r: AgendaEvent) => !r.isLate && r.ymd > today && r.ymd <= weekEnd;
    return {
      late: recs
        .filter((r) => r.isLate)
        .sort((a, b) => a.windowEndYmd.localeCompare(b.windowEndYmd)),
      today: recs.filter(inToday).sort((a, b) => a.ymd.localeCompare(b.ymd)),
      week: recs.filter(inWeek).sort((a, b) => a.ymd.localeCompare(b.ymd)),
      pending: recs
        .filter((r) => !r.isLate && !inToday(r) && !inWeek(r))
        .sort((a, b) => a.ymd.localeCompare(b.ymd)),
    };
  }, [agenda.eventsByDay]);

  const list = buckets[tab];
  const firstName = me?.name?.trim().split(/\s+/)[0] ?? "";
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      {/* Greeting + actions */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ta-soft text-ta">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-primary-strong">
              {dateLabel}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong md:text-[1.7rem]">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {agenda.isLoading ? (
                <Skeleton className="mt-0.5 h-4 w-72 max-w-full" />
              ) : (
                <p>
                  Você tem{" "}
                  <b className="text-text-strong">
                    {agenda.lateCount} aplicaç{agenda.lateCount === 1 ? "ão" : "ões"}{" "}
                    atrasada{agenda.lateCount === 1 ? "" : "s"}
                  </b>{" "}
                  e <b className="text-text-strong">{agenda.todayCount} para hoje</b>.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="outline">
            <Link href="/cronograma">
              <CalendarDays className="size-4" /> Cronograma
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/producers">
              <Users className="size-4" /> Produtores
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/compra-templates">
              <FileText className="size-4" /> Templates de compra
            </Link>
          </Button>
          {me?.role === "AGRONOMIST" ? (
            <Button asChild variant="outline">
              <Link href="/consultants">
                <UserCog className="size-4" /> Consultores
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="clay">
            <Link href="/producers/new">
              <Plus className="size-4" /> Cadastrar produtor
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      {kpiLoading ? (
        <DashboardKpiSkeleton cards={4} className="mb-6" />
      ) : (
        <KpiStrip className="mb-6">
          <KpiCell
            label="Produtores"
            value={producerCount}
            sub="na carteira"
            icon={<Users className="size-4" />}
          />
          <KpiCell
            label="Fazendas"
            value={farms.data?.pagination?.total ?? 0}
            sub="mapeadas"
            icon={<Building2 className="size-4" />}
          />
          <KpiCell
            label="Safras ativas"
            value={activeCyclesCount}
            sub="em andamento"
            icon={<Leaf className="size-4" />}
          />
          <KpiCell
            label="Atrasadas"
            value={agenda.lateCount}
            sub="exigem ação"
            icon={<CircleAlert className="size-4" />}
            alert
          />
        </KpiStrip>
      )}

      {/* Attention panel + rail */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <BellRing className="size-5 text-clay-strong" />
              <h3 className="font-display text-[1.05rem] font-semibold text-text-strong">
                Precisa de atenção
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Como funciona o status das etapas"
                    className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  sideOffset={6}
                  className="w-64 whitespace-normal text-left text-xs leading-relaxed"
                >
                  Cada etapa tem uma janela de tolerância centrada na data prevista. Enquanto hoje
                  está dentro da janela aparece como “Hoje” ou “Na janela”; depois que a janela
                  fecha, vira “Atrasada”. Ao corrigir a data da etapa, a janela é recalculada.
                </TooltipContent>
              </Tooltip>
            </div>
            {agenda.isLoading ? (
              <Skeleton className="h-10 w-[min(100%,22rem)] rounded-xl" />
            ) : (
              <SegmentedTabs<AttentionTab>
                value={tab}
                onValueChange={setTab}
                items={[
                  {
                    value: "late",
                    label: "Atrasadas",
                    badgeCount: buckets.late.length,
                    activeClassName: "bg-red-600 text-white",
                  },
                  {
                    value: "today",
                    label: "Hoje",
                    badgeCount: buckets.today.length,
                    activeClassName: "bg-primary text-primary-foreground",
                  },
                  {
                    value: "pending",
                    label: "Pendentes",
                    badgeCount: buckets.pending.length,
                    activeClassName: "bg-amber-500 text-white",
                  },
                  {
                    value: "week",
                    label: "Semana",
                    badgeCount: buckets.week.length,
                    activeClassName: "bg-sky-600 text-white",
                  },
                ]}
              />
            )}
          </div>

          {agenda.isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-surface-2"
                />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={Leaf}
              title="Nada por aqui"
              description={
                tab === "late"
                  ? "Nenhuma aplicação atrasada. Tudo em dia!"
                  : tab === "today"
                    ? "Nenhuma aplicação para hoje."
                    : tab === "pending"
                      ? "Nenhuma etapa pendente fora da janela."
                      : "Nenhuma aplicação nos próximos 7 dias."
              }
            />
          ) : (
            <div>
              {list.slice(0, 6).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3.5 border-t border-border px-5 py-3.5 first:border-t-0"
                >
                  <span
                    className={
                      "size-2.5 shrink-0 rounded-full " +
                      (ev.isLate ? "bg-danger" : "bg-warning")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <b className="text-[0.95rem] font-semibold text-text-strong">
                      {ev.applicationTitle}
                    </b>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {ev.farmName} · {ev.plotName} · {ev.producerName}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <StatusBadge tone={ev.isLate ? "danger" : "warning"}>
                      {ev.isLate ? "Atrasada" : "Na janela"}
                    </StatusBadge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ev.pillLabel}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/seasons/${ev.seasonId}`}>Abrir</Link>
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-center border-t border-border px-5 py-3.5">
                <Link
                  href="/cronograma"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline"
                >
                  Ver cronograma completo <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <RailCard title="Resumo da carteira">
            {statsLoading ? (
              <CompactListSkeleton rows={4} />
            ) : (
              <>
                <RailRow label="Produtores" value={producerCount} />
                <RailRow label="Fazendas" value={farms.data?.pagination?.total ?? 0} />
                <RailRow label="Talhões" value={plotCount} />
                <RailRow
                  label="Safras em andamento"
                  value={activeCyclesCount}
                  last
                />
              </>
            )}
          </RailCard>

          <PriceCoverageRailCard
            completeLists={priceCoverage.completeLists}
            totalLists={priceCoverage.totalLists}
            pendingLists={priceCoverage.pendingLists}
            pct={priceCoverage.pct}
            isLoading={priceCoverage.isLoading}
          />

          {planLoading ? (
            <div className="rounded-xl border border-clay-border bg-clay-soft p-4.5 shadow-sm">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ) : planData?.plan ? (
            <div className="rounded-xl border border-clay-border bg-clay-soft p-4.5 shadow-sm">
              <div className="mb-2 flex items-center gap-2.5">
                <Sparkles className="size-4 text-clay-strong" />
                <b className="text-[0.95rem] text-text-strong">
                  Plano {planData.plan.name} ·{" "}
                  {planData.quota_usage?.current ?? 0}/
                  {planData.quota_usage?.limit ?? planData.plan.plot_quota}{" "}
                  talhões
                </b>
              </div>
              <p className="text-sm text-muted-foreground">
                Acompanhe o uso da sua quota em{" "}
                <Link
                  href="/profile"
                  className="font-semibold text-clay-strong hover:underline"
                >
                  Meu perfil
                </Link>
                .
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
