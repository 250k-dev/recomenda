import { listItemToPayload, type ListItem } from "./list-item";

export type DraftRecoveryCandidate = {
  key: string;
  item: ListItem;
  kind: "new" | "changed";
};

export type DraftRecoveryRow = {
  key: string;
  item: ListItem;
  kind: "new" | "changed" | "unchanged";
};

function payloadOf(it: ListItem, listCrop?: string | null) {
  return listItemToPayload(it, listCrop ?? undefined);
}

/** Linhas do rascunho local que diferem do que está salvo no servidor. */
export function listDraftRecoveryCandidates(
  server: ListItem[],
  backup: ListItem[],
  listCrop?: string | null,
): DraftRecoveryCandidate[] {
  const serverByKey = new Map(server.map((it) => [it.key, it]));
  const out: DraftRecoveryCandidate[] = [];
  for (const item of backup) {
    const serverRow = serverByKey.get(item.key);
    if (!serverRow) {
      out.push({ key: item.key, item, kind: "new" });
      continue;
    }
    if (
      JSON.stringify(payloadOf(item, listCrop)) !==
      JSON.stringify(payloadOf(serverRow, listCrop))
    ) {
      out.push({ key: item.key, item, kind: "changed" });
    }
  }
  return out;
}

/** Todas as linhas do rascunho local, com status em relação ao servidor. */
export function listDraftRecoveryAllRows(
  server: ListItem[],
  backup: ListItem[],
  listCrop?: string | null,
): DraftRecoveryRow[] {
  const serverByKey = new Map(server.map((it) => [it.key, it]));
  return backup.map((item) => {
    const serverRow = serverByKey.get(item.key);
    if (!serverRow) {
      return { key: item.key, item, kind: "new" as const };
    }
    if (
      JSON.stringify(payloadOf(item, listCrop)) !==
      JSON.stringify(payloadOf(serverRow, listCrop))
    ) {
      return { key: item.key, item, kind: "changed" as const };
    }
    return { key: item.key, item, kind: "unchanged" as const };
  });
}

/** Mescla no estado do servidor só as linhas escolhidas do backup. */
export function applyDraftRecoverySelection(
  server: ListItem[],
  backup: ListItem[],
  selectedKeys: ReadonlySet<string>,
): ListItem[] {
  const backupByKey = new Map(backup.map((it) => [it.key, it]));
  const draft = [...server];
  for (const key of selectedKeys) {
    const row = backupByKey.get(key);
    if (!row) continue;
    const idx = draft.findIndex((it) => it.key === key);
    if (idx >= 0) draft[idx] = row;
    else draft.push(row);
  }
  return draft;
}
