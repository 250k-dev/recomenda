/**
 * Sugestão de estádio fenológico pela posição da etapa no ciclo.
 *
 * As etapas são marcadas em dias após o plantio (DAP); a receita fala a
 * língua da bula (V3, R1…). A tabela é uma MÉDIA por cultura — a velocidade
 * real muda com variedade, clima e região —, por isso é só sugestão: o
 * agrônomo corrige na etapa ou no modelo (`phenological_stage`).
 *
 * Sem imports relativos: testado com `node --test` direto no .ts.
 */

type StageTable = ReadonlyArray<readonly [maxDap: number, stage: string]>;

/** Soja (escala Fehr & Caviness). */
const SOYBEAN: StageTable = [
  [4, "Pré-emergência"],
  [8, "VE"],
  [12, "V1"],
  [16, "V2"],
  [22, "V3–V4"],
  [30, "V4–V6"],
  [40, "V6–V8"],
  [50, "R1–R2"],
  [60, "R3"],
  [72, "R4–R5.1"],
  [85, "R5.3–R5.5"],
  [100, "R6"],
  [Infinity, "R7–R8"],
];

/** Milho (escala de Ritchie & Hanway). */
const CORN: StageTable = [
  [4, "Pré-emergência"],
  [8, "VE"],
  [14, "V2"],
  [21, "V4"],
  [30, "V6"],
  [40, "V8"],
  [50, "V10–V12"],
  [60, "VT"],
  [70, "R1"],
  [85, "R2–R3"],
  [100, "R4"],
  [115, "R5"],
  [Infinity, "R6"],
];

/** Feijão (escala CIAT). */
const BEAN: StageTable = [
  [4, "Pré-emergência"],
  [8, "V1"],
  [13, "V2"],
  [20, "V3"],
  [30, "V4"],
  [35, "R5"],
  [45, "R6"],
  [55, "R7"],
  [75, "R8"],
  [Infinity, "R9"],
];

const TABLES: Record<string, StageTable> = { SOYBEAN, CORN, BEAN };

export interface PhenologySuggestion {
  stage: string;
  /** Faixa de dias da etapa, para exibir junto ("16–20 DAP"); null fora do pós-plantio. */
  dapLabel: string | null;
}

/**
 * Estádio sugerido para a etapa. Pré-plantio é "Pré-semeadura"; plantio,
 * "Semeadura"; pós-plantio usa o meio da janela na tabela da cultura.
 * Cultura sem tabela (ou "ANY") cai na da soja.
 */
export function suggestPhenologicalStage(
  crop: string | null | undefined,
  triggerType: string | null | undefined,
  windowStartDays: number,
  windowEndDays: number,
): PhenologySuggestion {
  if (triggerType === "PRE_PLANTING") return { stage: "Pré-semeadura", dapLabel: null };
  if (triggerType === "PLANTING") return { stage: "Semeadura", dapLabel: null };
  const table = TABLES[crop ?? ""] ?? SOYBEAN;
  const start = Math.min(windowStartDays, windowEndDays);
  const end = Math.max(windowStartDays, windowEndDays);
  const mid = (start + end) / 2;
  const stage = (table.find(([maxDap]) => mid <= maxDap) ?? table[table.length - 1])[1];
  return { stage, dapLabel: start === end ? `${start} DAP` : `${start}–${end} DAP` };
}
