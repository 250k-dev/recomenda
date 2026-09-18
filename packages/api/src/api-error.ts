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
