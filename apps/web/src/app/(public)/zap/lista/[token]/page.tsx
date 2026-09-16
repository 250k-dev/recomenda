import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapListPage } from "@/components/domain/zap/zap-list-page";
import type { ZapListDto } from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function ZapListaPage({ params }: PageProps) {
  const { token } = await params;
  const result = await loadZap<ZapListDto>(token);
  return <ZapListPage token={token} result={result} />;
}
