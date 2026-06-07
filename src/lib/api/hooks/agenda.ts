"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { getSeasons, getTimeline, type Recommendation } from "@/lib/api/seasons";
import { queryKeys } from "./queryKeys";

const BATCH_SIZE = 10;
const MAX_EVENTS = 500;

export type AgendaSeasonRow = {
  id: string;
  status: string;
  producer_id: string;
  plot_name?: string | null;
  farm_name?: string | null;
  farm_id?: string | null;
  producer_name?: string | null;
};

export type AgendaEvent = {
  id: string;
  ymd: string;
  applicationTitle: string;
  farmName: string;
  producerName: string;
  plotName: string;
  seasonId: string;
  isLate: boolean;
  pillLabel: string;
};

export type AgronomistAgendaResult = {
  eventsByDay: Record<string, AgendaEvent[]>;
  monthEventCount: number;
  totalEventCount: number;
  todayCount: number;
  lateCount: number;
  isLoading: boolean;
  isError: boolean;
};

function localTodayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function ymdFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function localYmdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export { localYmdToDate };

function recommendationTitle(r: Recommendation): string {
  return r.name?.trim() || "Aplicação";
}

function recommendationYmd(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const dateRaw =
    r.predicted_date_current ??
    r.predicted_date_original ??
    r.predictedDateCurrent ??
    r.predictedDateOriginal;
  const ymd = String(dateRaw ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

function recommendationStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const status = (raw as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

function pillLabelFor(ymd: string, today: string): { label: string; isLate: boolean } {
  const isLate = ymd < today;
  if (isLate) {
    const days = differenceInCalendarDays(localYmdToDate(today), localYmdToDate(ymd));
    return { label: days === 1 ? "Atraso 1 dia" : `Atraso ${days} dias`, isLate: true };
  }
  if (ymd === today) return { label: "Hoje", isLate: false };
  const days = differenceInCalendarDays(localYmdToDate(ymd), localYmdToDate(today));
  return { label: days === 1 ? "Amanhã" : `Em ${days} dias`, isLate: false };
}

async function fetchAgendaEvents(
  producerId?: string,
): Promise<Omit<AgronomistAgendaResult, "isLoading" | "isError" | "monthEventCount">> {
  const today = localTodayYmd();

  const seasonsResponse = await getSeasons();
  const allSeasons = (seasonsResponse.data ?? []) as unknown as AgendaSeasonRow[];

  let seasons = allSeasons.filter(
    (s) => s.status === "PUBLISHED" || s.status === "IN_PROGRESS",
  );
  if (producerId) {
    seasons = seasons.filter((s) => s.producer_id === producerId);
  }

  const pendingCandidates: {
    season: AgendaSeasonRow;
    r: Recommendation;
    ymd: string;
  }[] = [];

  for (let i = 0; i < seasons.length; i += BATCH_SIZE) {
    const chunk = seasons.slice(i, i + BATCH_SIZE);
    const timelines = await Promise.all(
      chunk.map((s) => getTimeline(s.id).then((rows) => ({ season: s, rows }))),
    );

    for (const { season, rows } of timelines) {
      for (const raw of rows) {
        if (recommendationStatus(raw) !== "PENDING") continue;
        const ymd = recommendationYmd(raw);
        if (!ymd) continue;
        pendingCandidates.push({ season, r: raw as Recommendation, ymd });
      }
    }
  }

  const ordered = pendingCandidates
    .sort((a, b) => a.ymd.localeCompare(b.ymd))
    .slice(0, MAX_EVENTS);

  const eventsByDay: Record<string, AgendaEvent[]> = {};
  let totalEventCount = 0;
  let todayCount = 0;
  let lateCount = 0;

  for (const { season, r, ymd } of ordered) {
    const { label, isLate } = pillLabelFor(ymd, today);
    const event: AgendaEvent = {
      id: `${season.id}-${r.id}`,
      ymd,
      applicationTitle: recommendationTitle(r),
      farmName: season.farm_name?.trim() || "Fazenda",
      producerName: season.producer_name?.trim() || "Produtor",
      plotName: season.plot_name?.trim() || "Talhão",
      seasonId: season.id,
      isLate,
      pillLabel: label,
    };
    if (!eventsByDay[ymd]) eventsByDay[ymd] = [];
    eventsByDay[ymd].push(event);
    totalEventCount += 1;
    if (ymd === today) todayCount += 1;
    if (isLate) lateCount += 1;
  }

  return { eventsByDay, totalEventCount, todayCount, lateCount };
}

export function useAgronomistAgenda(month: Date, producerId?: string) {
  const query = useQuery({
    queryKey: [...queryKeys.agronomistAgenda(producerId)],
    queryFn: () => fetchAgendaEvents(producerId),
    staleTime: 60_000,
  });

  const monthEventCount = useMemo(() => {
    const eventsByDay = query.data?.eventsByDay ?? {};
    const monthStart = ymdFromDate(startOfMonth(month));
    const monthEnd = ymdFromDate(endOfMonth(month));
    return Object.entries(eventsByDay).reduce((sum, [ymd, events]) => {
      if (ymd >= monthStart && ymd <= monthEnd) return sum + events.length;
      return sum;
    }, 0);
  }, [query.data?.eventsByDay, month]);

  return {
    eventsByDay: query.data?.eventsByDay ?? {},
    monthEventCount,
    totalEventCount: query.data?.totalEventCount ?? 0,
    todayCount: query.data?.todayCount ?? 0,
    lateCount: query.data?.lateCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  } satisfies AgronomistAgendaResult;
}

export function weekDaysForAgenda(anchor: Date): Date[] {
  const start = addDays(anchor, -((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
