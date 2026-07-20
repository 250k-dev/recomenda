"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { duplicatePurchaseList } from "@recomenda/api";
import { routes } from "@recomenda/config";
import { getCommodities } from "@recomenda/api/market";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { DoseUnitSelect } from "@/components/domain/dose-unit-select";
import { Button } from "@recomenda/ui/primitives/button";
import { Select } from "@recomenda/ui/forms/select";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { PageHero } from "@/components/domain/page-hero";
import { useSeasonCostPlan, useUpdatePurchaseList, useLocalCatalog } from "@recomenda/api-hooks";
import { useCurrencyStore } from "@/stores/currency";
import {
  calculateSummary,
  CATEGORY_ORDER,
  type CostItemInput,
  type CostSummary,
} from "@recomenda/domain/cost-plan/calculate";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@recomenda/domain/cost-plan/categories";
import { CategoryDistributionPanel } from "@/components/domain/category-distribution-panel";
import {
  Pencil,
  Plus,
  Trash2,
  Copy,
  Download,
  Search,
  Filter,
  ArrowDownUp,
  Wheat,
  Sprout,
  DollarSign,
  Scale,
  PackageCheck,
  TrendingUp,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@recomenda/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const brlSmall = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

interface EditableItem {
  id: string;
  local_product_id: string;
  product_name: string;
  category: string;
  dose_per_hectare: number;
  dose_unit: string;
  n_applications: number;
  current_stock: number;
  area_factor: number;
  price_usd: number | null;
  price_brl_fixed: number | null;
  cost_per_ha_mode: "DOSE_PRICE" | "TOTAL_OVER_AREA";
  deduct_stock: boolean;
  calc_rule: "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;
  supplier: string | null;
  stage: string;
  // Campos que este editor não altera, mas PRECISA preservar no save (o
  // persist faz DELETE+INSERT; omiti-los zerava sementes/observação/flag).
  area_note: string | null;
  thousand_plants_per_ha: number | null;
  seeds_per_meter: number | null;
  cycle_days: number | null;
  seeding_area_ha: number | null;
  bags_override: number | null;
  out_of_program: boolean;
}

export function CostPlanView({
  seasonId,
  crop,
  farmId,
  producerId,
  producerName,
  farmName,
}: {
  seasonId: string;
  crop: string;
  farmId?: string;
  producerId?: string;
  producerName?: string;
  farmName?: string;
}) {
  const { data: plan, isLoading } = useSeasonCostPlan(seasonId);
  const update = useUpdatePurchaseList(plan?.id ?? "");
  const catalog = useLocalCatalog();
  const products = catalog.data?.data ?? [];

  const { fxRate: globalFxRate, setFxRate: setGlobalFxRate } = useCurrencyStore();
  const [grainPrice, setGrainPrice] = useState<string>("");
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [items, setItems] = useState<EditableItem[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"cost-desc" | "cost-asc" | "name">("cost-desc");

  const fxRate = globalFxRate;
  const setFxRate = useCallback(
    (v: string) => setGlobalFxRate(v),
    [setGlobalFxRate],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- dívida pré-existente (baseline desde A1): semeia o formulário a partir do plano carregado. Corrigir exige `key` no pai ou estado derivado, e mexe no fluxo de edição do plano de custo — fora do escopo de uma fase de config. */
  useEffect(() => {
    if (!plan) return;
    // Seed the global store from the saved plan value if the global is still empty
    if (!globalFxRate && plan.fx_rate_usd_brl != null) {
      setGlobalFxRate(String(plan.fx_rate_usd_brl));
    }
    setGrainPrice(plan.grain_price_brl != null ? String(plan.grain_price_brl) : "");
    setTargets(plan.category_targets ?? {});
    setItems(
      plan.items.map((it) => ({
        id: it.id,
        local_product_id: it.local_product_id,
        product_name: it.product_name,
        category: it.category,
        dose_per_hectare: it.dose_per_hectare,
        dose_unit: it.dose_unit,
        n_applications: it.n_applications,
        current_stock: it.current_stock,
        area_factor: it.area_factor,
        price_usd: it.price_usd,
        price_brl_fixed: it.price_brl_fixed,
        cost_per_ha_mode: it.cost_per_ha_mode,
        deduct_stock: it.deduct_stock,
        calc_rule: it.calc_rule,
        supplier: it.supplier,
        stage: it.stage,
        area_note: it.area_note ?? null,
        thousand_plants_per_ha: it.thousand_plants_per_ha ?? null,
        seeds_per_meter: it.seeds_per_meter ?? null,
        cycle_days: it.cycle_days ?? null,
        seeding_area_ha: it.seeding_area_ha ?? null,
        bags_override: it.bags_override ?? null,
        out_of_program: it.out_of_program ?? false,
      })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const area = plan?.total_hectares ?? 0;
  const plotsCount = plan?.plots?.length ?? 0;

  const { lines, summary } = useMemo(() => {
    const inputs: CostItemInput[] = items.map((it) => ({
      id: it.id,
      category: it.category,
      product_name: it.product_name,
      dose_per_hectare: it.dose_per_hectare,
      dose_unit: it.dose_unit,
      n_applications: it.n_applications,
      current_stock: it.current_stock,
      area_factor: it.area_factor,
      price_usd: it.price_usd,
      price_brl_fixed: it.price_brl_fixed,
      catalog_price_usd: null,
      cost_per_ha_mode: it.cost_per_ha_mode,
      deduct_stock: it.deduct_stock,
      calc_rule: it.calc_rule,
    }));
    return calculateSummary(inputs, {
      area_hectares: area,
      fx_rate_usd_brl: fxRate ? Number(fxRate) : null,
      grain_price_brl: grainPrice ? Number(grainPrice) : null,
    });
  }, [items, area, fxRate, grainPrice]);

  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const persist = () => {
    if (!plan) return;
    update.mutate({
      fx_rate_usd_brl: fxRate ? Number(fxRate) : null,
      grain_price_brl: grainPrice ? Number(grainPrice) : null,
      category_targets: targets,
      items: items.map((it) => ({
        local_product_id: it.local_product_id,
        stage: it.stage,
        dose_per_hectare: it.dose_per_hectare,
        dose_unit: it.dose_unit,
        n_applications: it.n_applications,
        current_stock: it.current_stock,
        supplier: it.supplier,
        area_factor: it.area_factor,
        price_usd: it.price_usd,
        price_brl_fixed: it.price_brl_fixed,
        cost_per_ha_mode: it.cost_per_ha_mode,
        deduct_stock: it.deduct_stock,
        calc_rule: it.calc_rule,
        // Preserva o que este editor não mexe (senão o DELETE+INSERT apaga).
        area_note: it.area_note,
        thousand_plants_per_ha: it.thousand_plants_per_ha,
        seeds_per_meter: it.seeds_per_meter,
        cycle_days: it.cycle_days,
        seeding_area_ha: it.seeding_area_ha,
        bags_override: it.bags_override,
        out_of_program: it.out_of_program,
      })),
    });
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Carregando plano de custo…
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    const configureHref =
      farmId && producerId
        ? routes.fazendas.novaSafra(farmId, {
            producer_id: producerId,
            season_id: seasonId,
          })
        : null;
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Esta safra ainda não tem plano de custo vinculado.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um plano para configurar insumos, doses e ver o custo total da safra.
          </p>
          {configureHref ? (
            <Button asChild className="mt-4 gap-2">
              <Link href={configureHref}>
                <Plus className="h-4 w-4" /> Configurar plano
              </Link>
            </Button>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Abra a safra a partir da fazenda para configurar o plano.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const updateItem = (id: string, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const addProductToPlan = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}-${prev.length}`,
        local_product_id: prod.id,
        product_name: prod.name,
        category: prod.category ?? "OTHER",
        dose_per_hectare: 0,
        dose_unit: prod.dose_unit ?? "DOSE",
        n_applications: 1,
        current_stock: 0,
        area_factor: 1,
        price_usd: null,
        price_brl_fixed: null,
        cost_per_ha_mode: "DOSE_PRICE",
        deduct_stock: true,
        calc_rule: null,
        supplier: null,
        stage: "Plantio",
        area_note: null,
        thousand_plants_per_ha: null,
        seeds_per_meter: null,
        cycle_days: null,
        seeding_area_ha: null,
        bags_override: null,
        out_of_program: false,
      },
    ]);
  };

  const exportCsv = () => {
    if (!plan) return;
    const headers = [
      "Produto",
      "Categoria",
      "Etapa",
      "Dose/ha",
      "Unidade",
      "Nº aplicações",
      "Estoque",
      "Qtde final",
      "US$ un.",
      "R$ un.",
      "R$/ha",
      "Total R$",
    ];
    const rows = items.map((it) => {
      const line = lineById.get(it.id);
      return [
        it.product_name,
        it.category,
        it.stage,
        it.dose_per_hectare,
        it.dose_unit,
        it.n_applications,
        it.current_stock,
        line?.quantity_final ?? 0,
        it.price_usd ?? "",
        line?.unit_price_brl ?? 0,
        line?.cost_per_ha_brl ?? 0,
        line?.total_brl ?? 0,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell);
            if (s.includes(";") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(";"),
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.name.replace(/[^\w\d-]+/g, "_")}-plano-custo.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter((it) => {
    if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
    if (!filter.trim()) return true;
    return it.product_name.toLowerCase().includes(filter.toLowerCase());
  });

  const grouped = [...new Set(filteredItems.map((it) => it.category || "OTHER"))]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map((cat) => {
      const groupItems = filteredItems
        .filter((it) => (it.category || "OTHER") === cat)
        .sort((a, b) => {
          if (sortMode === "name") return a.product_name.localeCompare(b.product_name, "pt-BR");
          const ta = lineById.get(a.id)?.total_brl ?? 0;
          const tb = lineById.get(b.id)?.total_brl ?? 0;
          return sortMode === "cost-desc" ? tb - ta : ta - tb;
        });
      return { category: cat, items: groupItems };
    });

  const totalCategoriesInPlan = new Set(items.map((it) => it.category || "OTHER")).size;
  const planTitle = `Safra ${plan.name}`;

  return (
    <div className="flex flex-col gap-5">
      <PlanHeader
        producerName={producerName}
        farmName={farmName}
        variety={plan.variety}
        area={area}
        plotsCount={plotsCount}
        crop={plan.crop ?? "ANY"}
        planTitle={planTitle}
        updatedAt={plan.updated_at}
        purchaseListId={plan.id}
        products={products}
        onAddProduct={(productId) => {
          addProductToPlan(productId);
          setTimeout(persist, 0);
        }}
        onExport={exportCsv}
      />

      <ParamsBar
        fxRate={fxRate}
        setFxRate={setFxRate}
        grainPrice={grainPrice}
        setGrainPrice={setGrainPrice}
        area={area}
        crop={plan.crop ?? "ANY"}
        plotsCount={plotsCount}
        onCommit={persist}
        saving={update.isPending}
      />

      <KpiCards
        summary={summary}
        area={area}
        grainPrice={grainPrice ? Number(grainPrice) : 0}
        totalCategories={totalCategoriesInPlan}
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <RealVsTargetPanel
            summary={summary}
            targets={targets}
            setTargets={setTargets}
            onCommit={persist}
          />
          <Toolbar
            filter={filter}
            setFilter={setFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            sortMode={sortMode}
            setSortMode={setSortMode}
            totalItems={items.length}
            totalCategories={totalCategoriesInPlan}
            allCategories={[...new Set(items.map((it) => it.category || "OTHER"))]}
          />
          <InputsTable
            grouped={grouped}
            lineById={lineById}
            updateItem={updateItem}
            removeItem={removeItem}
            onCommit={persist}
          />
        </div>
        <div>
          <CategoryDistributionPanel breakdown={summary.category_breakdown} />
        </div>
      </div>
    </div>
  );
}

/** Comparativo Real × Desejado: sc/ha real (calculado) vs meta digitada por categoria. */
function RealVsTargetPanel({
  summary,
  targets,
  setTargets,
  onCommit,
}: {
  summary: CostSummary;
  targets: Record<string, number>;
  setTargets: (next: Record<string, number>) => void;
  onCommit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = summary.category_breakdown;
  if (rows.length === 0) return null;

  const totalReal = rows.reduce((s, r) => s + r.sacks_per_ha, 0);
  const totalDesejado = rows.reduce((s, r) => s + (targets[r.category] ?? 0), 0);

  const setOne = (category: string, value: string) => {
    const n = value === "" ? 0 : Number(value);
    setTargets({ ...targets, [category]: Number.isFinite(n) ? n : 0 });
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-rail/80",
          open && "border-b border-border bg-rail",
          !open && "bg-rail",
        )}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-strong">
            Real × Desejado (sacas/ha por categoria)
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Real é calculado (custo da categoria ÷ saca ÷ área). Desejado é a sua meta.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!open ? (
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
              Real {num(totalReal, 2)} · Desejado{" "}
              {totalDesejado > 0 ? num(totalDesejado, 2) : "—"}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open ? (
        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Categoria</span>
            <span>Real · Meta (sc/ha)</span>
          </div>
          {rows.map((r) => {
            const real = r.sacks_per_ha;
            const target = targets[r.category] ?? 0;
            const over = target > 0 && real > target;
            const pct = target > 0 ? Math.min(100, (real / target) * 100) : 0;
            const color = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.OTHER;
            return (
              <div key={r.category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "w-12 text-right text-sm tabular-nums",
                        over ? "font-semibold text-danger-strong" : "text-text-strong",
                      )}
                    >
                      {num(real, 2)}
                    </span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={target ? String(target) : ""}
                      placeholder="meta"
                      onChange={(e) => setOne(r.category, e.target.value)}
                      onBlur={onCommit}
                      className="h-8 w-16 px-2 text-right text-sm tabular-nums"
                    />
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", over && "bg-danger-strong")}
                    style={{
                      width: `${target > 0 ? pct : 0}%`,
                      background: over ? undefined : color,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="font-semibold text-text-strong">Total</span>
            <span className="tabular-nums">
              <strong className="text-text-strong">{num(totalReal, 2)}</strong>
              <span className="text-muted-foreground">
                {" "}
                / {totalDesejado > 0 ? num(totalDesejado, 2) : "—"} sc/ha
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanHeader({
  producerName,
  farmName,
  variety,
  area,
  plotsCount,
  crop,
  planTitle,
  updatedAt,
  purchaseListId,
  products,
  onAddProduct,
  onExport,
}: {
  producerName?: string;
  farmName?: string;
  variety: string | null;
  area: number;
  plotsCount: number;
  crop: string;
  planTitle: string;
  updatedAt?: string;
  purchaseListId: string;
  products: { id: string; name: string; category?: string; dose_unit?: string }[];
  onAddProduct: (productId: string) => void;
  onExport: () => void;
}) {
  const cropLabel = crop === "CORN" ? "Milho" : "Soja";
  const title =
    producerName && farmName ? `${producerName} · ${farmName}` : producerName ?? planTitle;
  const updatedLabel = updatedAt
    ? formatRelative(updatedAt)
    : null;

  return (
    <PageHero
      className="mb-7"
      icon={<Wheat className="size-6" />}
      eyebrow={`Plano de custo · ${planTitle}`}
      title={title}
      stats={[
        ...(cropLabel ? [{ label: "Cultura", value: cropLabel }] : []),
        ...(variety ? [{ label: "Variedade", value: variety }] : []),
        { label: "Área", value: `${num(area)} ha` },
        { label: "Talhões", value: plotsCount },
        ...(updatedLabel ? [{ label: "Atualizado", value: updatedLabel }] : []),
      ]}
      actions={
        <>
          <CropToggle crop={crop} />
          <DuplicateButton purchaseListId={purchaseListId} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <AddInsumoMenu products={products} onSelect={onAddProduct} />
        </>
      }
    />
  );
}

function AddInsumoMenu({
  products,
  onSelect,
}: {
  products: { id: string; name: string; category?: string }[];
  onSelect: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOut = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, [open]);

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : products.slice(0, 30);

  return (
    <div ref={containerRef} className="relative">
      <Button size="sm" className="gap-1.5" onClick={() => setOpen((o) => !o)}>
        <Plus className="h-4 w-4" />
        Adicionar insumo
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-card shadow-lg">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto…"
              className="h-8"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                >
                  <span className="truncate text-foreground">{p.name}</span>
                  {p.category ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {p.category}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DuplicateButton({ purchaseListId }: { purchaseListId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => duplicatePurchaseList(purchaseListId),
    onSuccess: (newList) => {
      queryClient.invalidateQueries({ queryKey: ["producer-purchase-lists"] });
      queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
      if (newList.season_id) {
        router.push(routes.safras.planoDeCusto(newList.season_id));
      }
    },
  });
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <Copy className="h-4 w-4" />
      {mutation.isPending ? "Duplicando…" : "Duplicar"}
    </Button>
  );
}

function CropToggle({ crop }: { crop: string }) {
  const isSoy = crop === "SOYBEAN";
  return (
    <div className="flex rounded-full border bg-card p-0.5 text-xs font-medium">
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1",
          isSoy ? "bg-primary/10 text-primary" : "text-muted-foreground",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-primary" />
        Soja
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1",
          !isSoy ? "bg-warning-soft text-warning-strong" : "text-muted-foreground",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Milho
      </span>
    </div>
  );
}

function ParamsBar({
  fxRate,
  setFxRate,
  grainPrice,
  setGrainPrice,
  area,
  crop,
  plotsCount,
  onCommit,
  saving,
}: {
  fxRate: string;
  setFxRate: (v: string) => void;
  grainPrice: string;
  setGrainPrice: (v: string) => void;
  area: number;
  crop: string;
  plotsCount: number;
  onCommit: () => void;
  saving: boolean;
}) {
  const [fetching, setFetching] = useState(false);

  const fillFromMarket = async () => {
    setFetching(true);
    try {
      const q = await getCommodities();
      const saca = crop === "CORN" ? q.milho_brl_saca : q.soja_brl_saca;
      if (q.usd_brl != null) setFxRate(String(q.usd_brl));
      if (saca != null) setGrainPrice(String(saca));
      onCommit();
      if (q.usd_brl == null && saca == null) {
        toast.error("Não foi possível obter a cotação agora. Informe os valores à mão.");
      } else {
        toast.success("Cotação do dia preenchida.");
      }
    } catch {
      toast.error("Não foi possível obter a cotação agora. Informe os valores à mão.");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Parâmetros
        </span>
        <ParamField
          label="Cotação dólar"
          value={fxRate}
          onChange={setFxRate}
          onBlur={onCommit}
          formatted={fxRate ? brlSmall(Number(fxRate)) : "—"}
          sub="BCB PTAX"
          step="0.0001"
          placeholder="5,50"
        />
        <ParamField
          label={`Saca de ${crop === "CORN" ? "milho" : "soja"}`}
          value={grainPrice}
          onChange={setGrainPrice}
          onBlur={onCommit}
          formatted={grainPrice ? brlSmall(Number(grainPrice)) : "—"}
          sub="CEPEA/ESALQ"
          step="0.01"
          placeholder="105,00"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fillFromMarket}
          disabled={fetching}
          title="Preencher dólar e saca com a cotação do dia"
        >
          <RefreshCw className={cn("size-3.5", fetching && "animate-spin")} />
          {fetching ? "Buscando…" : "Cotação do dia"}
        </Button>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Área plantada
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {num(area)} ha
          </span>
          <span className="text-[10px] text-muted-foreground">
            soma dos {plotsCount} talhões
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-clay-soft px-2.5 py-1 text-xs text-clay-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {saving ? "Salvando…" : "Recalcula em tempo real"}
        </div>
      </div>
    </div>
  );
}

function ParamField({
  label,
  value,
  onChange,
  onBlur,
  formatted,
  sub,
  step,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  formatted: string;
  sub: string;
  step: string;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          autoFocus
          type="number"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onBlur();
          }}
          className="h-7 w-24 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1 text-left text-sm font-semibold tabular-nums text-foreground hover:text-primary"
        >
          {formatted}
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function KpiCards({
  summary,
  area,
  grainPrice,
  totalCategories,
}: {
  summary: ReturnType<typeof calculateSummary>["summary"];
  area: number;
  grainPrice: number;
  totalCategories: number;
}) {
  return (
    <KpiStrip>
      <KpiCell
        icon={<DollarSign className="size-4" />}
        label="Custo total"
        value={brl(summary.grand_total_brl)}
        sub={`${num(summary.grand_total_brl / 1_000_000, 1)} mi · ${totalCategories} categorias`}
      />
      <KpiCell
        icon={<Scale className="size-4" />}
        label="Custo / hectare"
        value={brl(summary.cost_per_ha_brl)}
        sub={`base ${num(area)} ha`}
      />
      <KpiCell
        icon={<PackageCheck className="size-4" />}
        label="Sacas totais"
        value={`${num(summary.total_sacks, 0)}`}
        sub={grainPrice > 0 ? `÷ ${brlSmall(grainPrice)}/saca` : "informe preço da saca"}
      />
      <KpiCell
        icon={<TrendingUp className="size-4" />}
        label="Ponto de equilíbrio"
        value={num(summary.sacks_per_ha, 2)}
        sub="sacas/ha"
        alert
      />
    </KpiStrip>
  );
}

function Toolbar({
  filter,
  setFilter,
  categoryFilter,
  setCategoryFilter,
  sortMode,
  setSortMode,
  totalItems,
  totalCategories,
  allCategories,
}: {
  filter: string;
  setFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  sortMode: "cost-desc" | "cost-asc" | "name";
  setSortMode: (v: "cost-desc" | "cost-asc" | "name") => void;
  totalItems: number;
  totalCategories: number;
  allCategories: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar insumo, princípio ativo…"
          className="h-9 pl-8"
        />
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-card pl-2 pr-1">
        <Filter className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          size="sm"
          filterLabel="Categoria"
          className="w-auto min-w-[7.5rem] shrink-0 [&>button]:h-8 [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-1 [&>button]:text-xs [&>button]:shadow-none [&>button_span]:whitespace-nowrap"
          options={[
            { value: "all", label: "Todas" },
            ...allCategories.map((c) => ({
              value: c,
              label: CATEGORY_LABELS[c] ?? c,
            })),
          ]}
        />
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-card pl-2 pr-1">
        <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={sortMode}
          onValueChange={(value) => setSortMode(value as typeof sortMode)}
          size="sm"
          filterLabel="Ordenar"
          className="w-auto min-w-[7.5rem] shrink-0 [&>button]:h-8 [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-1 [&>button]:text-xs [&>button]:shadow-none [&>button_span]:whitespace-nowrap"
          options={[
            { value: "cost-desc", label: "Custo ↓" },
            { value: "cost-asc", label: "Custo ↑" },
            { value: "name", label: "Nome" },
          ]}
        />
      </div>
      <span className="ml-auto text-xs text-muted-foreground">
        {totalItems} insumos · {totalCategories} categorias
      </span>
    </div>
  );
}

function InputsTable({
  grouped,
  lineById,
  updateItem,
  removeItem,
  onCommit,
}: {
  grouped: Array<{ category: string; items: EditableItem[] }>;
  lineById: Map<
    string,
    {
      quantity_final: number;
      unit_price_brl: number;
      total_brl: number;
      cost_per_ha_brl: number;
    }
  >;
  updateItem: (id: string, patch: Partial<EditableItem>) => void;
  removeItem: (id: string) => void;
  onCommit: () => void;
}) {
  if (grouped.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum insumo encontrado para o filtro atual.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[23%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[3%]" />
        </colgroup>
        <thead>
          <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-1.5 py-2.5">Produto</th>
            <th className="px-1.5 py-2.5 leading-tight">Dose/ha</th>
            <th className="px-1.5 py-2.5">Estoque</th>
            <th className="px-1.5 py-2.5 text-right leading-tight">Qtde</th>
            <th className="px-1.5 py-2.5 text-right">US$</th>
            <th className="px-1.5 py-2.5 text-right">R$</th>
            <th className="px-1.5 py-2.5 text-right">Total</th>
            <th className="px-1.5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ category, items }) => (
            <CategoryGroup
              key={category}
              category={category}
              items={items}
              lineById={lineById}
              updateItem={updateItem}
              removeItem={removeItem}
              onCommit={onCommit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryGroup({
  category,
  items,
  lineById,
  updateItem,
  removeItem,
  onCommit,
}: {
  category: string;
  items: EditableItem[];
  lineById: Map<
    string,
    { quantity_final: number; unit_price_brl: number; total_brl: number; cost_per_ha_brl: number }
  >;
  updateItem: (id: string, patch: Partial<EditableItem>) => void;
  removeItem: (id: string) => void;
  onCommit: () => void;
}) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  return (
    <>
      <tr className="bg-rail">
        <td colSpan={8} className="px-1.5 py-1.5">
          <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <Sprout className="h-3.5 w-3.5 shrink-0" style={{ color }} />
            <span className="truncate">{CATEGORY_LABELS[category] ?? category}</span>
            <span className="shrink-0 font-normal text-muted-foreground/70">
              · {items.length} {items.length === 1 ? "insumo" : "insumos"}
            </span>
          </span>
        </td>
      </tr>
      {items.map((it) => {
        const calc = lineById.get(it.id);
        return (
          <tr key={it.id} className="border-b last:border-b-0">
            <td className="px-1.5 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{it.product_name}</p>
                {it.supplier ? (
                  <p className="truncate text-xs text-muted-foreground">{it.supplier}</p>
                ) : null}
              </div>
            </td>
            <td className="px-1.5 py-2">
              <div className="flex min-w-0 items-center gap-0.5">
                <Input
                  type="number"
                  value={it.dose_per_hectare}
                  onChange={(e) =>
                    updateItem(it.id, { dose_per_hectare: Number(e.target.value) || 0 })
                  }
                  onBlur={onCommit}
                  className="h-8 w-full min-w-0 px-2 text-sm"
                />
                <DoseUnitSelect
                  value={it.dose_unit ?? "L"}
                  onChange={(val) => { updateItem(it.id, { dose_unit: val }); onCommit(); }}
                  className="h-8 w-[4.25rem] min-w-0 shrink-0"
                />
              </div>
            </td>
            <td className="px-1.5 py-2">
              <Input
                type="number"
                value={it.current_stock}
                onChange={(e) =>
                  updateItem(it.id, { current_stock: Number(e.target.value) || 0 })
                }
                onBlur={onCommit}
                className="h-8 w-full min-w-0 px-2 text-sm"
              />
            </td>
            <td className="px-1.5 py-2 text-right text-sm tabular-nums text-muted-foreground">
              {num(calc?.quantity_final ?? 0, 0)}
            </td>
            <td className="px-1.5 py-2 text-right text-sm tabular-nums text-muted-foreground">
              {it.price_usd != null ? `$${num(it.price_usd, 2)}` : "—"}
            </td>
            <td className="px-1.5 py-2 text-right text-sm tabular-nums text-muted-foreground">
              {brlSmall(calc?.unit_price_brl ?? 0)}
            </td>
            <td className="px-1.5 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
              {brl(calc?.total_brl ?? 0)}
            </td>
            <td className="px-1.5 py-2 text-center">
              <button
                type="button"
                onClick={() => {
                  removeItem(it.id);
                  onCommit();
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR");
}
