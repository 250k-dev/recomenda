"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Search,
  SkipForward,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Popover, PopoverContent, PopoverTrigger } from "@recomenda/ui/primitives/popover";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { activeAgronomistProducerAccounts } from "@recomenda/api/producers";
import { useAgronomistAgenda, useBulkRegisterRecommendations, useProducers, localYmdToDate, dedupeAgendaEvents, type AgendaEvent } from "@recomenda/api-hooks";
import { cn } from "@recomenda/utils";
import { RecommendationRegisterPopover } from "@/components/domain/recommendation-register-popover";
import { PlantingDateRegisterPopover } from "@/components/domain/season/planting-date-register-popover";

/** Chave estável de seleção (uma por recomendação, dedupe entre dias). */
function eventSelectionKey(event: AgendaEvent): string {
  return `${event.seasonId}:${event.recommendationId || event.kind}`;
}

function isApplicationEvent(event: AgendaEvent): boolean {
  return event.kind !== "PLANTING" && Boolean(event.recommendationId);
}

const MINI_WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

const GROUP_ACCENT_CLASSES = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
] as const;

type AgendaStatusFilter = "late" | "today" | "pending";

type PanelMode = "day" | "month" | "filter";

const STATUS_FILTER_META: Record<
  AgendaStatusFilter,
  { label: string; panelTitle: string; emptyMessage: string }
> = {
  late: {
    label: "Atrasadas",
    panelTitle: "Aplicações atrasadas",
    emptyMessage: "Nenhuma aplicação atrasada no momento.",
  },
  today: {
    label: "Hoje",
    panelTitle: "Aplicações de hoje",
    emptyMessage: "Nenhuma aplicação pendente para hoje.",
  },
  pending: {
    label: "Pendentes",
    panelTitle: "Todas as aplicações pendentes",
    emptyMessage: "Nenhuma aplicação pendente no cronograma.",
  },
};

export type MonthCalendarProps = {
  producerId?: string;
  title?: string;
  focusNearestEvent?: boolean;
  showProducerFilter?: boolean;
  showHeader?: boolean;
  onProducerChange?: (producerId: string | undefined) => void;
};

export function MonthCalendar({
  producerId,
  title,
  focusNearestEvent = false,
  showProducerFilter = false,
  showHeader = true,
  onProducerChange,
}: MonthCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [panelMode, setPanelMode] = useState<PanelMode>("day");
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter | null>(null);
  const didAutoFocus = useRef(false);

  // Registro em massa: modo seleção + etapas escolhidas (por recomendação).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, AgendaEvent>>(new Map());
  const [bulkDate, setBulkDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const bulkMut = useBulkRegisterRecommendations();

  const selectedKeys = useMemo(() => new Set(selected.keys()), [selected]);

  const toggleSelected = (event: AgendaEvent) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = eventSelectionKey(event);
      if (next.has(key)) next.delete(key);
      else next.set(key, event);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Map());

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelected(new Map());
  };

  const runBulk = (action: "apply" | "skip") => {
    const items = [...selected.values()]
      .filter((event) => isApplicationEvent(event))
      .map((event) => ({
        seasonId: event.seasonId,
        recommendationId: event.recommendationId,
      }));
    if (items.length === 0) return;
    bulkMut.mutate(
      { action, date: bulkDate, items },
      {
        onSuccess: ({ ok, failed }) => {
          if (failed === 0) {
            toast.success(
              `${ok} ${ok === 1 ? "aplicação registrada" : "aplicações registradas"}.`,
            );
          } else {
            toast.warning(`${ok} registradas · ${failed} falharam.`);
          }
          exitSelectionMode();
        },
        onError: () => toast.error("Não foi possível registrar as aplicações."),
      },
    );
  };

  const { data: producersData } = useProducers();
  const producerOptions = useMemo(
    () =>
      activeAgronomistProducerAccounts(producersData?.data ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    [producersData],
  );

  const { eventsByDay, calendarMarkersByDay, totalEventCount, todayCount, lateCount, draftCount, isLoading, isError } =
    useAgronomistAgenda(month, producerId);

  const today = new Date();
  const todayYmd = format(today, "yyyy-MM-dd");

  const allEvents = useMemo(
    () => dedupeAgendaEvents(Object.values(eventsByDay).flat()),
    [eventsByDay],
  );

  const monthEvents = useMemo(() => {
    const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
    return allEvents.filter((event) => event.ymd >= monthStart && event.ymd <= monthEnd);
  }, [allEvents, month]);

  /* eslint-disable react-hooks/set-state-in-effect -- dívida pré-existente (baseline desde A1): reseta o painel ao trocar de produtor. A forma canônica é `key={producerId}` no componente pai, mas mexer nisso é mudança de comportamento sem teste que a cubra. */
  useEffect(() => {
    didAutoFocus.current = false;
    setPanelMode("day");
    setStatusFilter(null);
    setSelectionMode(false);
    setSelected(new Map());
  }, [producerId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const nextEventYmd = useMemo(() => {
    const ymds = Object.keys(calendarMarkersByDay).sort();
    if (ymds.length === 0) return null;
    return ymds.find((ymd) => ymd >= todayYmd) ?? ymds[ymds.length - 1];
  }, [calendarMarkersByDay, todayYmd]);

  useEffect(() => {
    if (!focusNearestEvent || isLoading || didAutoFocus.current || !nextEventYmd) return;
    didAutoFocus.current = true;
    const targetDate = localYmdToDate(nextEventYmd);
    setMonth(startOfMonth(targetDate));
    setSelectedDay(targetDate);
  }, [focusNearestEvent, isLoading, nextEventYmd]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedYmd = format(selectedDay, "yyyy-MM-dd");
  const selectedEvents = eventsByDay[selectedYmd] ?? [];

  const filteredEvents = useMemo(() => {
    if (!statusFilter) return [];
    switch (statusFilter) {
      case "late":
        return allEvents.filter((event) => event.isLate);
      case "today":
        return allEvents.filter((event) => event.ymd === todayYmd);
      case "pending":
        return allEvents.filter((event) => !event.isLate);
    }
  }, [allEvents, statusFilter, todayYmd]);

  const applyStatusFilter = (filter: AgendaStatusFilter) => {
    setStatusFilter(filter);
    setPanelMode("filter");
  };

  const headerTitle = title ?? "Cronograma";

  return (
    <div
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8",
        showHeader && "rounded-xl border bg-card p-4 shadow-sm sm:p-5",
        !showHeader && "pt-1",
      )}
    >
      {/* Coluna esquerda: navegação + mini calendário + KPIs */}
      <aside className="w-full shrink-0 lg:w-[280px] xl:w-[300px]">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {showHeader ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                  {format(month, "MMMM yyyy", { locale: ptBR })}
                </p>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-text-strong sm:text-2xl">
                  {headerTitle}
                </h2>
              </>
            ) : (
              <p className="text-sm font-semibold capitalize text-foreground">
                {format(month, "MMMM yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="mb-4 h-52 w-full rounded-xl" />
        ) : (
          <MiniMonthCalendar
            month={month}
            calendarDays={calendarDays}
            calendarMarkersByDay={calendarMarkersByDay}
            selectedDay={selectedDay}
            today={today}
            todayYmd={todayYmd}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setPanelMode("day");
              setStatusFilter(null);
            }}
          />
        )}

        {!isLoading && !isError ? (
          <div className="mt-4 flex flex-col gap-2">
            <StatusSummaryCard
              label="Atrasadas"
              value={lateCount}
              dotClass="bg-danger"
              valueClass="text-danger-strong"
              selected={panelMode === "filter" && statusFilter === "late"}
              onClick={() => applyStatusFilter("late")}
            />
            <StatusSummaryCard
              label="Hoje"
              value={todayCount}
              dotClass="bg-primary"
              valueClass="text-primary"
              selected={panelMode === "filter" && statusFilter === "today"}
              onClick={() => applyStatusFilter("today")}
            />
            <StatusSummaryCard
              label="Pendentes"
              value={totalEventCount}
              dotClass="bg-warning"
              valueClass="text-success-strong"
              selected={panelMode === "filter" && statusFilter === "pending"}
              onClick={() => applyStatusFilter("pending")}
            />
          </div>
        ) : null}
      </aside>

      {/* Coluna direita: agenda do dia / mês / filtro */}
      <main className="min-w-0 flex-1">
        {/* Programação existe mas está em rascunho: explica o calendário vazio
            em vez de deixar parecer que o trabalho sumiu. */}
        {!isLoading && !isError && totalEventCount === 0 && draftCount > 0 ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {draftCount === 1
                ? "Há 1 programação em rascunho que não aparece aqui."
                : `Há ${draftCount} programações em rascunho que não aparecem aqui.`}{" "}
              Abra a safra na fazenda e use <strong>Revisar e publicar</strong> para
              as aplicações entrarem no cronograma.
            </span>
          </div>
        ) : null}
        <Card className="flex max-h-[min(72vh,calc(100vh-11rem))] flex-col gap-0 overflow-hidden border py-0 shadow-sm">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {panelMode === "month"
                  ? "Mês inteiro"
                  : panelMode === "filter" && statusFilter
                    ? STATUS_FILTER_META[statusFilter].panelTitle
                    : "Aplicações do dia"}
              </p>
              <p className="mt-1 text-lg font-bold capitalize tracking-tight text-foreground sm:text-xl">
                {panelMode === "month"
                  ? "Agrupado por cliente"
                  : panelMode === "filter"
                    ? STATUS_FILTER_META[statusFilter ?? "pending"].label
                    : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {showProducerFilter ? (
                <ProducerFilterToggle
                  producerId={producerId}
                  options={producerOptions}
                  onChange={onProducerChange}
                />
              ) : null}
              <ViewModeToggle
                mode={panelMode === "month" ? "month" : "day"}
                onChange={(mode) => {
                  setPanelMode(mode);
                  if (mode === "day") setStatusFilter(null);
                }}
              />
              <button
                type="button"
                onClick={() =>
                  selectionMode ? exitSelectionMode() : setSelectionMode(true)
                }
                aria-pressed={selectionMode}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  selectionMode
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    : "bg-primary/12 text-primary hover:bg-primary/18",
                )}
              >
                {selectionMode ? (
                  <X className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {selectionMode ? "Cancelar" : "Selecionar"}
                </span>
              </button>
            </div>
          </div>

          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : isError ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar o cronograma.</p>
            ) : panelMode === "month" ? (
              monthEvents.length === 0 ? (
                <EmptyAgendaState message="Nenhuma aplicação pendente neste mês." />
              ) : (
                <GroupedAgendaList
                  events={monthEvents}
                  todayYmd={todayYmd}
                  variant="month"
                  selectable={selectionMode}
                  selectedKeys={selectedKeys}
                  onToggle={toggleSelected}
                />
              )
            ) : panelMode === "filter" ? (
              <FilteredAgendaPanel
                filter={statusFilter ?? "pending"}
                events={filteredEvents}
                todayYmd={todayYmd}
                selectable={selectionMode}
                selectedKeys={selectedKeys}
                onToggle={toggleSelected}
              />
            ) : selectedEvents.length === 0 ? (
              <EmptyAgendaState message="Nenhuma aplicação pendente neste dia." />
            ) : (
              <GroupedAgendaList
                events={selectedEvents}
                todayYmd={todayYmd}
                selectable={selectionMode}
                selectedKeys={selectedKeys}
                onToggle={toggleSelected}
              />
            )}
          </CardContent>
        </Card>

        {selectionMode && selected.size > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-lg">
            <span className="text-sm font-semibold text-foreground">
              {selected.size}{" "}
              {selected.size === 1
                ? "aplicação selecionada"
                : "aplicações selecionadas"}
            </span>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="h-9 w-40 bg-card"
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={bulkMut.isPending}
              >
                Limpar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk("skip")}
                disabled={bulkMut.isPending}
                className="gap-1.5 bg-card text-muted-foreground"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Pular
              </Button>
              <Button
                size="sm"
                onClick={() => runBulk("apply")}
                disabled={bulkMut.isPending || !bulkDate}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {bulkMut.isPending ? "Registrando…" : "Marcar como aplicadas"}
              </Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MiniMonthCalendar({
  month,
  calendarDays,
  calendarMarkersByDay,
  selectedDay,
  today,
  todayYmd,
  onSelectDay,
}: {
  month: Date;
  calendarDays: Date[];
  calendarMarkersByDay: Record<string, AgendaEvent[]>;
  selectedDay: Date;
  today: Date;
  todayYmd: string;
  onSelectDay: (day: Date) => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-3 shadow-sm">
      <div className="mb-2 grid grid-cols-7 gap-0.5">
        {MINI_WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="py-1 text-center text-[10px] font-semibold text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day) => {
          const ymd = format(day, "yyyy-MM-dd");
          const dayMarkers = calendarMarkersByDay[ymd] ?? [];
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDay);
          const dotColor = getDayDotColor(dayMarkers, todayYmd, ymd);

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "flex flex-col items-center rounded-md py-1.5 transition-colors",
                !inMonth && "opacity-35",
                inMonth && "hover:bg-muted/50",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center text-xs font-semibold tabular-nums",
                  isToday && "rounded-full bg-primary text-primary-foreground",
                  !isToday && inMonth && "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              {dotColor ? (
                <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", dotColor)} />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getDayDotColor(
  events: AgendaEvent[],
  todayYmd: string,
  ymd: string,
): string | null {
  if (events.length === 0) return null;
  if (events.some((event) => event.isLate)) return "bg-danger";
  if (ymd === todayYmd) return "bg-primary";
  return "bg-warning";
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: "day" | "month";
  onChange: (mode: "day" | "month") => void;
}) {
  return (
    <div className="flex rounded-lg border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={() => onChange("day")}
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
          mode === "day"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Dia
      </button>
      <button
        type="button"
        onClick={() => onChange("month")}
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
          mode === "month"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Mês
      </button>
    </div>
  );
}

function StatusSummaryCard({
  label,
  value,
  dotClass,
  valueClass,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  dotClass: string;
  valueClass: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left shadow-sm transition-all hover:shadow-md",
        selected && "border-foreground/20 ring-1 ring-foreground/15",
      )}
    >
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotClass)} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <span className={cn("text-lg font-bold tabular-nums", valueClass)}>{value}</span>
    </button>
  );
}

function groupAccentClass(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % GROUP_ACCENT_CLASSES.length;
  }
  return GROUP_ACCENT_CLASSES[hash];
}

function groupEventsByFarm(events: AgendaEvent[]) {
  const groups = new Map<
    string,
    { farmName: string; producerName: string; events: AgendaEvent[] }
  >();

  for (const event of events) {
    const key = `${event.farmName}|${event.producerName}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, {
        farmName: event.farmName,
        producerName: event.producerName,
        events: [event],
      });
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    events: [...group.events].sort((a, b) => a.ymd.localeCompare(b.ymd)),
  }));
}

function GroupedAgendaList({
  events,
  todayYmd,
  variant = "day",
  selectable = false,
  selectedKeys,
  onToggle,
}: {
  events: AgendaEvent[];
  todayYmd: string;
  variant?: "day" | "month";
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggle?: (event: AgendaEvent) => void;
}) {
  const groups = groupEventsByFarm(events);

  return (
    <div className={cn("flex flex-col", variant === "month" ? "gap-6" : "gap-5")}>
      {groups.map((group) => {
        const groupKey = `${group.farmName}|${group.producerName}`;
        const accentClass = groupAccentClass(groupKey);

        return (
          <section key={groupKey}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn("mt-px h-3 w-3 shrink-0 rounded-[3px]", accentClass)}
                  aria-hidden
                />
                <p className="min-w-0 truncate text-sm leading-snug">
                  <span className="font-semibold text-foreground">{group.farmName}</span>
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {group.producerName}
                  </span>
                </p>
              </div>
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted/80 px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {group.events.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {group.events.map((event) => (
                <AgendaEventCard
                  key={event.id}
                  event={event}
                  todayYmd={todayYmd}
                  selectable={selectable}
                  selected={selectedKeys?.has(eventSelectionKey(event))}
                  onToggle={onToggle ? () => onToggle(event) : undefined}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FilteredAgendaPanel({
  filter,
  events,
  todayYmd,
  selectable = false,
  selectedKeys,
  onToggle,
}: {
  filter: AgendaStatusFilter;
  events: AgendaEvent[];
  todayYmd: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggle?: (event: AgendaEvent) => void;
}) {
  if (events.length === 0) {
    return <EmptyAgendaState message={STATUS_FILTER_META[filter].emptyMessage} />;
  }

  if (filter === "today") {
    return (
      <GroupedAgendaList
        events={events}
        todayYmd={todayYmd}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onToggle={onToggle}
      />
    );
  }

  const byDay = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.ymd) ?? [];
    bucket.push(event);
    byDay.set(event.ymd, bucket);
  }

  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      {sortedDays.map(([ymd, dayEvents]) => (
        <section key={ymd}>
          <p className="mb-3 text-sm font-semibold capitalize text-muted-foreground">
            {format(localYmdToDate(ymd), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <GroupedAgendaList
            events={dayEvents}
            todayYmd={todayYmd}
            selectable={selectable}
            selectedKeys={selectedKeys}
            onToggle={onToggle}
          />
        </section>
      ))}
    </div>
  );
}

function EmptyAgendaState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarDays className="h-5 w-5" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function normalizeProducerQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function ProducerFilterToggle({
  producerId,
  options,
  onChange,
}: {
  producerId?: string;
  options: Array<{ producer_id: string; name: string }>;
  onChange?: (producerId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const listOptions = useMemo(
    () => [
      { value: "", label: "Todos os produtores" },
      ...options.map((producer) => ({
        value: producer.producer_id,
        label: producer.name,
      })),
    ],
    [options],
  );

  const filteredOptions = useMemo(() => {
    const q = normalizeProducerQuery(query);
    if (!q) return listOptions;
    return listOptions.filter((option) => normalizeProducerQuery(option.label).includes(q));
  }, [listOptions, query]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };

  const handleSelect = (value: string) => {
    onChange?.(value || undefined);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            producerId || open
              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              : "bg-primary/12 text-primary hover:bg-primary/18",
          )}
          aria-label="Filtrar por produtor"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Produtor</span>
          {producerId ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning ring-2 ring-card" />
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Filtrar produtor
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtor…"
              autoComplete="off"
              className="h-9 pl-8"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (e.key === "Enter" && filteredOptions[0]) {
                  e.preventDefault();
                  handleSelect(filteredOptions[0].value);
                }
              }}
            />
          </div>
        </div>

        <ul role="listbox" aria-label="Produtores" className="max-h-64 overflow-y-auto py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = (producerId ?? "") === option.value;
              const initial = (option.label.trim().charAt(0) || "?").toUpperCase();

              return (
                <li key={option.value || "all"} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60",
                      isSelected && "bg-primary/8",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        option.value
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {option.value ? initial : <Users className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {option.label}
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum produtor encontrado.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function getEventStatusPresentation(event: AgendaEvent, todayYmd: string) {
  if (event.kind === "PLANTING") {
    if (!event.plantingDate) {
      return {
        label: "Sem data",
        borderClass: "bg-warning",
        badgeClass: "border-warning-border bg-warning-soft text-warning-strong",
        showWarning: true,
      };
    }
    return {
      label: "Plantio",
      borderClass: "bg-primary",
      badgeClass: "border-primary/30 bg-primary-soft text-primary-strong",
      showWarning: false,
    };
  }
  if (event.isLate) {
    return {
      label: "Atrasada",
      borderClass: "bg-danger",
      badgeClass: "border-danger-border bg-danger-soft text-danger-strong",
      showWarning: true,
    };
  }
  if (event.ymd === todayYmd) {
    return {
      label: "Hoje",
      borderClass: "bg-primary",
      badgeClass: "border-primary-border bg-primary-soft text-primary-strong",
      showWarning: false,
    };
  }
  return {
    label: "Pendente",
    borderClass: "bg-warning",
    badgeClass: "border-warning-border bg-warning-soft text-warning-strong",
    showWarning: false,
  };
}

function AgendaEventCard({
  event,
  todayYmd,
  selectable = false,
  selected = false,
  onToggle,
}: {
  event: AgendaEvent;
  todayYmd: string;
  /** Modo seleção (registro em massa): o card não navega e vira alvo de seleção. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const status = getEventStatusPresentation(event, todayYmd);
  const eventDate = format(localYmdToDate(event.ymd), "d MMM", { locale: ptBR });
  const isPlanting = event.kind === "PLANTING";

  const body = (
    <>
      <span
        className={cn("h-10 w-[3px] shrink-0 rounded-full", status.borderClass)}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
          {event.applicationTitle}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {event.plotName} · {eventDate}
        </p>
      </div>
    </>
  );

  const statusBadge = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
        status.badgeClass,
      )}
    >
      {status.showWarning ? <AlertTriangle className="h-3 w-3" /> : null}
      {status.label}
    </span>
  );

  // Plantio: não entra no registro em massa de aplicações.
  if (isPlanting) {
    return (
      <li>
        <div className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
          <Link
            href={routes.safras.cronograma(event.seasonId)}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            {body}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {statusBadge}
            <PlantingDateRegisterPopover
              seasonId={event.seasonId}
              currentPlantingDate={event.plantingDate}
              mode={event.plantingDate ? "edit" : "register"}
            />
          </div>
        </div>
      </li>
    );
  }

  if (selectable && isApplicationEvent(event)) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-all",
            selected
              ? "border-primary/50 ring-1 ring-primary/20"
              : "border-border/80 hover:border-primary/30",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
            aria-hidden
          >
            {selected ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
          {body}
          {statusBadge}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
        <Link
          href={routes.safras.cronograma(event.seasonId)}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge}
          <RecommendationRegisterPopover
            seasonId={event.seasonId}
            recommendationId={event.recommendationId}
            title={event.applicationTitle}
          />
        </div>
      </div>
    </li>
  );
}
