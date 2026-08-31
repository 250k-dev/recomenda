import { api } from "./http/axios";

export interface PurchaseProgressItem {
  purchase_list_item_id: string;
  local_product_id: string;
  product_name: string;
  stage: string;
  purchase_target_qty: number;
  confirmed_purchase_qty: number;
  remaining_qty: number;
}

export interface PurchaseProgress {
  purchase_list_id: string;
  producer_id: string | null;
  is_complete: boolean;
  percent: number;
  pending_count: number;
  items: PurchaseProgressItem[];
  idempotent_replay?: boolean;
  purchases_created?: number;
}

export interface ConfirmPurchaseLine {
  quote_response_item_id: string;
  purchase_list_item_id: string;
  quantity?: number;
}

export interface StockOrigin {
  id: string;
  local_product_id: string;
  quantity: number;
  unit_price_brl: number | null;
  purchased_at: string;
  store_name: string | null;
  seller_name: string | null;
  notes: string | null;
  purchase_list_id: string | null;
}

export interface StockHistoryRow {
  local_product_id: string;
  product_name: string;
  dose_unit: string;
  category: string;
  purchase_count: number;
  total_quantity: number;
  last_purchased_at: string;
}

export async function getPurchaseListProgress(listId: string) {
  const { data } = await api.get<PurchaseProgress>(
    `/purchase-lists/${listId}/purchase-progress`,
  );
  return data;
}

export async function confirmPurchaseListPurchases(
  listId: string,
  payload: { idempotency_key: string; lines: ConfirmPurchaseLine[] },
) {
  const { data } = await api.post<PurchaseProgress>(
    `/purchase-lists/${listId}/confirm-purchases`,
    payload,
  );
  return data;
}

export async function fulfillPurchaseListWithoutQuote(
  listId: string,
  payload: {
    idempotency_key: string;
    manual_total_spent_brl?: number | null;
  },
) {
  const { data } = await api.post<PurchaseProgress>(
    `/purchase-lists/${listId}/fulfill-without-quote`,
    payload,
  );
  return data;
}

export async function getStockOrigins(producerId: string, localProductId: string) {
  const { data } = await api.get<StockOrigin[]>(
    `/producers/${producerId}/stock/${localProductId}/origins`,
  );
  return data;
}

export async function getStockHistory(producerId: string, q?: string) {
  const { data } = await api.get<StockHistoryRow[]>(
    `/producers/${producerId}/stock/history`,
    { params: q ? { q } : undefined },
  );
  return data;
}
