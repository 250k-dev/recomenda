"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { duplicatePurchaseList } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { useSeasonCostPlan, useUpdatePurchaseList, useLocalCatalog } from "@/lib/api/hooks";
import {
  calculateSummary,
  CATEGORY_ORDER,
  type CostItemInput,
} from "@/lib/cost-plan/calculate";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  SEED: "Cultivares",
  FERTILIZER: "Adubação",
  HERBICIDE: "Herbicida",
  FUNGICIDE: "Fungicida",
  INSECTICIDE: "Inseticida",
  BIOLOGICAL: "Biológico",
  SEED_TREATMENT: "Tratamento de sementes",
  FOLIAR: "Foliar",
  ADJUVANT: "Adjuvante",
  OTHER: "Outros",
};

const CATEGORY_COLORS: Record<string, string> = {
  SEED: "#3F7D3D",
  FERTILIZER: "#D9A441",
  HERBICIDE: "#B85C38",
  FUNGICIDE: "#4A7A99",
  INSECTICIDE: "#B5453A",
  BIOLOGICAL: "#7BAE3F",
  SEED_TREATMENT: "#8B5A2B",
  FOLIAR: "#9A9E7E",
  ADJUVANT: "#6B7155",
  OTHER: "#6B7155",
};

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

  const [fxRate, setFxRate] = useState<string>("");
  const [grainPrice, setGrainPrice] = useState<string>("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"cost-desc" | "cost-asc" | "name">("cost-desc");

  useEffect(() => {
    if (!plan) return;
    setFxRate(plan.fx_rate_usd_brl != null ? String(plan.fx_rate_usd_brl) : "");
    setGrainPrice(plan.grain_price_brl != null ? String(plan.grain_price_brl) : "");
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
      })),
    );
  }, [plan]);

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
        ? `/farms/${farmId}/season/new?producer_id=${encodeURIComponent(producerId)}&season_id=${encodeURIComponent(seasonId)}`
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
        crop={plan.crop}
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
        crop={plan.crop}
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
          <CategoryDistributionPanel summary={summary} />
        </div>
      </div>
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
  const meta = [cropLabel, variety, `${num(area)} ha`, `${plotsCount} talhões`].filter(Boolean) as string[];
  const updatedLabel = updatedAt
    ? formatRelative(updatedAt)
    : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wheat className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Plano de custo · {planTitle}
          </p>
          <h2 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {meta.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 ? <span className="text-muted-foreground/50">·</span> : null}
                {m}
              </span>
            ))}
          </p>
          {updatedLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">Atualizado {updatedLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CropToggle crop={crop} />
        <DuplicateButton purchaseListId={purchaseListId} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
          <Download className="h-4 w-4" />
          Exportar
        </Button>
        <AddInsumoMenu products={products} onSelect={onAddProduct} />
      </div>
    </div>
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
        router.push(`/seasons/${newList.season_id}?tab=cost-plan`);
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
          !isSoy ? "bg-amber-100 text-amber-600" : "text-muted-foreground",
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
          sub="B3 PTAX"
          step="0.0001"
          placeholder="5,50"
        />
        <ParamField
          label={`Saca de ${crop === "CORN" ? "milho" : "soja"}`}
          value={grainPrice}
          onChange={setGrainPrice}
          onBlur={onCommit}
          formatted={grainPrice ? brlSmall(Number(grainPrice)) : "—"}
          sub="média 30 dias"
          step="0.01"
          placeholder="105,00"
        />
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
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-600">
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<DollarSign className="h-4 w-4" />}
        accent="primary"
        label="Custo total"
        value={brl(summary.grand_total_brl)}
        sub={`${num(summary.grand_total_brl / 1_000_000, 1)} mi · ${totalCategories} categorias`}
      />
      <KpiCard
        icon={<Scale className="h-4 w-4" />}
        accent="sky"
        label="Custo / hectare"
        value={brl(summary.cost_per_ha_brl)}
        sub={`base ${num(area)} ha`}
      />
      <KpiCard
        icon={<PackageCheck className="h-4 w-4" />}
        accent="sun"
        label="Sacas totais"
        value={`${num(summary.total_sacks, 0)}`}
        sub={grainPrice > 0 ? `÷ ${brlSmall(grainPrice)}/saca` : "informe preço da saca"}
      />
      <KpiCard
        icon={<TrendingUp className="h-4 w-4" />}
        accent="clay"
        label="Sacas / hectare"
        value={num(summary.sacks_per_ha, 2)}
        sub="ponto de equilíbrio"
      />
    </div>
  );
}

function KpiCard({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: "primary" | "sky" | "sun" | "clay";
  label: string;
  value: string;
  sub: string;
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    sky: "bg-sky-100 text-sky-600",
    sun: "bg-amber-100 text-amber-600",
    clay: "bg-orange-100 text-orange-600",
  } as const;
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            accentClasses[accent],
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-1.5 text-[26px] font-semibold leading-tight tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
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
      <div className="flex items-center gap-1.5 rounded-md border bg-card pl-2 pr-1 text-xs">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-8 border-0 bg-transparent pr-2 text-xs outline-none"
        >
          <option value="all">Categoria: Todas</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-card pl-2 pr-1 text-xs">
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          className="h-8 border-0 bg-transparent pr-2 text-xs outline-none"
        >
          <option value="cost-desc">Ordenar: Custo ↓</option>
          <option value="cost-asc">Ordenar: Custo ↑</option>
          <option value="name">Ordenar: Nome</option>
        </select>
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
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5">Produto</th>
            <th className="px-2 py-2.5">Dose / ha</th>
            <th className="px-2 py-2.5">Estoque</th>
            <th className="px-2 py-2.5 text-right">Qtde final</th>
            <th className="px-2 py-2.5 text-right">US$ un.</th>
            <th className="px-2 py-2.5 text-right">R$ un.</th>
            <th className="px-2 py-2.5 text-right">Total</th>
            <th className="px-2 py-2.5" />
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
      <tr className="bg-muted/40">
        <td colSpan={8} className="px-3 py-1.5">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <Sprout className="h-3.5 w-3.5" style={{ color }} />
            {CATEGORY_LABELS[category] ?? category}
            <span className="font-normal text-muted-foreground/70">
              · {items.length} {items.length === 1 ? "insumo" : "insumos"}
            </span>
          </span>
        </td>
      </tr>
      {items.map((it) => {
        const calc = lineById.get(it.id);
        return (
          <tr key={it.id} className="border-b last:border-b-0">
            <td className="px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{it.product_name}</p>
                {it.supplier ? (
                  <p className="text-xs text-muted-foreground">{it.supplier}</p>
                ) : null}
              </div>
            </td>
            <td className="px-2 py-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={it.dose_per_hectare}
                  onChange={(e) =>
                    updateItem(it.id, { dose_per_hectare: Number(e.target.value) || 0 })
                  }
                  onBlur={onCommit}
                  className="h-8 w-20"
                />
                <DoseUnitSelect
                  value={it.dose_unit ?? "L"}
                  onChange={(val) => { updateItem(it.id, { dose_unit: val }); onCommit(); }}
                  className="h-8"
                />
              </div>
            </td>
            <td className="px-2 py-2">
              <Input
                type="number"
                value={it.current_stock}
                onChange={(e) =>
                  updateItem(it.id, { current_stock: Number(e.target.value) || 0 })
                }
                onBlur={onCommit}
                className="h-8 w-20"
              />
            </td>
            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
              {num(calc?.quantity_final ?? 0, 0)}
            </td>
            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
              {it.price_usd != null ? `$${num(it.price_usd, 2)}` : "—"}
            </td>
            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
              {brlSmall(calc?.unit_price_brl ?? 0)}
            </td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">
              {brl(calc?.total_brl ?? 0)}
            </td>
            <td className="px-2 py-2">
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

function CategoryDistributionPanel({
  summary,
}: {
  summary: ReturnType<typeof calculateSummary>["summary"];
}) {
  const [mode, setMode] = useState<"brl" | "sacks">("brl");
  const items = summary.category_breakdown;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Distribuição por categoria</h3>
        <div className="flex rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("brl")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "brl" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
          >
            R$
          </button>
          <button
            type="button"
            onClick={() => setMode("sacks")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "sacks" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
          >
            sacas/ha
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const color = CATEGORY_COLORS[it.category] ?? CATEGORY_COLORS.OTHER;
            return (
              <li key={it.category}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">
                    {CATEGORY_LABELS[it.category] ?? it.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {num(it.share_pct, 1)}% ·{" "}
                    {mode === "brl"
                      ? brlSmall(it.total_brl)
                      : `${num(it.sacks_per_ha, 2)} sc/ha`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, it.share_pct)}%`,
                      background: color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
