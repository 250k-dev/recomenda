import { isAxiosError } from "axios";
import type { ApiError } from "./http/types";

/** Lê o code do envelope Nest OU do `ApiError` já normalizado pelo interceptor. */
export function apiErrorCode(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code ?? null;
  }
  if (error instanceof Error && "code" in error) {
    const code = (error as ApiError).code;
    return typeof code === "string" && code.length > 0 ? code : null;
  }
  return null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string | string[] }
      | undefined;
    if (data?.error?.message) return data.error.message;
    if (typeof data?.message === "string") return data.message;
    if (Array.isArray(data?.message) && data.message[0]) return String(data.message[0]);
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Status HTTP do envelope Axios ou do `ApiError` do interceptor. */
export function apiHttpStatus(error: unknown): number | null {
  if (isAxiosError(error)) return error.response?.status ?? null;
  if (error instanceof Error && "status" in error) {
    const status = (error as ApiError).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

/** 401/403/404 não melhoram com retry — só enchem log (produtor em rascunho). */
export function retryUnlessClientForbidden(failureCount: number, error: unknown): boolean {
  const status = apiHttpStatus(error);
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 2;
}

/** Mensagem amigável para falhas de publicação de safra/ciclo. */
export function publishBlockedMessage(
  error: unknown,
  fallback = "Não foi possível publicar a safra.",
): string {
  const code = apiErrorCode(error);
  if (code === "QUOTA_EXCEEDED") {
    return "Não foi possível publicar. Verifique a quota do plano.";
  }
  if (code === "PURCHASE_LIST_REQUIRED") {
    return "Monte e finalize a lista de compra da safra antes de programar ou publicar.";
  }
  if (code === "PURCHASES_INCOMPLETE") {
    return "Finalize 100% das compras da lista antes de publicar a safra.";
  }
  return apiErrorMessage(error, fallback);
}

export function apiErrorDetails(error: unknown): unknown {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { details?: unknown } } | undefined;
    return data?.error?.details;
  }
  if (error instanceof Error && "details" in error) {
    return (error as ApiError).details;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Nomes de safras no 409 `PLOT_IN_CYCLE`. */
export function plotInCycleNames(error: unknown): string[] {
  const details = apiErrorDetails(error);
  if (!isRecord(details) || !Array.isArray(details.cycles)) return [];
  return details.cycles.flatMap((row) => {
    if (!isRecord(row)) return [];
    const name = String(row.name ?? "").trim();
    return name ? [name] : [];
  });
}

export type PublishBlockItem = {
  id: string;
  name: string;
  detail: string;
};

export type PublishBlockSummary = {
  message: string;
  items: PublishBlockItem[];
};

function fmtQty(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function publishBlockItemsFromProgress(
  items: Array<{
    purchase_list_item_id: string;
    product_name: string;
    stage: string;
    remaining_qty: number;
  }>,
): PublishBlockItem[] {
  return items
    .filter((item) => item.remaining_qty > 1e-9)
    .map((item) => ({
      id: item.purchase_list_item_id,
      name: item.product_name?.trim() || "Produto",
      detail: [item.stage?.trim(), `faltam ${fmtQty(item.remaining_qty)}`]
        .filter(Boolean)
        .join(" · "),
    }));
}

export function publishBlockSummaryFromError(
  error: unknown,
  fallback?: string,
): PublishBlockSummary {
  const message = publishBlockedMessage(error, fallback);
  const details = apiErrorDetails(error);
  if (!isRecord(details)) {
    return { message, items: [] };
  }

  const pending = details.pending_items;
  if (Array.isArray(pending)) {
    const items = publishBlockItemsFromProgress(
      pending.flatMap((row) => {
        if (!isRecord(row)) return [];
        return [
          {
            purchase_list_item_id: String(row.purchase_list_item_id ?? ""),
            product_name: String(row.product_name ?? ""),
            stage: String(row.stage ?? ""),
            remaining_qty: Number(row.remaining_qty) || 0,
          },
        ];
      }),
    );
    return { message, items };
  }

  const current = Number(details.current);
  const limit = Number(details.limit);
  if (Number.isFinite(current) && Number.isFinite(limit)) {
    return {
      message,
      items: [
        {
          id: "quota",
          name: "Cota de talhões ativos",
          detail: `${current} em uso · limite ${limit}`,
        },
      ],
    };
  }

  return { message, items: [] };
}

/**
 * Registro de aplicação recusado por falta de produto no galpão
 * (`INSUFFICIENT_STOCK`): um item por produto com precisa · tem · falta.
 * Null quando o erro é outro — aí vale o toast de sempre.
 */
export type StockShortageRow = {
  id: string;
  name: string;
  required: number;
  available: number;
  missing: number;
};

/** Faltas de `INSUFFICIENT_STOCK` com os números (não só o texto). */
export function stockShortageRowsFromError(error: unknown): StockShortageRow[] | null {
  if (apiErrorCode(error) !== "INSUFFICIENT_STOCK") return null;
  const details = apiErrorDetails(error);
  const rows = Array.isArray(details) ? details : [];
  return rows.flatMap((row, index) => {
    if (!isRecord(row)) return [];
    const required = Number(row.required) || 0;
    const available = Math.max(0, Number(row.available) || 0);
    return [
      {
        id: String(row.product_id ?? index),
        name: String(row.product_name ?? "").trim() || "Produto",
        required,
        available,
        missing: Math.max(0, required - available),
      },
    ];
  });
}

export function fmtShortageQty(value: number): string {
  return fmtQty(value);
}

export function stockShortageSummaryFromError(error: unknown): PublishBlockSummary | null {
  const rows = stockShortageRowsFromError(error);
  if (!rows) return null;
  return {
    message:
      "Não há produto suficiente no galpão para esta aplicação. Registre a compra do que falta (ou ajuste o estoque) e tente de novo.",
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      detail: `precisa ${fmtQty(row.required)} · no galpão ${fmtQty(row.available)} · falta ${fmtQty(row.missing)}`,
    })),
  };
}
