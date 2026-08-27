import { serverEnv } from "@recomenda/config/server";
import type { ExportByTokenResponse } from "@recomenda/api/exports";
import { ExportDocumentPage } from "@/components/domain/export/export-document-page";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ExportarPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadExport(token);
  return <ExportDocumentPage result={result} />;
}

async function loadExport(
  token: string,
): Promise<
  | { ok: true; data: ExportByTokenResponse }
  | { ok: false; status: number; message: string }
> {
  const base = serverEnv.API_INTERNAL_URL.replace(/\/$/, "");
  const url = `${base}/exports/by-token/${encodeURIComponent(token)}`;
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
            ? "Não foi possível carregar o documento agora. Tente de novo em instantes."
            : "Este link é inválido ou expirou. Peça um novo no WhatsApp."),
      };
    }
    const data = (await response.json()) as ExportByTokenResponse;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      status: 503,
      message:
        "Não foi possível carregar o documento agora. Tente de novo em instantes.",
    };
  }
}
