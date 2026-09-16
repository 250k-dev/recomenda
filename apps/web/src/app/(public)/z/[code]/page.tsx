import { loadZap } from "@/components/domain/zap/load-zap";
import { ZapFarmPage } from "@/components/domain/zap/zap-farm-page";
import { ZapLinkError } from "@/components/domain/zap/zap-link-error";
import { ZapListPage } from "@/components/domain/zap/zap-list-page";
import { ZapProducerPage } from "@/components/domain/zap/zap-producer-page";
import { ZapReorderPage } from "@/components/domain/zap/zap-reorder-page";
import { ZapSeasonPage } from "@/components/domain/zap/zap-season-page";
import type {
  ZapFarmDto,
  ZapListDto,
  ZapProducerDto,
  ZapReorderDto,
  ZapSeasonDto,
} from "@/components/domain/zap/zap-types";

export const dynamic = "force-dynamic";

type AnyZapDto =
  | ZapListDto
  | ZapSeasonDto
  | ZapFarmDto
  | ZapProducerDto
  | ZapReorderDto;

type PageProps = { params: Promise<{ code: string }> };

/**
 * Rota curta dos mini-apps do Zap. Uma só para os cinco tipos: o link precisa caber
 * num balão do WhatsApp sem quebrar, e o tipo já vem no payload.
 */
export default async function ZapShortPage({ params }: PageProps) {
  const { code } = await params;
  const result = await loadZap<AnyZapDto>(code);

  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }

  switch (result.data.typ) {
    case "list_edit":
      return <ZapListPage token={code} result={{ ok: true, data: result.data }} />;
    case "season_create":
      return <ZapSeasonPage token={code} result={{ ok: true, data: result.data }} />;
    case "farm_create":
      return <ZapFarmPage token={code} result={{ ok: true, data: result.data }} />;
    case "producer_create":
      return <ZapProducerPage token={code} result={{ ok: true, data: result.data }} />;
    case "season_reorder":
      return <ZapReorderPage token={code} result={{ ok: true, data: result.data }} />;
    default:
      return (
        <ZapLinkError
          status={404}
          message="Este link é inválido. Peça um novo no WhatsApp."
        />
      );
  }
}
