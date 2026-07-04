"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Eye, Leaf, Package, Pencil, Plus, Sprout, Store, Tag, X, Check, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/domain/season/_shared";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useCurrencyStore,
  DEFAULT_GRAIN_PRICE_BRL,
  DEFAULT_SPACING_M,
} from "@/stores/currency";
import { computePurchaseListMetrics } from "@/lib/purchase-list-breakdown";
import { CategoryDistributionPanel } from "@/components/domain/category-distribution-panel";
import { CategoryMetaProgress } from "@/components/domain/category-meta-progress";
import {
  useFarmAggregatedShoppingList,
  useUpdatePurchaseList,
} from "@/lib/api/hooks";
import { useProducerStock } from "@/lib/api/hooks/producers";
import type { ListItem } from "@/components/domain/season/_shared";
import {
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
    seedsPerMeter: it.seeds_per_meter != null ? String(it.seeds_per_meter) : "",
    cycleDays: it.cycle_days != null ? String(it.cycle_days) : "",
    thousandPlants:
      it.thousand_plants_per_ha != null ? String(it.thousand_plants_per_ha) : "",
    seedingArea: it.seeding_area_ha != null ? String(it.seeding_area_ha) : "",
    bagsOverride: it.bags_override != null ? String(it.bags_override) : undefined,
    outOfProgram: it.out_of_program || undefined,
  };
}

function listItemsToPayload(items: ListItem[], listCrop?: string | null): PurchaseListItemInput[] {
  return items.map((it) => listItemToPayload(it, listCrop ?? undefined));
}

function validateItems(items: ListItem[]): string | null {
  return validateListItems(items);
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
  /** Quando embutido na safra (sem abas), abre o plano de custo agregado. */
  onOpenCostPlan?: () => void;
  /** Quando informado, mostra o botão Estoque na mesma linha dos outros. */
  stockHref?: string;
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
  onOpenCostPlan,
  stockHref,
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
  }

  // Carrega a cotação e o preço da saca salvos desta lista no store — em efeito,
  // pois escrever num store externo durante o render dispara re-render em cascata.
  useEffect(() => {
    const store = useCurrencyStore.getState();
    if (list?.fx_rate_usd_brl != null) {
      store.setFxRate(String(list.fx_rate_usd_brl));
    }
    store.setGrainPrice(
      list?.grain_price_brl != null ? String(list.grain_price_brl) : "",
    );
    store.setSpacing(list?.spacing_m != null ? String(list.spacing_m) : "");
  }, [list?.id, list?.fx_rate_usd_brl, list?.grain_price_brl, list?.spacing_m]);

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

  const saveItems = async (opts?: { silent?: boolean }) => {
    if (!list) return;
    setError(null);
    const validationError = validateItems(draftItems);
    if (validationError) {
      // Autosave não grita validação no meio da digitação; o Salvar manual sim.
      if (!opts?.silent) setError(validationError);
      return;
    }

    try {
      const {
        fxRate: fxRaw,
        grainPrice: grainRaw,
        spacing: spacingRaw,
      } = useCurrencyStore.getState();
      await updateMutation.mutateAsync({
        items: listItemsToPayload(draftItems, list.crop),
        fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
        grain_price_brl: grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL,
        spacing_m: spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M,
        plots: (list.plots ?? []).map((p) => ({
          plot_id: p.plot_id,
          planting_date: p.planting_date,
          desiccation_date: p.desiccation_date,
          cycle_days: p.cycle_days,
        })),
      });
      if (!opts?.silent) {
        toast.success("Lista de compra atualizada.");
        setEditing(false);
      }
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar a lista.");
      }
    }
  };

  // Autosave dos itens em edição: persiste sozinho após pausa na digitação,
  // mantendo o modo de edição aberto (o Salvar manual continua como está).
  const draftRef = useRef(draftItems);
  draftRef.current = draftItems;
  useEffect(() => {
    if (!editing || !list || draftItems.length === 0) return;
    const timer = setTimeout(() => {
      if (validateItems(draftRef.current) === null) {
        void saveItems({ silent: true });
      }
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftItems, editing, list?.id]);

  const viewItems = useMemo(
    () => (list?.items ?? []).map(detailItemToListItem),
    [list?.items],
  );
  const totalHa = list?.total_hectares ?? 0;
  const fxRate = useCurrencyStore((state) => state.fxRate);
  const fx = Number(fxRate) || 0;
  const grainPrice = useCurrencyStore((state) => state.grainPrice);
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;

  const kpis = useMemo(() => {
    return computePurchaseListMetrics(
      editing ? draftItems : viewItems,
      totalHa,
      fx,
      saca,
    );
  }, [editing, draftItems, viewItems, totalHa, fx, saca]);

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
              {CROP_LABELS[list.crop ?? "ANY"] ?? list.crop ?? "Multi-cultura"}
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
                onClick={() => void saveItems()}
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
              {/* Sem barra de abas, este é o caminho para o plano de custo da
                  safra. Embutido usa o callback (troca de view sem recarregar);
                  no modo avulso, o link direto para o plano do talhão. */}
              {onOpenCostPlan ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onOpenCostPlan}
                >
                  <Eye className="h-4 w-4" />
                  Ver plano de custo
                </Button>
              ) : list.season_id ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/seasons/${list.season_id}?tab=cost-plan`}>
                    <Eye className="h-4 w-4" />
                    Ver plano de custo
                  </Link>
                </Button>
              ) : null}
              {stockHref ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={stockHref}>
                    <Boxes className="h-4 w-4" />
                    Estoque
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
          label="Volume de sacas"
          value={kpis.seedVolume > 0 ? fmtQty(kpis.seedVolume) : "—"}
          sub={
            kpis.seedVolume > 0
              ? `${fmtQty(kpis.seedSacksPerHa)} sc/ha · sementes`
              : "cultivares e híbridos"
          }
          icon={<Leaf className="size-4" />}
        />
        <KpiCell
          label="Custo (sc/ha)"
          value={
            kpis.productCostSacksPerHa > 0
              ? `${fmtQty(kpis.productCostSacksPerHa)} sc/ha`
              : "—"
          }
          sub={
            kpis.productCostSacksPerHa > 0
              ? `÷ ${fmtBrl(saca)}/saca · ${kpis.pricedCount}/${kpis.productsCount || 0} com preço`
              : "informe preço e saca"
          }
          icon={<Tag className="size-4" />}
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
      </KpiStrip>

      {hasItems || editing ? (
        <div className="space-y-4">
          {editing ? (
            <p className="text-sm text-muted-foreground">
              Adicione, edite ou remova produtos. As quantidades são calculadas por dose/ha ×{" "}
              {fmtQty(totalHa)} ha × nº de aplicações.
            </p>
          ) : null}
          {kpis.categoryBreakdown.length > 0 ? (
            <CategoryDistributionPanel breakdown={kpis.categoryBreakdown} />
          ) : null}
          <CategoryMetaProgress
            items={editing ? draftItems : viewItems}
            totalHa={totalHa}
            targets={list.category_targets ?? {}}
          />
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
