import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapFarmPage } from "@/components/domain/zap/zap-farm-page";
import type { ZapFarmDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapFazendaPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapFarmDto>(token);
  return <ZapFarmPage token={token} result={result} />;
}
