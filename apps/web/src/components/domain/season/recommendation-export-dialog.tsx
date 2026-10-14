"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useIsMobile } from "@recomenda/ui/hooks/use-mobile";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import { countApplicationRecipes } from "@recomenda/domain/recommendations/recipe-document";
import { buildExportHtml } from "@recomenda/domain/recommendations/export-document";
import { displayRecStatus } from "@recomenda/domain/recommendations/format";
import { cn } from "@recomenda/utils";
import {
  readPricePreference,
  writePricePreference,
} from "@/components/domain/export/price-preference";
import {
  PagedPreview,
  DEFAULT_PREVIEW_ZOOM,
  type PagedPreviewHandle,
  type PreviewZoom,
} from "@/components/domain/export/paged-preview";
import {
  ExportFooter,
  ExportShell,
  FooterButton,
  PreviewEmpty,
  PreviewToolbar,
  PriceSwitch,
  StatusBadge,
  Step,
  TriCheck,
  WhatsappButton,
  fmtPages,
  triOf,
} from "@/components/domain/export/export-ui";
import { printPaged, type PagedResult } from "@/lib/print/paged-document";
import { useSeasonApplicationTab } from "@/components/domain/season/season-application-data-dialog";
import {
  composeRecommendationExportWhatsappMessage,
  copyText,
  openWhatsapp,
  stageWhen,
} from "@/components/domain/export/export-helpers";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

export function RecommendationExportDialog({
  open,
  onOpenChange,
  data,
  seasonId,
  canEditApplication = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RecommendationShareData;
  /** Com a safra, aparece a aba "Dados da aplicação" (vazão, tanque…). */
  seasonId?: string;
  canEditApplication?: boolean;
}) {
  const mobile = useIsMobile();
  const [tab, setTab] = useState<"export" | "application">("export");
  const applicationTab = useSeasonApplicationTab({
    open,
    onClose: () => onOpenChange(false),
    seasonId: seasonId ?? "",
    data,
    canEdit: canEditApplication,
  });
  const previewRef = useRef<PagedPreviewHandle>(null);
  const recs = data.recommendations;
  const allIds = useMemo(() => recs.map((r) => r.id), [recs]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // O payload só traz preço para quem tem PRICE_VIEW — sem isso, a opção nem aparece.
  const canPrice = Boolean(data.unitPriceByProduct);
  const [showPrices, setShowPrices] = useState(() => readPricePreference());
  const [zoom, setZoom] = useState<PreviewZoom>(DEFAULT_PREVIEW_ZOOM);
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [mView, setMView] = useState<"config" | "preview">("config");
  const [paged, setPaged] = useState<PagedResult | null>(null);

  // Ao abrir: nada marcado. Ajuste durante o render (padrão React).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab("export");
      setSelected(new Set());
      setMView("config");
      setPaged(null);
    }
  }

  const filtered: RecommendationShareData = useMemo(() => {
    if (selected.size === recs.length) return data;
    const recommendations = recs.filter((r) => selected.has(r.id));
    const done = recommendations.filter((r) => APPLIED.has(r.status)).length;
    return { ...data, recommendations, done, total: recommendations.length };
  }, [selected, data, recs]);

  const hasStages = filtered.recommendations.length > 0;
  const recipeCount = countApplicationRecipes([filtered]);
  const priced = canPrice && showPrices;
  const title = `Recomendação - ${data.plotName ?? data.title}`;

  const html = useMemo(
    () =>
      hasStages && recipeCount > 0
        ? buildExportHtml([filtered], title, { showPrices: priced })
        : null,
    [filtered, hasStages, priced, recipeCount, title],
  );
  const message = useMemo(
    () =>
      hasStages && recipeCount > 0
        ? composeRecommendationExportWhatsappMessage({ single: filtered })
        : "",
    [hasStages, recipeCount, filtered],
  );

  const onPaged = (result: PagedResult) => setPaged(result);
  const total = html && paged ? paged.total : 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tri = triOf(recs.map((r) => selected.has(r.id)));
  const pendingIds = recs.filter((r) => r.status === "PENDING").map((r) => r.id);

  const togglePrices = () => {
    setShowPrices((value) => {
      writePricePreference(!value);
      return !value;
    });
  };

  const download = () => {
    if (!html) return;
    if (!previewRef.current?.print()) printPaged(html);
  };

  const ready = hasStages && recipeCount > 0;
  const summary = !hasStages
    ? "Nenhuma etapa marcada"
    : `${filtered.recommendations.length} de ${recs.length} ${recs.length === 1 ? "etapa" : "etapas"}`;
  const sub = !hasStages
    ? "Marque ao menos uma etapa para exportar."
    : recipeCount > 0
      ? `Visão geral + ${recipeCount} ${recipeCount === 1 ? "receita" : "receitas"}${canPrice ? (priced ? " · com preços" : " · sem preços") : ""}`
      : "As etapas marcadas foram puladas — não geram receita.";

  const left = (
    <div className="flex flex-col gap-6">
      {canPrice ? (
        <div className="overflow-hidden rounded-xl border border-[#e2e0d6] bg-white">
          <PriceSwitch flush on={priced} onToggle={togglePrices} canPrice={canPrice} />
        </div>
      ) : null}

      <Step
        n={1}
        title="O que exportar"
        links={[
          { label: "Todas", onClick: () => setSelected(new Set(allIds)) },
          { label: "Pendentes", onClick: () => setSelected(new Set(pendingIds)) },
          { label: "Nenhuma", onClick: () => setSelected(new Set()) },
        ]}
      >
        <div className="overflow-hidden rounded-xl border border-[#e2e0d6] bg-white">
          <button
            type="button"
            onClick={() => setSelected(tri === "on" ? new Set() : new Set(allIds))}
            className="flex w-full items-center gap-2.5 border-b border-[#efede5] bg-[#f6f4ee] px-3 py-2.5 text-left"
          >
            <TriCheck state={tri} />
            <span className="flex-1 text-[13.5px] font-semibold">Talhão todo</span>
            <span className="text-xs text-[#6b6a62]">
              {selected.size} de {recs.length} etapas
            </span>
          </button>
          {recs.map((rec, i) => {
            const on = selected.has(rec.id);
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => toggle(rec.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-[#f1f0ea] px-3 py-2 text-left last:border-b-0",
                  on ? "bg-white" : "bg-[#faf9f5]",
                )}
              >
                <TriCheck state={on ? "on" : "off"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {i + 1}. {rec.name}
                  </span>
                  <span className="block text-[11.5px] text-[#7a786e]">{stageWhen(rec)}</span>
                </span>
                <StatusBadge status={displayRecStatus(rec)} />
              </button>
            );
          })}
        </div>
      </Step>
    </div>
  );

  const right = (
    <>
      <PreviewToolbar
        title={
          <span>
            Prévia do PDF
            {total ? <span className="ml-1.5 font-normal text-[#6b6a62]">· {fmtPages(total)}</span> : null}
          </span>
        }
        zoom={zoom}
        effectiveZoom={effectiveZoom}
        onZoom={setZoom}
      />
      <PagedPreview
        ref={previewRef}
        html={html}
        zoom={zoom}
        onPaged={onPaged}
        onEffectiveZoom={setEffectiveZoom}
        empty={
          <PreviewEmpty
            title="Nada para mostrar"
            text={
              !hasStages
                ? "Marque ao menos uma etapa para ver as folhas do PDF."
                : "As etapas marcadas foram puladas — não geram receita."
            }
          />
        }
      />
    </>
  );

  const exportFooter = (
    <ExportFooter summary={summary} sub={sub} warn={!ready}>
      <WhatsappButton
        message={message}
        disabled={!ready || !message.trim()}
        onCopy={() => void copyText(message)}
        onSend={() => openWhatsapp(message)}
      />
      <FooterButton tone="primary" disabled={!ready || !html} onClick={download}>
        <Download className="size-4" /> Baixar PDF{total ? ` · ${fmtPages(total)}` : ""}
      </FooterButton>
    </ExportFooter>
  );
  const onApplication = tab === "application";

  return (
    <ExportShell
      open={open}
      onOpenChange={(next) => !(onApplication && applicationTab.saving) && onOpenChange(next)}
      title="Exportar recomendação"
      tabs={
        seasonId
          ? [
              { id: "export", label: "Exportar" },
              { id: "application", label: "Dados da aplicação" },
            ]
          : undefined
      }
      tab={tab}
      onTab={(id) => {
        setTab(id as "export" | "application");
        setMView("config");
      }}
      contentKey={tab}
      left={onApplication ? applicationTab.left : left}
      right={onApplication ? applicationTab.right : right}
      mobile={mobile}
      mobileView={mView}
      onMobileView={setMView}
      mobilePreviewLabel={
        onApplication ? applicationTab.mobilePreviewLabel : total ? `Prévia · ${fmtPages(total)}` : "Prévia"
      }
      footer={onApplication ? applicationTab.footer : exportFooter}
    />
  );
}
