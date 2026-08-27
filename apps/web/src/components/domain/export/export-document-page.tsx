"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Lock } from "lucide-react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recomenda/ui/primitives/card";
import type {
  ExportByTokenResponse,
  ExportRecommendationBlock,
} from "@recomenda/api/exports";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import {
  buildPurchaseListHtml,
  buildQuoteComparisonHtml,
  buildRecommendationHtml,
  buildRecommendationsHtml,
  buildStockHtml,
  printPurchaseList,
  printQuoteComparison,
  printRecommendation,
  printRecommendations,
  printStock,
  type QuoteExportMode,
} from "@recomenda/domain";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

type LoadResult =
  | { ok: true; data: ExportByTokenResponse }
  | { ok: false; status: number; message: string };

export function ExportDocumentPage({ result }: { result: LoadResult }) {
  if (!result.ok) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg border-destructive/40 shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              {result.status === 410 ? "Link expirado" : "Não foi possível abrir"}
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <ExportReady data={result.data} />;
}

function ExportReady({ data }: { data: ExportByTokenResponse }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isWhatsAppInApp(navigator.userAgent));
  }, []);

  const [shareAll, setShareAll] = useState(true);
  const [selectedRecIds, setSelectedRecIds] = useState<Set<string>>(
    () => new Set(allRecIdsOf(data)),
  );
  const [quoteMode, setQuoteMode] = useState<QuoteExportMode>("store");
  const [selectedStores, setSelectedStores] = useState<Set<string>>(
    () => new Set(data.quotes?.comparison.responses.map((r) => r.id) ?? []),
  );

  const html = useMemo(
    () =>
      buildPreviewHtml(data, {
        shareAll,
        selectedRecIds,
        quoteMode,
        selectedStores,
      }),
    [data, shareAll, selectedRecIds, quoteMode, selectedStores],
  );

  const canDownload = Boolean(html);
  const title = documentTitle(data);

  const handlePrint = () => {
    printFromData(data, {
      shareAll,
      selectedRecIds,
      quoteMode,
      selectedStores,
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold tracking-[-0.02em] text-text-strong">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">
              Toque em Baixar PDF e escolha &quot;Salvar como PDF&quot;.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handlePrint}
          disabled={!canDownload}
          className="shrink-0"
        >
          <FileDown className="size-4" />
          Baixar PDF
        </Button>
      </header>

      {inApp ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">
          O WhatsApp às vezes bloqueia a caixa de impressão. Toque em{" "}
          <strong>⋯ → Abrir no Safari/Chrome</strong> e use <strong>Baixar PDF</strong>{" "}
          de novo. Enquanto isso, o documento já aparece abaixo.
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 sm:p-6">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Link válido até {formatExpiry(data.expiresAt)}. Não encaminhe.
        </p>

        <Filters
          data={data}
          shareAll={shareAll}
          selectedRecIds={selectedRecIds}
          quoteMode={quoteMode}
          selectedStores={selectedStores}
          onShareAll={setShareAll}
          onToggleRec={(id) => {
            setShareAll(false);
            setSelectedRecIds((prev) => toggleSet(prev, id));
          }}
          onToggleSeason={(ids, on) => {
            setShareAll(false);
            setSelectedRecIds((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (on) next.add(id);
                else next.delete(id);
              }
              return next;
            });
          }}
          onQuoteMode={setQuoteMode}
          onToggleStore={(id) =>
            setSelectedStores((prev) => toggleSet(prev, id))
          }
        />

        {html ? (
          <iframe
            title="Prévia do documento"
            srcDoc={html}
            className="min-h-[70vh] w-full rounded-xl border border-border bg-white shadow-sm"
          />
        ) : (
          <p className="rounded-xl border border-border bg-surface-2 p-6 text-sm text-muted-foreground">
            Selecione ao menos uma etapa, talhão ou loja para ver o documento.
          </p>
        )}

        <div className="sticky bottom-4 flex justify-center sm:hidden">
          <Button type="button" onClick={handlePrint} disabled={!canDownload} size="lg">
            <FileDown className="size-4" />
            Baixar PDF
          </Button>
        </div>
      </main>
    </div>
  );
}

function Filters({
  data,
  shareAll,
  selectedRecIds,
  quoteMode,
  selectedStores,
  onShareAll,
  onToggleRec,
  onToggleSeason,
  onQuoteMode,
  onToggleStore,
}: {
  data: ExportByTokenResponse;
  shareAll: boolean;
  selectedRecIds: Set<string>;
  quoteMode: QuoteExportMode;
  selectedStores: Set<string>;
  onShareAll: (value: boolean) => void;
  onToggleRec: (id: string) => void;
  onToggleSeason: (ids: string[], on: boolean) => void;
  onQuoteMode: (mode: QuoteExportMode) => void;
  onToggleStore: (id: string) => void;
}) {
  if (data.typ === "recommendation" && data.recommendation) {
    const recs = data.recommendation.recommendations;
    if (recs.length === 0) return null;
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={shareAll}
            onChange={(e) => onShareAll(e.target.checked)}
          />
          <span className="text-sm font-semibold text-text-strong">
            Talhão todo
          </span>
        </label>
        {!shareAll ? (
          <ul className="mt-3 flex flex-col gap-2">
            {recs.map((rec) => (
              <li key={rec.id}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedRecIds.has(rec.id)}
                    onChange={() => onToggleRec(rec.id)}
                  />
                  {rec.name}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  if (data.typ === "season" && data.season) {
    const items = data.season.items;
    if (items.length === 0) return null;
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={shareAll}
            onChange={(e) => onShareAll(e.target.checked)}
          />
          <span className="text-sm font-semibold text-text-strong">
            Safra completa
          </span>
        </label>
        {!shareAll ? (
          <ul className="mt-3 flex flex-col gap-3">
            {items.map((item) => {
              const ids = item.recommendations.map((r) => r.id);
              const allOn = ids.every((id) => selectedRecIds.has(id));
              return (
                <li key={item.id ?? item.seasonId}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allOn}
                      onChange={() => onToggleSeason(ids, !allOn)}
                    />
                    {item.label ?? item.plotName}
                  </label>
                  <ul className="mt-1 ml-6 flex flex-col gap-1.5">
                    {item.recommendations.map((rec) => (
                      <li key={rec.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selectedRecIds.has(rec.id)}
                            onChange={() => onToggleRec(rec.id)}
                          />
                          {rec.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    );
  }

  if (data.typ === "quotes" && data.quotes) {
    const responses = data.quotes.comparison.responses;
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <p className="mb-3 text-sm font-semibold text-text-strong">O que exportar</p>
        <ul className="flex flex-col gap-2.5">
          {(
            [
              ["best", "Melhores preços (misturando lojas)"],
              ["store", "Preços por loja"],
              ["full", "Comparação completa"],
            ] as const
          ).map(([mode, label]) => (
            <li key={mode}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="quote-export-mode"
                  className="size-4 accent-primary"
                  checked={quoteMode === mode}
                  onChange={() => onQuoteMode(mode)}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
        {responses.length > 1 ? (
          <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
            {responses.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedStores.has(r.id)}
                    onChange={() => onToggleStore(r.id)}
                  />
                  {r.store_name}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return null;
}

function buildPreviewHtml(
  data: ExportByTokenResponse,
  sel: SelectionState,
): string {
  const ctx = {
    producerName: data.producerName,
    agronomistName: data.agronomistName,
  };
  if (data.typ === "purchase_list" && data.purchaseList) {
    return buildPurchaseListHtml(data.purchaseList, ctx);
  }
  if (data.typ === "recommendation" && data.recommendation) {
    const share = toShareData(data, data.recommendation, sel);
    if (!share || share.recommendations.length === 0) return "";
    return buildRecommendationHtml(share);
  }
  if (data.typ === "season" && data.season) {
    const list = data.season.items
      .map((item) => toShareData(data, item, sel))
      .filter((item): item is RecommendationShareData => Boolean(item?.recommendations.length));
    if (list.length === 0) return "";
    return buildRecommendationsHtml(list, data.season.cycleName);
  }
  if (data.typ === "stock" && data.stock) {
    return buildStockHtml({
      producerName: data.producerName,
      agronomistName: data.agronomistName,
      items: data.stock.items,
    });
  }
  if (data.typ === "quotes" && data.quotes) {
    const storeIds =
      sel.selectedStores.size === data.quotes.comparison.responses.length
        ? null
        : sel.selectedStores;
    if (storeIds && storeIds.size === 0) return "";
    return buildQuoteComparisonHtml(
      data.quotes.comparison,
      storeIds,
      { ...ctx, listName: data.quotes.listName },
      sel.quoteMode,
    );
  }
  return "";
}

function printFromData(data: ExportByTokenResponse, sel: SelectionState) {
  const ctx = {
    producerName: data.producerName,
    agronomistName: data.agronomistName,
  };
  if (data.typ === "purchase_list" && data.purchaseList) {
    printPurchaseList(data.purchaseList, ctx);
    return;
  }
  if (data.typ === "recommendation" && data.recommendation) {
    const share = toShareData(data, data.recommendation, sel);
    if (share) printRecommendation(share);
    return;
  }
  if (data.typ === "season" && data.season) {
    const list = data.season.items
      .map((item) => toShareData(data, item, sel))
      .filter((item): item is RecommendationShareData => Boolean(item?.recommendations.length));
    if (list.length > 0) printRecommendations(list, data.season.cycleName);
    return;
  }
  if (data.typ === "stock" && data.stock) {
    printStock({
      producerName: data.producerName,
      agronomistName: data.agronomistName,
      items: data.stock.items,
    });
    return;
  }
  if (data.typ === "quotes" && data.quotes) {
    const storeIds =
      sel.selectedStores.size === data.quotes.comparison.responses.length
        ? null
        : sel.selectedStores;
    printQuoteComparison(
      data.quotes.comparison,
      storeIds,
      { ...ctx, listName: data.quotes.listName },
      sel.quoteMode,
    );
  }
}

interface SelectionState {
  shareAll: boolean;
  selectedRecIds: Set<string>;
  quoteMode: QuoteExportMode;
  selectedStores: Set<string>;
}

function toShareData(
  data: ExportByTokenResponse,
  block: ExportRecommendationBlock,
  sel: SelectionState,
): RecommendationShareData | null {
  const recommendations = sel.shareAll
    ? block.recommendations
    : block.recommendations.filter((r) => sel.selectedRecIds.has(r.id));
  const done = recommendations.filter((r) => APPLIED.has(r.status)).length;
  return {
    title: block.title,
    plotName: block.plotName,
    plantingDate: block.plantingDate,
    statusLabel: block.statusLabel,
    producerName: data.producerName,
    agronomistName: data.agronomistName,
    done,
    total: recommendations.length,
    recommendations,
  };
}

function allRecIdsOf(data: ExportByTokenResponse): string[] {
  if (data.recommendation) {
    return data.recommendation.recommendations.map((r) => r.id);
  }
  if (data.season) {
    return data.season.items.flatMap((i) => i.recommendations.map((r) => r.id));
  }
  return [];
}

function documentTitle(data: ExportByTokenResponse): string {
  switch (data.typ) {
    case "purchase_list":
      return data.purchaseList?.name ?? "Lista de compras";
    case "recommendation":
      return data.recommendation?.title ?? "Recomendação";
    case "season":
      return data.season?.cycleName ?? "Safra";
    case "stock":
      return data.producerName ? `Estoque · ${data.producerName}` : "Estoque";
    case "quotes":
      return data.quotes?.listName ? `Cotações · ${data.quotes.listName}` : "Cotações";
  }
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "7 dias";
  return date.toLocaleDateString("pt-BR");
}

function isWhatsAppInApp(ua: string): boolean {
  return /WhatsApp|FBAN|FBAV|FB_IAB/i.test(ua);
}

function toggleSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
