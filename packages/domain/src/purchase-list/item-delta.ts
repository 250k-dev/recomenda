import type { PurchaseListItemInput } from "@recomenda/api/purchase-lists";
import { listItemToPayload, type ListItem } from "./list-item";

export type PurchaseListItemRemoveKey = {
  local_product_id: string;
  stage: string;
  out_of_program?: boolean;
};

export type PurchaseListItemsDelta = {
  append: PurchaseListItemInput[];
  update: Array<{ id: string; item: PurchaseListItemInput }>;
  remove: PurchaseListItemRemoveKey[];
};

export function isNewPurchaseListRow(it: ListItem): boolean {
  return it.key.startsWith("i-");
}

function payloadOf(it: ListItem, listCrop?: string | null): PurchaseListItemInput {
  return listItemToPayload(it, listCrop ?? undefined);
}

function payloadsEqual(a: PurchaseListItemInput, b: PurchaseListItemInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Diff entre baseline (servidor ao abrir edição) e o draft atual. */
export function computePurchaseListItemsDelta(
  baseline: ListItem[],
  draft: ListItem[],
  listCrop?: string | null,
): PurchaseListItemsDelta {
  const draftByKey = new Map(draft.map((it) => [it.key, it]));
  const baselineByKey = new Map(baseline.map((it) => [it.key, it]));

  const append = draft.filter(isNewPurchaseListRow).map((it) => payloadOf(it, listCrop));

  const remove: PurchaseListItemRemoveKey[] = [];
  for (const base of baseline) {
    if (isNewPurchaseListRow(base)) continue;
    if (!draftByKey.has(base.key)) {
      remove.push({
        local_product_id: base.productId,
        stage: base.stage,
        out_of_program: base.outOfProgram ?? false,
      });
    }
  }

  const update: Array<{ id: string; item: PurchaseListItemInput }> = [];
  for (const it of draft) {
    if (isNewPurchaseListRow(it)) continue;
    const base = baselineByKey.get(it.key);
    if (!base) continue;
    const next = payloadOf(it, listCrop);
    const prev = payloadOf(base, listCrop);
    if (!payloadsEqual(next, prev)) {
      update.push({ id: it.key, item: next });
    }
  }

  return { append, update, remove };
}

export function purchaseListDeltaIsEmpty(delta: PurchaseListItemsDelta): boolean {
  return delta.append.length === 0 && delta.update.length === 0 && delta.remove.length === 0;
}

function syncRowKey(row: {
  local_product_id: string;
  stage: string;
  out_of_program: boolean;
}): string {
  return `${row.local_product_id}\0${row.stage}\0${row.out_of_program ? 1 : 0}`;
}

/** Troca chaves `i-…` do editor pelos ids persistidos no sync. */
export function remapDraftKeysFromSyncItems(
  draft: ListItem[],
  syncedRows: Array<{
    id: string;
    local_product_id: string;
    stage: string;
    out_of_program: boolean;
  }>,
): ListItem[] {
  const idByKey = new Map(syncedRows.map((row) => [syncRowKey(row), row.id]));
  return draft.map((it) => {
    const id = idByKey.get(
      syncRowKey({
        local_product_id: it.productId,
        stage: it.stage,
        out_of_program: Boolean(it.outOfProgram),
      }),
    );
    if (id && isNewPurchaseListRow(it)) return { ...it, key: id };
    return it;
  });
}
