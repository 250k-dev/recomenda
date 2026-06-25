"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { Eye, Leaf, Package, Pencil, Plus, Sprout, Store, Tag, X, Check, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/domain/season/_shared";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import { useCurrencyStore } from "@/stores/currency";
import {
  useFarmAggregatedShoppingList,
  useUpdatePurchaseList,
} from "@/lib/api/hooks";
import { useProducerStock } from "@/lib/api/hooks/producers";
import type { ListItem } from "@/components/domain/season/_shared";
import {
  isSeedItem,
  listItemQuantity,
  listItemToPayload,
  validateListItems,
} from "@/components/domain/season/_shared";
import type { PurchaseListDetail, PurchaseListItemInput } from "@/lib/api/client";
import { CROP_LABELS } from "@/lib/season-constants";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ShareQuoteSheet } from "@/components/domain/share-quote-sheet";
import { QuoteComparisonSection } from "@/components/domain/quote-comparison-section";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function detailItemToListItem(it: PurchaseListDetail["items"][number]): ListItem {
  return {
    key: it.id,
    category: it.category ?? "OTHER",
    productId: it.local_product_id,
    productName: it.product_name,
    stage: it.stage,
    dose: String(it.dose_per_hectare),
    unit: it.dose_unit,
    nApps: String(it.n_applications),
    stock: String(it.current_stock),
    price: it.price_brl_fixed != null ? String(it.price_brl_fixed) : "",
    priceUsd: it.price_usd != null ? String(it.price_usd) : "",
    thousandPlants:
      it.thousand_plants_per_ha != null ? String(it.thousand_plants_per_ha) : "",
    seedingArea: it.seeding_area_ha != null ? String(it.seeding_area_ha) : "",
    bagsOverride: it.bags_override != null ? String(it.bags_override) : undefined,
    outOfProgram: it.out_of_program || undefined,
  };
}

function listItemsToPayload(items: ListItem[]): PurchaseListItemInput[] {
  return items.map(listItemToPayload);
}

function validateItems(items: ListItem[]): string | null {
  return validateListItems(items);
}

function computeItemMetrics(
  items: ListItem[],
  totalHa: number,
  fxRate: number,
): {
  totalProductsValue: number;
  totalSeedsValue: number;
  productsCount: number;
  categoriesCount: number;
  pricedCount: number;
} {
  let totalProductsValue = 0;
  let totalSeedsValue = 0;
  let pricedCount = 0;
  for (const it of items) {
    const required = listItemQuantity(it, totalHa);
    const toBuy = Math.max(0, required - Number(it.stock || 0));
    const unitPrice =
      it.priceUsd && fxRate > 0 ? Number(it.priceUsd) * fxRate : Number(it.price || 0);
    if (unitPrice > 0) {
      if (isSeedItem(it)) {
        totalSeedsValue += toBuy * unitPrice;
      } else {
        totalProductsValue += toBuy * unitPrice;
      }
      pricedCount += 1;
    }
  }
  return {
    totalProductsValue,
    totalSeedsValue,
    productsCount: items.length,
    categoriesCount: new Set(items.map((it) => it.category || "OTHER")).size,
    pricedCount,
  };
}

export type FarmPurchaseListTabProps = {
  farmId: string;
  list: PurchaseListDetail | null;
  purchaseLists: PurchaseListDetail[];
  selectedListId: string;
  onSelectList: (id: string) => void;
  isLoading: boolean;
  producerId: string | null;
  newPurchaseListHref: string;
  fallbackSeasonIds: string[];
  /** Hide edit affordances (used by the standalone read-only list page). */
  readOnly?: boolean;
};

export function FarmPurchaseListTab({
  farmId,
  list,
  purchaseLists,
  selectedListId,
  onSelectList,
  isLoading,
  producerId,
  newPurchaseListHref,
  fallbackSeasonIds,
  readOnly = false,
}: FarmPurchaseListTabProps) {
  const { data: producerStock } = useProducerStock(producerId ?? "");
  const stockByProductId = useMemo(
    () =>
      Object.fromEntries(
        (producerStock ?? []).map((s) => [s.local_product_id, s.quantity]),
      ),
    [producerStock],
  );
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const quotesSectionRef = useRef<HTMLDivElement>(null);

  const toggleQuotesComparison = useCallback(() => {
    setShowComparison((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          quotesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  }, []);

  const updateMutation = useUpdatePurchaseList(list?.id ?? "", { farmId });

  const resetDraft = useCallback(() => {
    if (!list) {
      setDraftItems([]);
      return;
    }
    setDraftItems((list.items ?? []).map(detailItemToListItem));
  }, [list]);

  // Reseta o estado local quando a lista selecionada muda — padrão recomendado
  // pelo React (https://react.dev/learn/you-might-not-need-an-effect) em vez de
  // setState dentro de useEffect.
  const [trackedListId, setTrackedListId] = useState(list?.id);
  if (list?.id !== trackedListId) {
    setTrackedListId(list?.id);
    setError(null);
    setShowComparison(false);
    setEditing(false);
    setDraftItems(list ? (list.items ?? []).map(detailItemToListItem) : []);
    // Carrega a cotação salva desta lista no seletor de moeda.
    if (list?.fx_rate_usd_brl != null) {
      useCurrencyStore.getState().setFxRate(String(list.fx_rate_usd_brl));
    }
  }

  const startEditing = () => {
    if (!list) return;
    setDraftItems((list.items ?? []).map(detailItemToListItem));
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    resetDraft();
    setEditing(false);
  };

  const saveItems = async () => {
    if (!list) return;
    setError(null);
    const validationError = validateItems(draftItems);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const fxRaw = useCurrencyStore.getState().fxRate;
      await updateMutation.mutateAsync({
        items: listItemsToPayload(draftItems),
        fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
        plots: (list.plots ?? []).map((p) => ({
          plot_id: p.plot_id,
          planting_date: p.planting_date,
          desiccation_date: p.desiccation_date,
          cycle_days: p.cycle_days,
        })),
      });
      toast.success("Lista de compra atualizada.");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a lista.");
    }
  };

  const viewItems = useMemo(
    () => (list?.items ?? []).map(detailItemToListItem),
    [list?.items],
  );
  const totalHa = list?.total_hectares ?? 0;
  const fxRate = useCurrencyStore((state) => state.fxRate);
  const fx = Number(fxRate) || 0;

  const kpis = useMemo(() => {
    return computeItemMetrics(editing ? draftItems : viewItems, totalHa, fx);
  }, [editing, draftItems, viewItems, totalHa, fx]);

  if (!producerId) {
    return (
      <EmptyState
        variant="inline"
        title="Abra esta fazenda a partir de um produtor para ver a lista de compra."
      />
    );
  }

  if (isLoading) return <TableRowsSkeleton rows={6} columns={4} />;

  if (!list) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-clay-strong">
              <Leaf className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                Lista de compra
              </p>
              <h2 className="mt-0.5 font-display text-xl font-semibold tracking-[-0.02em] text-text-strong">
                Nenhuma lista cadastrada
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Monte uma lista fixa para esta fazenda ou use as safras ativas abaixo.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={newPurchaseListHref}>
              <Plus className="h-4 w-4" />
              Montar lista
            </Link>
          </Button>
        </div>

        {fallbackSeasonIds.length > 0 ? (
          <FarmSeasonShoppingFallback seasonIds={fallbackSeasonIds} />
        ) : (
          <EmptyState
            variant="inline"
            title="Nenhuma lista de compra para esta fazenda."
          />
        )}
      </div>
    );
  }

  const hasItems = (list.items ?? []).length > 0;

  return (
    <div className="flex flex-col gap-5">
      {purchaseLists.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Lista</span>
          <Select
            value={selectedListId}
            onValueChange={onSelectList}
            className="min-w-[220px]"
            disabled={editing}
            options={purchaseLists.map((l) => ({
              value: l.id,
              label: `${l.name}${l.variety ? ` — ${l.variety}` : ""}`,
            }))}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
            <Leaf className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
              Lista de compra · {list.name}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-[-0.02em] text-text-strong">
              {CROP_LABELS[list.crop] ?? list.crop}
              {list.variety ? ` · ${list.variety}` : ""}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmtQty(totalHa)} ha · {(list.plots ?? []).length} talhões
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={cancelEditing}
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={saveItems}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <>
              {!readOnly ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                  Editar lista
                </Button>
              ) : null}
              <ShareQuoteSheet listId={list.id} listName={list.name} />
              <Button
                variant={showComparison ? "clay" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={toggleQuotesComparison}
              >
                <Store className="h-4 w-4" />
                Cotações das lojas
              </Button>
              {list.season_id ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/seasons/${list.season_id}?tab=cost-plan`}>
                    <Eye className="h-4 w-4" />
                    Ver plano de custo
                  </Link>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <KpiStrip>
        <KpiCell
          label="Valor total produtos"
          value={kpis.totalProductsValue > 0 ? fmtBrl(kpis.totalProductsValue) : "—"}
          sub={
            kpis.totalProductsValue > 0
              ? "defensivos e fertilizantes"
              : "informe preços para calcular"
          }
          icon={<Package className="size-4" />}
        />
        <KpiCell
          label="Valor total sementes"
          value={kpis.totalSeedsValue > 0 ? fmtBrl(kpis.totalSeedsValue) : "—"}
          sub={
            kpis.totalSeedsValue > 0
              ? "cultivares e híbridos"
              : "informe preços para calcular"
          }
          icon={<Leaf className="size-4" />}
        />
        <KpiCell
          label="Produtos"
          value={String(kpis.productsCount)}
          sub={editing ? "em edição" : `${kpis.categoriesCount} categorias`}
          icon={<Package className="size-4" />}
        />
        <KpiCell
          label="Hectares"
          value={`${fmtQty(totalHa)} ha`}
          sub={`${(list.plots ?? []).length} talhões`}
          icon={<Sprout className="size-4" />}
        />
        <KpiCell
          label="Itens com preço"
          value={`${kpis.pricedCount}/${kpis.productsCount || 0}`}
          sub="cobertura de preços"
          icon={<Tag className="size-4" />}
          alert
        />
      </KpiStrip>

      {hasItems || editing ? (
        <div className="space-y-4">
          {editing ? (
            <p className="text-sm text-muted-foreground">
              Adicione, edite ou remova produtos. As quantidades são calculadas por dose/ha ×{" "}
              {fmtQty(totalHa)} ha × nº de aplicações.
            </p>
          ) : null}
          <PurchaseListItemsEditor
            items={editing ? draftItems : viewItems}
            setItems={setDraftItems}
            readOnly={!editing}
            totalHa={totalHa}
            crop={list.crop as "SOYBEAN" | "CORN" | "ANY"}
            stockByProductId={stockByProductId}
          />
          {error ? (
            <div className="max-w-xl">
              <FieldError message={error} />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={`A lista "${list.name}" ainda não tem produtos cadastrados.`}
          action={
            !readOnly ? (
              <Button size="sm" className="gap-1.5" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Adicionar produtos
              </Button>
            ) : undefined
          }
        />
      )}

      {!editing && showComparison ? (
        <div ref={quotesSectionRef} className="scroll-mt-24 space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary-strong" />
            <h3 className="font-display text-base font-semibold text-text-strong">
              Cotações das lojas
            </h3>
            <span className="text-xs text-muted-foreground">
              · preços por loja (somente você vê esta comparação)
            </span>
          </div>
          <QuoteComparisonSection listId={list.id} />
        </div>
      ) : null}
    </div>
  );
}

function FarmSeasonShoppingFallback({
  seasonIds,
}: {
  seasonIds: string[];
}) {
  const { items, isLoading } = useFarmAggregatedShoppingList(seasonIds);

  if (isLoading) return <TableRowsSkeleton rows={6} columns={4} />;

  if (items.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="Nenhum produto pendente nas safras ativas desta fazenda."
      />
    );
  }

  const totalToBuy = items.reduce((s, it) => s + it.quantity_to_buy, 0);
  const rows = items.map((item) => [
    item.product_name,
    `${fmtQty(item.total_quantity)} ${item.dose_unit}`,
    `${fmtQty(item.quantity_to_buy)} ${item.dose_unit}`,
  ]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Produtos calculados a partir das safras ativas (recomendações pendentes).
          Configure uma safra completa para salvar uma lista de compra fixa.
        </CardContent>
      </Card>
      <DataTable
        headers={["Produto", "Necessário", "A comprar"]}
        rows={rows}
      />
      <div className="flex items-baseline justify-between rounded-lg border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Total a comprar</span>
        <strong className="text-base text-foreground">{fmtQty(totalToBuy)}</strong>
      </div>
    </div>
  );
}
