"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import {
  applyRecommendation,
  getSeasons,
  getTimeline,
  skipRecommendation,
  type Recommendation,
} from "@recomenda/api/seasons";
import { recommendationWindowSpanDays } from "@recomenda/domain/timing/window-days";
import { localYmdToDate } from "@recomenda/utils";
import { queryKeys } from "./queryKeys";
import { invalidateAfterRecommendationExecution } from "./seasons";

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
  /** Id da recomendação (etapa) — permite registrar/pular direto da agenda. */
  recommendationId: string;
  /** Dia único usado no mini calendário (um ponto por recomendação). */
  displayYmd: string;
  applicationTitle: string;
  farmName: string;
  producerName: string;
  plotName: string;
  seasonId: string;
  isLate: boolean;
  pillLabel: string;
  windowEndYmd: string;
  isCenterDay: boolean;
};

export type AgronomistAgendaResult = {
  eventsByDay: Record<string, AgendaEvent[]>;
  calendarMarkersByDay: Record<string, AgendaEvent[]>;
  monthEventCount: number;
  totalEventCount: number;
  todayCount: number;
  lateCount: number;
  /** Programações em rascunho (não publicadas) — invisíveis no cronograma. */
  draftCount: number;
  isLoading: boolean;
  isError: boolean;
};

function localTodayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function ymdFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Reexportado porque `month-calendar.tsx` já o importa daqui junto com os
// hooks de agenda. A implementação é a de `@recomenda/utils`.
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

function recommendationWindowDays(raw: unknown): {
  startYmd: string;
  endYmd: string;
  centerYmd: string;
  days: string[];
} | null {
  const predictedYmd = recommendationYmd(raw);
  if (!predictedYmd || !raw || typeof raw !== "object") return null;

  // Janela centrada na data prevista (data ± metade do span). Atrasada só depois
  // do fim da janela (data + metade do span).
  const r = raw as Recommendation;
  const span = recommendationWindowSpanDays(r.window_start_days ?? 0, r.window_end_days ?? 0);
  const half = Math.round(span / 2);
  const predictedDate = localYmdToDate(predictedYmd);
  const startYmd = ymdFromDate(addDays(predictedDate, -half));
  const endYmd = ymdFromDate(addDays(predictedDate, half));
  const centerYmd = predictedYmd;
  const days = Array.from({ length: span + 1 }, (_, index) =>
    ymdFromDate(addDays(predictedDate, index - half)),
  );

  return { startYmd, endYmd, centerYmd, days };
}

/** Um único dia de destaque no mini calendário por recomendação pendente. */
export function recommendationDisplayYmd(
  window: { startYmd: string; endYmd: string; centerYmd: string },
  today: string,
): string {
  if (window.endYmd < today) return window.endYmd;
  if (today >= window.startYmd && today <= window.endYmd) return today;
  return window.centerYmd;
}

function agendaPanelDays(
  window: { endYmd: string },
  displayYmd: string,
  today: string,
): string[] {
  if (window.endYmd < today && displayYmd !== today) {
    return [displayYmd, today];
  }
  return [displayYmd];
}

function pillLabelForEvent(
  displayYmd: string,
  today: string,
  windowEndYmd: string,
): { label: string; isLate: boolean } {
  if (windowEndYmd < today) {
    const days = differenceInCalendarDays(localYmdToDate(today), localYmdToDate(windowEndYmd));
    return {
      label: days === 1 ? "Atraso 1 dia" : `Atraso ${days} dias`,
      isLate: true,
    };
  }
  if (displayYmd === today) return { label: "Hoje", isLate: false };
  const days = differenceInCalendarDays(localYmdToDate(displayYmd), localYmdToDate(today));
  if (days > 0) return { label: days === 1 ? "Amanhã" : `Em ${days} dias`, isLate: false };
  return { label: "Na janela", isLate: false };
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

  // Rascunhos não aparecem no cronograma — contamos para poder explicar um
  // calendário vazio ("publique a safra") em vez de sumir com o trabalho.
  const draftCount = allSeasons.filter(
    (s) => s.status === "DRAFT" && (!producerId || s.producer_id === producerId),
  ).length;

  const pendingCandidates: {
    season: AgendaSeasonRow;
    r: Recommendation;
    window: NonNullable<ReturnType<typeof recommendationWindowDays>>;
  }[] = [];

  for (let i = 0; i < seasons.length; i += BATCH_SIZE) {
    const chunk = seasons.slice(i, i + BATCH_SIZE);
    const timelines = await Promise.all(
      chunk.map((s) => getTimeline(s.id).then((rows) => ({ season: s, rows }))),
    );

    for (const { season, rows } of timelines) {
      for (const raw of rows) {
        if (recommendationStatus(raw) !== "PENDING") continue;
        const window = recommendationWindowDays(raw);
        if (!window) continue;
        pendingCandidates.push({ season, r: raw as Recommendation, window });
      }
    }
  }

  const ordered = pendingCandidates
    .sort((a, b) => a.window.startYmd.localeCompare(b.window.startYmd))
    .slice(0, MAX_EVENTS);

  const eventsByDay: Record<string, AgendaEvent[]> = {};
  const calendarMarkersByDay: Record<string, AgendaEvent[]> = {};
  let todayCount = 0;
  let lateCount = 0;
  const countedToday = new Set<string>();
  const countedLate = new Set<string>();

  for (const { season, r, window } of ordered) {
    const recommendationKey = `${season.id}-${r.id}`;
    const displayYmd = recommendationDisplayYmd(window, today);
    // Dessecação é sempre manual — nunca conta como atrasada (item 23).
    const isDesiccation = /dessec/i.test(r.name ?? "");
    const { label, isLate: rawLate } = pillLabelForEvent(displayYmd, today, window.endYmd);
    const isLate = rawLate && !isDesiccation;
    const pillText = rawLate && isDesiccation ? "Manual" : label;

    if (isLate && !countedLate.has(recommendationKey)) {
      lateCount += 1;
      countedLate.add(recommendationKey);
    }
    if (
      today >= window.startYmd &&
      today <= window.endYmd &&
      !countedToday.has(recommendationKey)
    ) {
      todayCount += 1;
      countedToday.add(recommendationKey);
    }

    const baseEvent: Omit<AgendaEvent, "id" | "ymd"> = {
      recommendationId: r.id,
      displayYmd,
      applicationTitle: recommendationTitle(r),
      farmName: season.farm_name?.trim() || "Fazenda",
      producerName: season.producer_name?.trim() || "Produtor",
      plotName: season.plot_name?.trim() || "Talhão",
      seasonId: season.id,
      isLate,
      pillLabel: pillText,
      windowEndYmd: window.endYmd,
      isCenterDay: displayYmd === window.centerYmd,
    };

    if (!calendarMarkersByDay[displayYmd]) calendarMarkersByDay[displayYmd] = [];
    calendarMarkersByDay[displayYmd].push({
      ...baseEvent,
      id: `${recommendationKey}-marker`,
      ymd: displayYmd,
    });

    for (const ymd of agendaPanelDays(window, displayYmd, today)) {
      const event: AgendaEvent = {
        ...baseEvent,
        id: `${recommendationKey}-${ymd}`,
        ymd,
      };
      if (!eventsByDay[ymd]) eventsByDay[ymd] = [];
      eventsByDay[ymd].push(event);
    }
  }

  return {
    eventsByDay,
    calendarMarkersByDay,
    totalEventCount: ordered.length,
    todayCount,
    lateCount,
    draftCount,
  };
}

export function dedupeAgendaEvents(events: AgendaEvent[]): AgendaEvent[] {
  const byRec = new Map<string, AgendaEvent>();
  for (const event of events) {
    const key = event.id.replace(/-(?:\d{4}-\d{2}-\d{2}|marker)$/, "");
    const existing = byRec.get(key);
    if (!existing) {
      byRec.set(key, event);
      continue;
    }
    if (event.ymd === event.displayYmd) byRec.set(key, event);
  }
  return [...byRec.values()];
}

export function useAgronomistAgenda(month: Date, producerId?: string) {
  const query = useQuery({
    queryKey: [...queryKeys.agronomistAgenda(producerId)],
    queryFn: () => fetchAgendaEvents(producerId),
    staleTime: 60_000,
  });

  const monthEventCount = useMemo(() => {
    const markersByDay = query.data?.calendarMarkersByDay ?? {};
    const monthStart = ymdFromDate(startOfMonth(month));
    const monthEnd = ymdFromDate(endOfMonth(month));
    return Object.entries(markersByDay).reduce((sum, [ymd, events]) => {
      if (ymd >= monthStart && ymd <= monthEnd) return sum + events.length;
      return sum;
    }, 0);
  }, [query.data?.calendarMarkersByDay, month]);

  return {
    eventsByDay: query.data?.eventsByDay ?? {},
    calendarMarkersByDay: query.data?.calendarMarkersByDay ?? {},
    monthEventCount,
    totalEventCount: query.data?.totalEventCount ?? 0,
    todayCount: query.data?.todayCount ?? 0,
    lateCount: query.data?.lateCount ?? 0,
    draftCount: query.data?.draftCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  } satisfies AgronomistAgendaResult;
}

export function weekDaysForAgenda(anchor: Date): Date[] {
  const start = addDays(anchor, -((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export type BulkRegisterInput = {
  action: "apply" | "skip";
  /** Data de execução (só usada em "apply"). */
  date: string;
  notes?: string;
  items: Array<{ seasonId: string; recommendationId: string }>;
};

export type BulkRegisterResult = {
  ok: number;
  failed: number;
  seasonIds: string[];
};

/**
 * Registro em massa do cronograma: aplica (ou pula) várias etapas com uma data só.
 * Não há endpoint batch no server — resolve item a item com `Promise.allSettled`,
 * tolera falha parcial e invalida a agenda + as timelines das safras afetadas.
 */
export function useBulkRegisterRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      date,
      notes,
      items,
    }: BulkRegisterInput): Promise<BulkRegisterResult> => {
      const results = await Promise.allSettled(
        items.map((it) =>
          action === "apply"
            ? applyRecommendation(it.recommendationId, {
                executed_date: date,
                notes,
              })
            : skipRecommendation(it.recommendationId, notes),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      return {
        ok,
        failed: results.length - ok,
        seasonIds: [...new Set(items.map((it) => it.seasonId))],
      };
    },
    onSuccess: ({ seasonIds }) => {
      // Mesmo conjunto de caches do registro individual, por safra afetada.
      for (const seasonId of seasonIds) {
        invalidateAfterRecommendationExecution(queryClient, seasonId);
      }
    },
  });
}
