// Aliasado: `formatDateBR` tem um parâmetro chamado `format`, que sombrearia o
// import dentro daquela função.
import { format as formatDateFns } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function formatDateBR(value: string | Date, format = "dd/MM/yyyy") {
  return formatInTimeZone(value, DEFAULT_TIME_ZONE, format);
}

/**
 * Helpers de data local (sem fuso) no formato `YYYY-MM-DD`, mais a máscara e o
 * parse do formato brasileiro `DD/MM/AAAA`. São primitivos de data puros — não
 * sabem nada de janela de recomendação — e por isso vivem aqui, e não em
 * `lib/timing`.
 */
export function localYmdToDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

export function dateToLocalYmd(date: Date): string {
  return formatDateFns(date, "yyyy-MM-dd");
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

export function formatTimingPreviewDate(ymd: string): string {
  return formatDateFns(localYmdToDate(ymd), "dd/MM/yyyy");
}
