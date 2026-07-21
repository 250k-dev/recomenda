"use client";

import { routes } from "@recomenda/config";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import {
  Users,
  Leaf,
  CalendarDays,
  ChevronRight,
  Plus,
  ArrowRight,
  Sparkles,
  BellRing,
  Info,
  FileText,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@recomenda/ui/primitives/tooltip";
import { RailCard, RailRow } from "@/components/domain/rail-card";
import { PriceCoverageRailCard } from "@/components/domain/price-coverage-rail-card";
import { RecommendationRegisterPopover } from "@/components/domain/recommendation-register-popover";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { CompactListSkeleton } from "@/components/domain/page-skeletons";
import {
  useFarms,
  useProducers,
  usePlanQuota,
  usePortfolioPriceCoverage,
} from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";
import { activeAgronomistProducerAccounts } from "@recomenda/api/producers";
import { useAgronomistAgenda, type AgendaEvent } from "@recomenda/api-hooks/agenda";
import { cn } from "@recomenda/utils";

type AttentionTab = "late" | "today" | "pending" | "week";

const DOT_PENDING_CLASS = "bg-muted-foreground/35";

/**
 * Modelo limpo da lista "Precisa de atenção": o ponto colorido carrega o status
 * (sem pill) e a coluna de tempo mostra só o prazo. Vermelho = atrasada,
 * âmbar = na janela/hoje, cinza = pendente/futura.
 */
function attentionRowPresentation(event: AgendaEvent): {
  dotClass: string;
  timeLabel: string;
  timeClass: string;
} {
  // Dessecação é sempre manual — a agenda já troca o rótulo e não conta atraso.
  if (event.pillLabel === "Manual") {
    return {
      dotClass: DOT_PENDING_CLASS,
      timeLabel: "Manual",
      timeClass: "text-muted-foreground",
    };
  }
  if (event.isLate) {
    return {
      dotClass: "bg-danger",
      // "Atraso 46 dias" → "46 dias": o ponto vermelho já diz que atrasou.
      timeLabel: event.pillLabel.replace(/^Atraso\s+/, ""),
      timeClass: "text-danger-strong",
    };
  }
  if (event.pillLabel === "Hoje" || event.pillLabel === "Na janela") {
    return {
      dotClass: "bg-warning",
      timeLabel: event.pillLabel,
      timeClass: "text-foreground",
    };
  }
  return {
    dotClass: DOT_PENDING_CLASS,
    timeLabel: event.pillLabel,
    timeClass: "text-muted-foreground",
  };
}

function LegendDot({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 shrink-0 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

/** Atalho de funcionalidade em formato de card clicável (variante `accent` em terracota). */
function ShortcutCard({
  href,
  icon: Icon,
  title,
  sub,
  accent = false,
}: {
  href: Route;
  icon: LucideIcon;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-4.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        accent
          ? "border-clay-border bg-clay-soft"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl",
            accent
              ? "bg-clay text-clay-ink shadow-(--clay-shadow)"
              : "bg-primary-soft text-primary-strong",
          )}
        >
          <Icon className="size-5" />
        </span>
        <ArrowRight
          className={cn(
            "size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100",
            accent ? "text-clay-strong" : "text-primary-strong",
          )}
        />
      </div>
      <div>
        <div
          className={cn(
            "font-display text-[0.95rem] font-semibold leading-snug",
            accent ? "text-clay-strong" : "text-text-strong",
          )}
        >
          {title}
        </div>
        <p
          className={cn(
            "mt-0.5 text-xs",
            accent ? "text-clay-strong/80" : "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const farms = useFarms();
  const producers = useProducers();
  const { data: planData, isLoading: planLoading } = usePlanQuota();
  const agenda = useAgronomistAgenda(new Date());
  const canManageTeam = useCan("TEAM_MANAGE");
  const canCreateProducer = useCan("PRODUCER_CREATE");

  const [tab, setTab] = useState<AttentionTab>("late");

  const activeProducers = useMemo(
    () => activeAgronomistProducerAccounts(producers.data?.data ?? []),
    [producers.data],
  );

  const producerCount = activeProducers.length;

  const plotCount = useMemo(
    () =>
      activeProducers.reduce(
        (sum, producer) => sum + (producer.plots_count ?? 0),
        0,
      ),
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
    () =>
      activeProducers.reduce(
        (sum, producer) => sum + (producer.active_cycles_count ?? 0),
        0,
      ),
    [activeProducers],
  );

  const statsLoading = farms.isLoading || producers.isLoading;

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
    const inWeek = (r: AgendaEvent) =>
      !r.isLate && r.ymd > today && r.ymd <= weekEnd;
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

  return (
    <>
      {/* Atalhos de funcionalidades */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr">
        <ShortcutCard
          href="/cronograma"
          icon={CalendarDays}
          title="Cronograma"
          sub="Agenda de aplicações"
        />
        <ShortcutCard
          href={routes.produtores.lista}
          icon={Users}
          title="Produtores"
          sub="Carteira completa"
        />
        <ShortcutCard
          href={routes.templatesDeCompra}
          icon={FileText}
          title="Templates de compra"
          sub="Modelos de lista"
        />
        {canManageTeam ? (
          <ShortcutCard
            href={routes.equipe.lista}
            icon={UserCog}
            title="Equipe"
            sub="Gestores e operadores"
          />
        ) : null}
        {canCreateProducer ? (
          <ShortcutCard
            href={routes.produtores.novo}
            icon={Plus}
            title="Cadastrar produtor"
            sub="Adicionar à carteira"
            accent
          />
        ) : null}
      </div>

      {/* Attention panel + rail */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden border shadow-sm rounded-xl border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
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
                    className="inline-flex transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  sideOffset={6}
                  className="w-64 text-xs leading-relaxed text-left whitespace-normal"
                >
                  Cada etapa tem uma janela de tolerância centrada na data
                  prevista. Enquanto hoje está dentro da janela aparece como
                  “Hoje” ou “Na janela”; depois que a janela fecha, vira
                  “Atrasada”. Ao corrigir a data da etapa, a janela é
                  recalculada.
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
            <div className="p-5 space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg animate-pulse bg-surface-2"
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
              {list.slice(0, 6).map((ev) => {
                const row = attentionRowPresentation(ev);
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3.5 border-t border-border px-5 py-3.5 first:border-t-0"
                  >
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        row.dotClass,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <b className="text-[0.95rem] font-semibold text-text-strong">
                        {ev.applicationTitle}
                      </b>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {ev.farmName} · {ev.plotName} · {ev.producerName}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "hidden shrink-0 text-sm font-semibold tabular-nums sm:block",
                        row.timeClass,
                      )}
                    >
                      {row.timeLabel}
                    </div>
                    <RecommendationRegisterPopover
                      seasonId={ev.seasonId}
                      recommendationId={ev.recommendationId}
                      title={ev.applicationTitle}
                    />
                    <Link
                      href={routes.safras.cronograma(ev.seasonId)}
                      aria-label={`Abrir ${ev.applicationTitle}`}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <LegendDot dotClass="bg-danger" label="Atrasada" />
                  <LegendDot dotClass="bg-warning" label="Na janela / hoje" />
                  <LegendDot
                    dotClass={DOT_PENDING_CLASS}
                    label="Pendente / futura"
                  />
                </div>
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
                <RailRow
                  label="Fazendas"
                  value={farms.data?.pagination?.total ?? 0}
                />
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
            <div className="rounded-xl border border-primary-border bg-primary-soft p-4.5 shadow-sm">
              <Skeleton className="w-56 h-4" />
              <Skeleton className="w-full h-4 mt-2" />
            </div>
          ) : planData?.plan ? (
            <div className="rounded-xl border border-primary-border bg-primary-soft p-4.5 shadow-sm">
              <div className="mb-2 flex items-center gap-2.5">
                <Sparkles className="size-4 text-primary-strong" />
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
                  href={routes.perfil}
                  className="font-semibold text-primary-strong hover:underline"
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
