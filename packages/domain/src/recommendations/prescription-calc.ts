/**
 * Calculadora da prescrição de aplicação (receita): calda, tanques e
 * quantidade de cada produto no total, por tanque e no último tanque.
 *
 * O banco só guarda VAZÃO (L/ha) e CAPACIDADE do tanque (L). Calda total e nº
 * de tanques são sempre derivados daqui — quem digita o total ou o nº de
 * tanques na tela está, na verdade, definindo a vazão ou a capacidade pela
 * conta inversa. Assim os números nunca ficam inconsistentes entre si.
 *
 * Regras:
 * - Nada é arredondado nos cálculos; só na exibição (`fmt*`).
 * - Entrada vazia, zero ou negativa → derivado `null` (nunca NaN/Infinity).
 * - Nº de tanques é decimal e não arredonda (4,371). Tanques cheios = piso;
 *   o que sobra vai no último tanque. Sobra 0 = não há tanque parcial.
 *
 * Sem imports relativos de propósito: os testes rodam com `node --test`
 * direto no .ts (Node 22 remove os tipos), e o Node exige extensão em import
 * relativo.
 */

/** Base da dose. Hoje o Recomenda grava tudo por hectare; as outras bases
 *  existem na calculadora para quando o cliente decidir usá-las. */
export type DoseBasis = "HA" | "PER_100L" | "PER_TANK";

export interface PrescriptionInput {
  areaHa: number | null | undefined;
  sprayVolumeLHa: number | null | undefined;
  tankCapacityL?: number | null | undefined;
}

export interface Prescription {
  areaHa: number | null;
  sprayVolumeLHa: number | null;
  /** Calda total = vazão × área. */
  totalMixL: number | null;
  tankCapacityL: number | null;
  /** Nº de tanques decimal = calda ÷ capacidade (4,371). */
  tankCount: number | null;
  /** Tanques cheios = piso do nº de tanques. */
  fullTanks: number | null;
  /** Calda do último tanque (parcial); 0 = não há tanque parcial. */
  lastTankL: number | null;
  /** Hectares cobertos por um tanque cheio = capacidade ÷ vazão. */
  haPerTank: number | null;
}

export interface ProductQuantities {
  total: number | null;
  perTank: number | null;
  lastTank: number | null;
}

// Tolerância de ponto flutuante: 15.200 ÷ 2.000 = 7,6 não pode virar 7,59999…
const EPS = 1e-9;

/** Número > 0, senão null. Aceita string pt-BR ("80,5"). */
export function positive(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function computePrescription(input: PrescriptionInput): Prescription {
  const areaHa = positive(input.areaHa);
  const sprayVolumeLHa = positive(input.sprayVolumeLHa);
  const tankCapacityL = positive(input.tankCapacityL);
  const totalMixL = areaHa != null && sprayVolumeLHa != null ? sprayVolumeLHa * areaHa : null;

  let tankCount: number | null = null;
  let fullTanks: number | null = null;
  let lastTankL: number | null = null;
  if (totalMixL != null && tankCapacityL != null) {
    tankCount = totalMixL / tankCapacityL;
    fullTanks = Math.floor(tankCount + EPS);
    const rest = totalMixL - fullTanks * tankCapacityL;
    lastTankL = rest > tankCapacityL * EPS ? rest : 0;
  }
  const haPerTank =
    tankCapacityL != null && sprayVolumeLHa != null ? tankCapacityL / sprayVolumeLHa : null;

  return {
    areaHa,
    sprayVolumeLHa,
    totalMixL,
    tankCapacityL,
    tankCount,
    fullTanks,
    lastTankL,
    haPerTank,
  };
}

/** Conta inversa: quem digitou a calda total define a vazão. */
export function sprayVolumeFromTotal(
  totalMixL: number | string | null | undefined,
  areaHa: number | null | undefined,
): number | null {
  const total = positive(totalMixL);
  const area = positive(areaHa);
  return total != null && area != null ? total / area : null;
}

/** Conta inversa: quem digitou o nº de tanques define a capacidade. */
export function tankCapacityFromCount(
  tankCount: number | string | null | undefined,
  totalMixL: number | null | undefined,
): number | null {
  const count = positive(tankCount);
  const total = positive(totalMixL);
  return count != null && total != null ? total / count : null;
}

/**
 * Quantidades de um produto. `areaFactor` (% da área, 0–1) só reduz o TOTAL:
 * a concentração no tanque é a mesma, então "por tanque" não muda.
 */
export function productQuantities(
  dose: number | string | null | undefined,
  prescription: Prescription,
  basis: DoseBasis = "HA",
  areaFactor: number | null | undefined = 1,
): ProductQuantities {
  const d = positive(dose);
  const factor = positive(areaFactor) ?? 1;
  const { areaHa, sprayVolumeLHa, totalMixL, tankCapacityL, tankCount, lastTankL } = prescription;
  if (d == null) return { total: null, perTank: null, lastTank: null };

  if (basis === "PER_100L") {
    return {
      total: totalMixL != null ? (d * totalMixL * factor) / 100 : null,
      perTank: tankCapacityL != null ? (d * tankCapacityL) / 100 : null,
      lastTank: lastTankL != null ? (d * lastTankL) / 100 : null,
    };
  }
  if (basis === "PER_TANK") {
    return {
      total: tankCount != null ? d * tankCount * factor : null,
      perTank: tankCapacityL != null ? d : null,
      lastTank: lastTankL != null && tankCapacityL != null ? d * (lastTankL / tankCapacityL) : null,
    };
  }
  return {
    total: areaHa != null ? d * areaHa * factor : null,
    perTank:
      tankCapacityL != null && sprayVolumeLHa != null ? (d * tankCapacityL) / sprayVolumeLHa : null,
    lastTank: lastTankL != null && sprayVolumeLHa != null ? (d * lastTankL) / sprayVolumeLHa : null,
  };
}

function fmt(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

/** Litros e doses: até 3 casas (65,565 · 2,186). */
export const fmtQuantity = (value: number | null | undefined) => fmt(value, 3);
/** Nº de tanques: 2 casas fixas (4,37). */
export function fmtTankCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Hectares: até 2 casas. */
export const fmtHectares = (value: number | null | undefined) => fmt(value, 2);
