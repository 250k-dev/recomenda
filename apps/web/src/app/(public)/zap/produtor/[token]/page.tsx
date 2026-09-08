import { serverEnv } from "@recomenda/config/server";
import { ZapProducerPage } from "@/components/domain/zap/zap-producer-page";
import type { ZapLoadResult, ZapProducerDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapProdutorPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap(token);
  return <ZapProducerPage token={token} result={result} />;
}

async function loadZap(token: string): Promise<ZapLoadResult<ZapProducerDto>> {
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
    return { ok: true, data: (await response.json()) as ZapProducerDto };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Não foi possível abrir agora. Tente de novo em instantes.",
    };
  }
}
