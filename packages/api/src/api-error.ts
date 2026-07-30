import { isAxiosError } from "axios";

export function apiErrorCode(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code ?? null;
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
