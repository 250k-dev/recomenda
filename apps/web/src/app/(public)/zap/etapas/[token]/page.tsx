import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapReorderPage } from "@/components/domain/zap/zap-reorder-page";
import type { ZapReorderDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapEtapasPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapReorderDto>(token);
  return <ZapReorderPage token={token} result={result} />;
}
