import { serverEnv } from "@recomenda/config/server";
import type { ZapLoadResult } from "./zap-types";

/**
 * Carrega o mini-app do Zap a partir do que veio na URL — hoje o código curto
 * (`/z/XXXXXXXX`), e ainda os tokens longos dos links enviados antes da mudança.
 */
export async function loadZap<T>(token: string): Promise<ZapLoadResult<T>> {
  const base = serverEnv.API_INTERNAL_URL.replace(/\/$/, "");
  const url = `${base}/zap/by-token/${encodeURIComponent(token)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        ok: false,
        status: response.status,
        message:
          body?.error?.message ??
          (response.status >= 500
            ? "Não foi possível abrir agora. Tente de novo em instantes."
            : "Este link é inválido ou expirou. Peça um novo no WhatsApp."),
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Não foi possível abrir agora. Tente de novo em instantes.",
    };
  }
}
