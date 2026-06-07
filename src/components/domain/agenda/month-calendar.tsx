"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRight,
  Clock,
  Leaf,
  MapPin,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgronomistAgenda, localYmdToDate, type AgendaEvent } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type MonthCalendarProps = {
  producerId?: string;
  title?: string;
  focusNearestEvent?: boolean;
};

export function MonthCalendar({
  producerId,
  title,
  focusNearestEvent = false,
}: MonthCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const didAutoFocus = useRef(false);

  const { eventsByDay, monthEventCount, totalEventCount, todayCount, lateCount, isLoading, isError } =
    useAgronomistAgenda(month, producerId);

  const nextEventYmd = useMemo(() => {
    const ymds = Object.keys(eventsByDay).sort();
    if (ymds.length === 0) return null;
    const todayYmd = format(new Date(), "yyyy-MM-dd");
    return ymds.find((ymd) => ymd >= todayYmd) ?? ymds[ymds.length - 1];
  }, [eventsByDay]);

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
  const today = new Date();
  const previewLimit = 2;

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
      <div className="min-w-0 md:flex-1">
        {/* Cabeçalho */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              {title ? (
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[148px] text-center text-base font-semibold capitalize tracking-tight text-foreground">
                  {format(month, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        {!isLoading && !isError ? (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AgendaKpi
              label="Hoje"
              value={todayCount}
              icon={<Clock className="h-4 w-4" />}
              accent="primary"
              active={todayCount > 0}
            />
            <AgendaKpi
              label="Atrasadas"
              value={lateCount}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="sun"
              active={lateCount > 0}
            />
            <AgendaKpi
              label="Este mês"
              value={monthEventCount}
              icon={<CalendarDays className="h-4 w-4" />}
              accent="sky"
              active={monthEventCount > 0}
            />
            <AgendaKpi
              label="Total pendente"
              value={totalEventCount}
              icon={<Leaf className="h-4 w-4" />}
              accent="clay"
              active={totalEventCount > 0}
            />
          </div>
        ) : null}

        {!isLoading && !isError && monthEventCount === 0 && totalEventCount > 0 && nextEventYmd ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm shadow-sm">
            <span className="text-muted-foreground">
              Nenhuma aplicação neste mês, mas há{" "}
              <strong className="font-semibold text-foreground">{totalEventCount}</strong> pendente
              {totalEventCount === 1 ? "" : "s"} no cronograma.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => {
                const targetDate = localYmdToDate(nextEventYmd);
                setMonth(startOfMonth(targetDate));
                setSelectedDay(targetDate);
              }}
            >
              Ir para {format(localYmdToDate(nextEventYmd), "MMMM yyyy", { locale: ptBR })}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && totalEventCount === 0 ? (
          <div className="mb-4 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Nenhuma aplicação pendente nas safras publicadas
            {producerId ? " deste produtor" : ""}.
          </div>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-[340px] w-full rounded-xl" />
        ) : isError ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Não foi possível carregar o cronograma.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="grid grid-cols-7 border-b bg-muted/30 px-2 pt-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 p-2 sm:gap-2 sm:p-3">
              {calendarDays.map((day) => {
                const ymd = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay[ymd] ?? [];
                const inMonth = isSameMonth(day, month);
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDay);
                const hasLate = dayEvents.some((e) => e.isLate);
                const hasEvents = dayEvents.length > 0;
                const isTodayWithEvents = isToday && hasEvents;

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${
                      hasEvents ? `, ${dayEvents.length} aplicações` : ""
                    }`}
                    aria-current={isSelected ? "date" : undefined}
                    className={cn(
                      "group/day relative flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition-all duration-150 sm:min-h-[80px] sm:p-2",
                      !inMonth && "opacity-45",
                      !hasEvents && inMonth && "border-transparent bg-muted/25 hover:bg-muted/40",
                      !hasEvents && !inMonth && "border-transparent bg-transparent hover:bg-muted/20",
                      hasEvents &&
                        !hasLate &&
                        "border-primary/30 bg-primary/[0.07] shadow-sm hover:border-primary/45 hover:bg-primary/10",
                      hasEvents &&
                        hasLate &&
                        "border-amber-300/60 bg-amber-50 shadow-sm hover:border-amber-400/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
                      isToday && !hasEvents && "border-primary/40 bg-primary/5 ring-1 ring-primary/25",
                      isTodayWithEvents && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                      isSelected &&
                        !isTodayWithEvents &&
                        "border-primary/50 ring-2 ring-primary/35 ring-offset-1 ring-offset-card",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                          isToday && "bg-primary text-primary-foreground shadow-sm",
                          !isToday && hasEvents && hasLate && "text-amber-800 dark:text-amber-200",
                          !isToday && hasEvents && !hasLate && "text-primary",
                          !isToday && !hasEvents && "text-foreground/80",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {hasEvents ? (
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                            hasLate
                              ? "bg-amber-500 text-white"
                              : isToday
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/15 text-primary",
                          )}
                        >
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>

                    {hasEvents ? (
                      <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                        {dayEvents.slice(0, previewLimit).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "truncate text-[10px] font-medium leading-tight sm:text-[11px]",
                              event.isLate
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-primary",
                            )}
                          >
                            {event.applicationTitle}
                          </span>
                        ))}
                        {dayEvents.length > previewLimit ? (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            +{dayEvents.length - previewLimit} mais
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="mt-auto hidden text-[10px] text-muted-foreground/0 transition-colors group-hover/day:text-muted-foreground/40 sm:block">
                        —
                      </span>
                    )}

                    {hasLate ? (
                      <span className="absolute bottom-1 right-1 hidden h-1.5 w-1.5 rounded-full bg-amber-500 sm:block" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Painel do dia */}
      <div className="min-w-0 md:w-[380px] md:shrink-0">
        <Card
          className={cn(
            "overflow-hidden shadow-sm",
            selectedEvents.length > 0 && "border-primary/25",
          )}
        >
          <div
            className={cn(
              "border-b px-4 py-3",
              selectedEvents.length > 0 ? "bg-primary/6" : "bg-muted/30",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Aplicações do dia
            </p>
            <p className="mt-0.5 text-base font-semibold capitalize tracking-tight text-foreground">
              {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            {selectedEvents.length > 0 ? (
              <Badge variant="secondary" className="mt-2">
                {selectedEvents.length}{" "}
                {selectedEvents.length === 1 ? "aplicação" : "aplicações"}
              </Badge>
            ) : null}
          </div>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Nenhuma aplicação pendente neste dia.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Selecione um dia destacado no calendário.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {selectedEvents.map((event) => (
                  <AgendaEventCard key={event.id} event={event} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type KpiAccent = "primary" | "sun" | "sky" | "clay";

const kpiAccentClasses: Record<KpiAccent, { icon: string; active: string }> = {
  primary: {
    icon: "bg-primary/10 text-primary",
    active: "border-primary/30 bg-primary/[0.04]",
  },
  sun: {
    icon: "bg-amber-100 text-amber-600",
    active: "border-amber-300/50 bg-amber-50/80",
  },
  sky: {
    icon: "bg-sky-100 text-sky-600",
    active: "border-sky-300/50 bg-sky-50/80",
  },
  clay: {
    icon: "bg-orange-100 text-orange-600",
    active: "border-orange-300/50 bg-orange-50/80",
  },
};

function AgendaKpi({
  label,
  value,
  icon,
  accent,
  active,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent: KpiAccent;
  active: boolean;
}) {
  const styles = kpiAccentClasses[accent];
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors",
        active && styles.active,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          styles.icon,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums leading-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

function AgendaEventCard({ event }: { event: AgendaEvent }) {
  return (
    <li>
      <Link
        href={`/seasons/${event.seasonId}`}
        className={cn(
          "group block overflow-hidden rounded-xl border bg-background shadow-sm transition-all duration-150",
          "hover:border-primary/40 hover:shadow-md",
          event.isLate
            ? "border-amber-300/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            : "hover:bg-primary/3",
        )}
      >
        <div
          className={cn(
            "h-1 w-full",
            event.isLate ? "bg-amber-400" : "bg-primary/70",
          )}
        />
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                {event.applicationTitle}
              </p>
              <div className="mt-2 space-y-1">
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                  {event.farmName} · {event.plotName}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Sprout className="h-3 w-3 shrink-0 text-primary/70" />
                  {event.producerName}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px] font-semibold",
                event.isLate
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : event.pillLabel === "Hoje"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border",
              )}
            >
              {event.pillLabel}
            </Badge>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
            Ver safra
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}
