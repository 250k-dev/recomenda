import { api } from "@/lib/http/axios";

export type QuoteRequestStatus = "OPEN" | "CLOSED";
export type QuoteResponseStatus = "DRAFT" | "SUBMITTED";
export type QuoteAvailability = "AVAILABLE" | "UNAVAILABLE" | "PARTIAL";
/** Condição de pagamento do preço da loja: à vista ou a prazo (parcelado). */
export type QuotePaymentTerm = "CASH" | "TERM";

/** Item da lista exibido na cotação (sem dados de custo do agrônomo). */
export interface QuoteItemView {
  purchase_list_item_id: string;
  product_name: string;
  category: string;
  stage: string;
  dose_per_hectare: number;
  dose_unit: string;
  n_applications: number;
  quantity_to_buy: number;
}

export interface QuoteListInfo {
  id: string;
  name: string;
  crop: string;
  variety: string | null;
  total_hectares: number;
}

// --- Agrônomo -----------------------------------------------------------------

export interface QuoteShare {
  token: string;
  status: QuoteRequestStatus;
  link: string;
}

export interface QuoteComparisonResponseItem {
  /** Id da linha (quote_response_item) — usado para excluir/restaurar. */
  id: string;
  purchase_list_item_id: string;
  availability: QuoteAvailability | null;
  payment_term: QuotePaymentTerm | null;
  unit_price_brl: number | null;
  substitute_product_name: string | null;
  substitute_unit_price_brl: number | null;
  notes: string | null;
}

export interface QuoteComparisonResponse {
  id: string;
  store_name: string;
  /** Token privado da loja — para reenviar o mesmo link de edição. */
  response_token: string;
  responder_name: string | null;
  phone: string | null;
  status: QuoteResponseStatus;
  submitted_at: string | null;
  created_at: string;
  total_brl: number;
  items: QuoteComparisonResponseItem[];
}

export interface QuoteComparison {
  request: { token: string; status: QuoteRequestStatus } | null;
  items: QuoteItemView[];
  responses: QuoteComparisonResponse[];
}

/** Gera (ou retorna) o link público de cotação de uma lista de compras. */
export async function createQuoteRequest(listId: string) {
  const { data } = await api.post<QuoteShare>(`/purchase-lists/${listId}/quote-request`);
  return data;
}

/** Comparação loja × preço (somente o agrônomo dono). */
export async function getPurchaseListQuotes(listId: string) {
  const { data } = await api.get<QuoteComparison>(`/purchase-lists/${listId}/quotes`);
  return data;
}

// --- Lixeira de cotações (agrônomo) -------------------------------------------

export interface QuoteTrashResponse {
  id: string;
  store_name: string;
  deleted_at: string | null;
}

export interface QuoteTrashItem {
  id: string;
  response_id: string;
  store_name: string | null;
  product_name: string | null;
  deleted_at: string | null;
}

export interface QuoteTrash {
  responses: QuoteTrashResponse[];
  items: QuoteTrashItem[];
}

/** Lixeira da lista: cotações de loja e linhas excluídas. */
export async function getPurchaseListQuoteTrash(listId: string) {
  const { data } = await api.get<QuoteTrash>(`/purchase-lists/${listId}/quotes/trash`);
  return data;
}

/** Move a cotação de uma loja (coluna) para a lixeira. */
export async function softDeleteQuoteResponse(listId: string, responseId: string) {
  await api.delete(`/purchase-lists/${listId}/quotes/responses/${responseId}`);
}

/** Restaura a cotação de uma loja da lixeira. */
export async function restoreQuoteResponse(listId: string, responseId: string) {
  await api.post(`/purchase-lists/${listId}/quotes/responses/${responseId}/restore`);
}

/** Exclui definitivamente a cotação de uma loja. */
export async function deleteQuoteResponse(listId: string, responseId: string) {
  await api.delete(`/purchase-lists/${listId}/quotes/responses/${responseId}/permanent`);
}

/** Move uma linha (item de uma loja) para a lixeira. */
export async function softDeleteQuoteItem(listId: string, responseId: string, itemId: string) {
  await api.delete(`/purchase-lists/${listId}/quotes/responses/${responseId}/items/${itemId}`);
}

/** Restaura uma linha da lixeira. */
export async function restoreQuoteItem(listId: string, responseId: string, itemId: string) {
  await api.post(
    `/purchase-lists/${listId}/quotes/responses/${responseId}/items/${itemId}/restore`,
  );
}

/** Exclui definitivamente uma linha. */
export async function deleteQuoteItem(listId: string, responseId: string, itemId: string) {
  await api.delete(
    `/purchase-lists/${listId}/quotes/responses/${responseId}/items/${itemId}/permanent`,
  );
}

// --- Público (lojista) --------------------------------------------------------

export interface QuotePreview {
  token: string;
  status: QuoteRequestStatus;
  list: QuoteListInfo;
  producer_name: string | null;
  agronomist_name: string | null;
  items: QuoteItemView[];
}

export interface QuoteResponseItem extends QuoteItemView {
  availability: QuoteAvailability | null;
  payment_term: QuotePaymentTerm | null;
  unit_price_brl: number | null;
  substitute_product_name: string | null;
  substitute_unit_price_brl: number | null;
  notes: string | null;
}

export interface QuoteResponseDetail {
  request_status: QuoteRequestStatus;
  response: {
    store_name: string;
    responder_name: string | null;
    phone: string | null;
    status: QuoteResponseStatus;
    submitted_at: string | null;
  };
  list: QuoteListInfo;
  producer_name: string | null;
  agronomist_name: string | null;
  items: QuoteResponseItem[];
}

export interface CreateQuoteResponseInput {
  store_name: string;
  responder_name?: string;
  phone?: string;
}

export interface QuoteResponseItemInput {
  purchase_list_item_id: string;
  availability?: QuoteAvailability;
  payment_term?: QuotePaymentTerm;
  unit_price_brl?: number;
  substitute_product_name?: string;
  substitute_unit_price_brl?: number;
  notes?: string;
}

export interface UpdateQuoteResponseInput {
  items: QuoteResponseItemInput[];
  submit?: boolean;
}

/** Preview público pelo token (itens a cotar; nunca preços de outras lojas). */
export async function getQuoteByToken(token: string) {
  const { data } = await api.get<QuotePreview>(`/quotes/by-token/${token}`);
  return data;
}

/** Loja se identifica e recebe um link privado de edição. */
export async function createQuoteResponse(token: string, payload: CreateQuoteResponseInput) {
  const { data } = await api.post<{ response_token: string }>(
    `/quotes/by-token/${token}/responses`,
    payload,
  );
  return data;
}

/** Cotação da própria loja (pelo response_token privado). */
export async function getQuoteResponse(responseToken: string) {
  const { data } = await api.get<QuoteResponseDetail>(`/quotes/responses/${responseToken}`);
  return data;
}

/** Salva/envia os preços e disponibilidade da loja. */
export async function updateQuoteResponse(
  responseToken: string,
  payload: UpdateQuoteResponseInput,
) {
  const { data } = await api.put<QuoteResponseDetail>(
    `/quotes/responses/${responseToken}`,
    payload,
  );
  return data;
}
