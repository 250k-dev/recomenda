import { addDays, differenceInCalendarDays } from "date-fns";
import { dateToLocalYmd, localYmdToDate } from "@/lib/utils/dates";

export const TIMING_WINDOW_TOLERANCE_DAYS = 2;

/** Âncora de preview no editor de modelos (safra real recalcula na publicação). */
export const TIMING_REFERENCE_YMD = "2026-01-01";

export function dayOffsetToIsoDate(dayOffset: number): string {
  const normalized = Number.isFinite(dayOffset) ? Math.round(dayOffset) : 0;
  return dateToLocalYmd(
    addDays(localYmdToDate(TIMING_REFERENCE_YMD), normalized),
  );
}

export function isoDateToDayOffset(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 0;
  return differenceInCalendarDays(
    localYmdToDate(isoDate),
    localYmdToDate(TIMING_REFERENCE_YMD),
  );
}

export function todayLocalYmd(): string {
  return dateToLocalYmd(new Date());
}

export function windowDatesFromRecommendedYmd(centerYmd: string): {
  startYmd: string;
  centerYmd: string;
  endYmd: string;
} {
  const safeCenter =
    /^\d{4}-\d{2}-\d{2}$/.test(centerYmd) ? centerYmd : todayLocalYmd();
  const center = localYmdToDate(safeCenter);

  return {
    startYmd: dateToLocalYmd(addDays(center, -TIMING_WINDOW_TOLERANCE_DAYS)),
    centerYmd: safeCenter,
    endYmd: dateToLocalYmd(addDays(center, TIMING_WINDOW_TOLERANCE_DAYS)),
  };
}

export function targetDayToWindow(targetDay: number): {
  window_start_days: number;
  window_end_days: number;
} {
  const normalized = Number.isFinite(targetDay) ? Math.round(targetDay) : 0;
  return {
    window_start_days: normalized - TIMING_WINDOW_TOLERANCE_DAYS,
    window_end_days: normalized + TIMING_WINDOW_TOLERANCE_DAYS,
  };
}

export function recommendedYmdToWindow(centerYmd: string): {
  window_start_days: number;
  window_end_days: number;
} {
  return targetDayToWindow(isoDateToDayOffset(centerYmd));
}

export function windowToRecommendedYmd(
  windowStartDays: number,
  windowEndDays: number,
): string {
  return dayOffsetToIsoDate(windowToTargetDay(windowStartDays, windowEndDays));
}

export function windowToTargetDay(windowStartDays: number, windowEndDays: number): number {
  return Math.round((windowStartDays + windowEndDays) / 2);
}

export function recommendationWindowSpanDays(
  windowStartDays: number,
  windowEndDays: number,
): number {
  return Math.max(windowEndDays - windowStartDays, 0);
}
