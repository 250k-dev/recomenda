import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapSeasonPage } from "@/components/domain/zap/zap-season-page";
import type { ZapSeasonDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapSafraPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapSeasonDto>(token);
  return <ZapSeasonPage token={token} result={result} />;
}
