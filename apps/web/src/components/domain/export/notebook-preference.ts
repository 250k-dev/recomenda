/**
 * Lembra a montagem do Caderno de Safra (ordem das seções, o que está ligado,
 * quantas folhas de anotação) entre exports.
 *
 * É só conveniência: o agrônomo que monta o caderno de um jeito costuma querer
 * o mesmo na safra seguinte. A validação de verdade é `normalizeNotebookSections`,
 * que sabe descartar seção que não existe mais e completar seção nova.
 */
import {
  DEFAULT_NOTEBOOK_SECTIONS,
  DEFAULT_NOTES_PAGES,
  normalizeNotebookSections,
  resolveNotesPages,
  type NotebookSectionState,
} from "@recomenda/domain/season-notebook/notebook-document";

const KEY = "recomenda:export:notebook";

export interface NotebookPreference {
  sections: NotebookSectionState[];
  detailedSchedule: boolean;
  notesPages: number;
}

export const DEFAULT_NOTEBOOK_PREFERENCE: NotebookPreference = {
  sections: DEFAULT_NOTEBOOK_SECTIONS,
  detailedSchedule: false,
  notesPages: DEFAULT_NOTES_PAGES,
};

export function readNotebookPreference(): NotebookPreference {
  if (typeof window === "undefined") return DEFAULT_NOTEBOOK_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTEBOOK_PREFERENCE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_NOTEBOOK_PREFERENCE;

    const value = parsed as Partial<NotebookPreference>;
    const notesPages = Number(value.notesPages);
    return {
      sections: normalizeNotebookSections(value.sections),
      detailedSchedule: value.detailedSchedule === true,
      // `resolveNotesPages` aceita 0: o clamp anterior tinha mínimo 1 e
      // ressuscitava uma folha de anotação a cada recarga.
      notesPages: Number.isFinite(notesPages)
        ? resolveNotesPages(notesPages)
        : DEFAULT_NOTES_PAGES,
    };
  } catch {
    // JSON inválido ou localStorage indisponível — vale o padrão.
    return DEFAULT_NOTEBOOK_PREFERENCE;
  }
}

export function writeNotebookPreference(value: NotebookPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Aba anônima / cota estourada — a montagem vale só nesta tela.
  }
}
