import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapProducerPage } from "@/components/domain/zap/zap-producer-page";
import type { ZapProducerDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapProdutorPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapProducerDto>(token);
  return <ZapProducerPage token={token} result={result} />;
}
