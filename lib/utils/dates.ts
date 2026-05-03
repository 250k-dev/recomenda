import { formatInTimeZone } from "date-fns-tz";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function formatDateBR(value: string | Date, format = "dd/MM/yyyy") {
  return formatInTimeZone(value, DEFAULT_TIME_ZONE, format);
}
