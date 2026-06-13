import { addDays, differenceInCalendarDays, format } from "date-fns";

export const TIMING_WINDOW_TOLERANCE_DAYS = 2;

/** Âncora de preview no editor de modelos (safra real recalcula na publicação). */
export const TIMING_REFERENCE_YMD = "2026-01-01";

export function localYmdToDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

export function dateToLocalYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

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

export function maskBrazilianDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBrazilianDate(text: string): string | null {
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return dateToLocalYmd(date);
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

export function formatTimingPreviewDate(ymd: string): string {
  return format(localYmdToDate(ymd), "dd/MM/yyyy");
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
