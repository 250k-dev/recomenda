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
  getAgenda,
  skipRecommendation,
  type AgendaApiPending,
  type AgendaApiSeason,
} from "@recomenda/api/seasons";
import { recommendationWindowSpanDays } from "@recomenda/domain/timing/window-days";
import { localYmdToDate } from "@recomenda/utils";
import { queryKeys } from "./queryKeys";
import { invalidateAfterRecommendationExecution } from "./seasons";
import { useWalletScopeKey } from "./use-active-scope";

const MAX_EVENTS = 500;

export type AgendaSeasonRow = AgendaApiSeason;

export type AgendaEventKind = "APPLICATION" | "PLANTING";

export type AgendaEvent = {
  id: string;
  ymd: string;
  /** APPLICATION = etapa; PLANTING = registro/edição de plantio da safra. */
  kind: AgendaEventKind;
  /** Id da recomendação (etapa) — vazio em eventos de plantio. */
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
  /** Data de plantio atual (só PLANTING). */
  plantingDate?: string | null;
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

function recommendationTitle(r: AgendaApiPending): string {
  return r.name?.trim() || "Aplicação";
}

function recommendationYmd(r: AgendaApiPending): string | null {
  const ymd = String(
    r.predicted_date_current ?? r.predicted_date_original ?? "",
  ).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

function recommendationWindowDays(r: AgendaApiPending): {
  startYmd: string;
  endYmd: string;
  centerYmd: string;
  days: string[];
} | null {
  const predictedYmd = recommendationYmd(r);
  if (!predictedYmd) return null;

  // Janela centrada na data prevista (data ± metade do span). Atrasada só depois
  // do fim da janela (data + metade do span).
  const span = recommendationWindowSpanDays(
    r.window_start_days ?? 0,
    r.window_end_days ?? 0,
  );
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

  // 1 request: safras ativas + PENDING (substitui N timelines).
  const agenda = await getAgenda(producerId);
  const seasons = agenda.seasons;
  const draftCount = agenda.draft_count;
  const seasonById = new Map(seasons.map((s) => [s.id, s]));

  const pendingCandidates: {
    season: AgendaSeasonRow;
    r: AgendaApiPending;
    window: NonNullable<ReturnType<typeof recommendationWindowDays>>;
  }[] = [];

  for (const r of agenda.pending) {
    const season = seasonById.get(r.season_id);
    if (!season) continue;
    const window = recommendationWindowDays(r);
    if (!window) continue;
    pendingCandidates.push({ season, r, window });
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

  // Plantio: sem data → painel de pendências (hoje); com data → marker no dia.
  for (const season of seasons) {
    const plantingYmd = String(season.planting_date ?? "").slice(0, 10);
    const hasPlanting = /^\d{4}-\d{2}-\d{2}$/.test(plantingYmd);
    const displayYmd = hasPlanting ? plantingYmd : today;
    const plantingKey = `planting-${season.id}`;
    const basePlanting: Omit<AgendaEvent, "id" | "ymd"> = {
      kind: "PLANTING",
      recommendationId: "",
      displayYmd,
      applicationTitle: hasPlanting ? "Plantio" : "Adicionar data de plantio",
      farmName: season.farm_name?.trim() || "Fazenda",
      producerName: season.producer_name?.trim() || "Produtor",
      plotName: season.plot_name?.trim() || "Talhão",
      seasonId: season.id,
      isLate: false,
      pillLabel: hasPlanting ? "Plantio" : "Sem data",
      windowEndYmd: displayYmd,
      isCenterDay: true,
      plantingDate: hasPlanting ? plantingYmd : null,
    };

    if (hasPlanting) {
      if (!calendarMarkersByDay[displayYmd]) calendarMarkersByDay[displayYmd] = [];
      calendarMarkersByDay[displayYmd].push({
        ...basePlanting,
        id: `${plantingKey}-marker`,
        ymd: displayYmd,
      });
    }

    const panelYmd = hasPlanting ? plantingYmd : today;
    if (!eventsByDay[panelYmd]) eventsByDay[panelYmd] = [];
    eventsByDay[panelYmd].push({
      ...basePlanting,
      id: `${plantingKey}-${panelYmd}`,
      ymd: panelYmd,
    });
  }

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
      kind: "APPLICATION",
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
  const scopeKey = useWalletScopeKey();

  const query = useQuery({
    queryKey: [...queryKeys.agronomistAgenda(producerId), scopeKey],
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
