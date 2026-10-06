/**
 * DAP (dias após o plantio) para exibir: o dia da lavoura em que uma data cai,
 * contado da data de plantio do talhão. Antes do plantio não existe DAP
 * negativo na fala do campo — vira "N dias antes do plantio".
 *
 * Puro (datas civis YYYY-MM-DD, sem fuso).
 */

function ymdToUtcDay(value: string | null | undefined): number | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : null;
}

/** Dias da `date` em relação ao plantio (negativo = antes). null sem as duas datas. */
export function daysFromPlanting(
  plantingDate: string | null | undefined,
  date: string | null | undefined,
): number | null {
  const planting = ymdToUtcDay(plantingDate);
  const day = ymdToUtcDay(date);
  return planting == null || day == null ? null : day - planting;
}

/** "35 DAP" · "No plantio" · "4 dias antes do plantio". */
export function dapLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) return "No plantio";
  if (days > 0) return `${days} DAP`;
  const before = -days;
  return `${before} ${before === 1 ? "dia" : "dias"} antes do plantio`;
}

/** DAP de uma data (prevista ou aplicada) do talhão. */
export function dapOf(
  plantingDate: string | null | undefined,
  date: string | null | undefined,
): string | null {
  return dapLabel(daysFromPlanting(plantingDate, date));
}

/** Hoje em YYYY-MM-DD local. */
export function todayYmd(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Onde a lavoura está hoje: "35 DAP", "No plantio" ou "Plantio em 5 dias".
 * null sem data de plantio.
 */
export function currentDapLabel(
  plantingDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const days = daysFromPlanting(plantingDate, todayYmd(now));
  if (days == null) return null;
  if (days < 0) return `Plantio em ${-days} ${days === -1 ? "dia" : "dias"}`;
  return dapLabel(days);
}
