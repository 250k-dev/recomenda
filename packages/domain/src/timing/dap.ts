/**
 * DAP (dias em relação ao plantio) para exibir. O número é a distância em
 * dias; o sinal da etapa de pré-plantio vem da fase (`-N DAP`).
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

/**
 * Selo da etapa. Pré-plantio sempre leva o sinal negativo (`-7 DAP`):
 * a fase conta para trás do plantio. As outras fases seguem `dapLabel`.
 */
export function stageDapLabel(
  triggerType: string | null | undefined,
  plantingDate: string | null | undefined,
  date: string | null | undefined,
): string | null {
  const days = daysFromPlanting(plantingDate, date);
  if (days == null) return null;
  if (days === 0) return "No plantio";
  if (triggerType === "PRE_PLANTING") return `-${Math.abs(days)} DAP`;
  return dapLabel(days);
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
