"use client";

import {
  clearLocalDraft,
  readLocalDraft,
  writeLocalDraft,
} from "./use-local-draft";

export const LOCAL_DRAFT_SCHEMA_VERSION = 1;
/** Rascunhos locais expiram após 14 dias. */
export const LOCAL_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type LocalDraftEnvelope<T> = {
  v: number;
  savedAt: string;
  /** `updated_at` da lista no servidor quando o backup foi gravado. */
  listUpdatedAt?: string | null;
  data: T;
};

export function readVersionedLocalDraft<T>(key: string): {
  data: T;
  listUpdatedAt?: string | null;
} | null {
  const raw = readLocalDraft<LocalDraftEnvelope<T> | T>(key);
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "v" in raw && "data" in raw) {
    const env = raw as LocalDraftEnvelope<T>;
    if (env.v !== LOCAL_DRAFT_SCHEMA_VERSION) {
      clearLocalDraft(key);
      return null;
    }
    const age = Date.now() - new Date(env.savedAt).getTime();
    if (!Number.isFinite(age) || age > LOCAL_DRAFT_MAX_AGE_MS) {
      clearLocalDraft(key);
      return null;
    }
    return { data: env.data, listUpdatedAt: env.listUpdatedAt };
  }
  // Legado: envelope sem versão — aceita uma vez e regrava na próxima escrita.
  return { data: raw as T, listUpdatedAt: undefined };
}

export function writeVersionedLocalDraft<T>(
  key: string,
  data: T,
  meta?: { listUpdatedAt?: string | null },
) {
  writeLocalDraft(key, {
    v: LOCAL_DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    listUpdatedAt: meta?.listUpdatedAt ?? null,
    data,
  });
}
