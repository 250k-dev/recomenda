import { serverEnv } from "@recomenda/config/server";
import { ZapListPage } from "@/components/domain/zap/zap-list-page";
import type { ZapListDto, ZapLoadResult } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapListaPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapListDto>(token);
  return <ZapListPage token={token} result={result} />;
}

async function loadZap<T>(token: string): Promise<ZapLoadResult<T>> {
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
