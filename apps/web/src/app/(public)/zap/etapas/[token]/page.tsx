import { serverEnv } from "@recomenda/config/server";
import { ZapReorderPage } from "@/components/domain/zap/zap-reorder-page";
import type { ZapLoadResult, ZapReorderDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapEtapasPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap(token);
  return <ZapReorderPage token={token} result={result} />;
}

async function loadZap(token: string): Promise<ZapLoadResult<ZapReorderDto>> {
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
    return { ok: true, data: (await response.json()) as ZapReorderDto };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Não foi possível abrir agora. Tente de novo em instantes.",
    };
  }
}
