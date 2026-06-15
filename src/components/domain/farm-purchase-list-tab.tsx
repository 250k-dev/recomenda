"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Leaf, Package, Pencil, Plus, Sprout, Store, Tag, X, Check, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { categoryToken, categoryDotClass } from "@/lib/categories";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/domain/season/_shared";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useFarmAggregatedShoppingList,
  useUpdatePurchaseList,
} from "@/lib/api/hooks";
import type { ListItem } from "@/components/domain/season/_shared";
import type { PurchaseListDetail, PurchaseListItemInput } from "@/lib/api/client";
import { CROP_LABELS } from "@/lib/season-constants";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/catalog-global-options";
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
  };
}

function listItemsToPayload(items: ListItem[]): PurchaseListItemInput[] {
  return items.map((it) => ({
    local_product_id: it.productId,
    stage: it.stage,
    dose_per_hectare: Number(it.dose),
    dose_unit: it.unit,
    n_applications: Number(it.nApps) || 1,
    current_stock: Number(it.stock) || 0,
    price_brl_fixed: it.price ? Number(it.price) : null,
  }));
}

function validateItems(items: ListItem[]): string | null {
  if (items.length === 0) return "Adicione pelo menos um produto.";
  for (const it of items) {
    if (!it.category) return "Selecione a categoria em todos os itens.";
    if (!it.productId) return "Selecione o produto em todos os itens.";
    if (!Number(it.dose)) return "Informe a dose/ha em todos os itens.";
  }
  return null;
}

function computeItemMetrics(
  items: ListItem[],
  totalHa: number,
): { totalValue: number; productsCount: number; categoriesCount: number; pricedCount: number } {
  let totalValue = 0;
  let pricedCount = 0;
  for (const it of items) {
    const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
    const toBuy = Math.max(0, required - Number(it.stock || 0));
    if (it.price) {
      totalValue += toBuy * Number(it.price);
      pricedCount += 1;
    }
  }
  return {
    totalValue,
    productsCount: items.length,
    categoriesCount: items.length > 0 ? 1 : 0,
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
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const updateMutation = useUpdatePurchaseList(list?.id ?? "", { farmId });

  const resetDraft = useCallback(() => {
    if (!list) {
      setDraftItems([]);
      return;
    }
    setDraftItems((list.items ?? []).map(detailItemToListItem));
  }, [list]);

  useEffect(() => {
    setEditing(false);
    setError(null);
    setDraftItems([]);
    setShowComparison(false);
  }, [list?.id]);

  const startEditing = () => {
    if (!list) return;
    setDraftItems((list.items ?? []).map(detailItemToListItem));
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    setEditing(false);
    resetDraft();
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
      await updateMutation.mutateAsync({
        items: listItemsToPayload(draftItems),
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

  const savedItems = useMemo(() => list?.items ?? [], [list?.items]);
  const totalHa = list?.total_hectares ?? 0;

  const kpis = useMemo(() => {
    if (editing) {
      return computeItemMetrics(draftItems, totalHa);
    }
    const totalValue = savedItems.reduce((s, it) => {
      const price = it.price_brl_fixed ?? 0;
      return s + it.quantity_to_buy * price;
    }, 0);
    return {
      totalValue,
      productsCount: savedItems.length,
      categoriesCount: new Set(savedItems.map((it) => it.category || "OTHER")).size,
      pricedCount: savedItems.filter((it) => it.price_brl_fixed).length,
    };
  }, [editing, draftItems, savedItems, totalHa]);

  const grouped = useMemo(
    () =>
      [...new Set(savedItems.map((it) => it.category || "OTHER"))]
        .sort()
        .map((cat) => ({
          category: cat,
          items: savedItems.filter((it) => (it.category || "OTHER") === cat),
        })),
    [savedItems],
  );

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

  const displayItems = editing ? draftItems : savedItems;

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
                variant={showComparison ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setShowComparison((v) => !v)}
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
          label="Valor total a gastar"
          value={kpis.totalValue > 0 ? fmtBrl(kpis.totalValue) : "—"}
          sub={kpis.totalValue > 0 ? "soma dos itens com preço" : "informe preços para calcular"}
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

      {editing ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Adicione, edite ou remova produtos. As quantidades são calculadas por dose/ha ×{" "}
            {fmtQty(totalHa)} ha × nº de aplicações.
          </p>
          <PurchaseListItemsEditor
            items={draftItems}
            setItems={setDraftItems}
            totalHa={totalHa}
            crop={list.crop === "SOYBEAN" || list.crop === "CORN" ? list.crop : null}
          />
          {error ? (
            <div className="max-w-xl">
              <FieldError message={error} />
            </div>
          ) : null}
        </div>
      ) : displayItems.length === 0 ? (
        <EmptyState
          title={`A lista "${list.name}" ainda não tem produtos cadastrados.`}
          action={
            <Button size="sm" className="gap-1.5" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
              Adicionar produtos
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-3">Produto</th>
                <th className="px-2 py-3">Dose</th>
                <th className="px-2 py-3 text-right">Necessário</th>
                <th className="px-2 py-3 text-right">A comprar</th>
                <th className="px-2 py-3 text-right">Preço R$/un.</th>
                <th className="px-3 py-3 text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ category, items: groupItems }) => {
                const subtotal = groupItems.reduce((s, it) => {
                  const p = it.price_brl_fixed ?? 0;
                  return s + it.quantity_to_buy * p;
                }, 0);
                const catLabel =
                  PRODUCT_CATEGORY_LABELS[
                    category as keyof typeof PRODUCT_CATEGORY_LABELS
                  ] ?? category;
                const dot = categoryDotClass[categoryToken(catLabel)];
                return (
                  <Fragment key={category}>
                    <tr className="border-b border-border bg-rail">
                      <td colSpan={6} className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider text-text-strong">
                          <span className={`size-2.5 rounded-[3px] ${dot}`} />
                          {catLabel}
                          <span className="font-medium text-muted-foreground">
                            · {groupItems.length}{" "}
                            {groupItems.length === 1 ? "insumo" : "insumos"}
                            {subtotal > 0 ? ` · ${fmtBrl(subtotal)}` : ""}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {groupItems.map((item) => {
                      const price = item.price_brl_fixed ?? null;
                      const lineTotal = price != null ? item.quantity_to_buy * price : null;
                      return (
                        <tr key={item.id} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2.5 font-semibold text-text-strong">
                            {item.product_name}
                          </td>
                          <td className="px-2 py-2.5 tabular-nums text-muted-foreground">
                            {fmtQty(item.dose_per_hectare)} {item.dose_unit}/ha ·{" "}
                            {item.n_applications}×
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fmtQty(item.required_quantity)} {item.dose_unit}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-text-strong">
                            {fmtQty(item.quantity_to_buy)} {item.dose_unit}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                            {price != null ? fmtBrl(price) : <span className="text-placeholder">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-strong">
                            {lineTotal != null ? fmtBrl(lineTotal) : <span className="text-placeholder">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!editing && showComparison ? (
        <div className="space-y-3">
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
