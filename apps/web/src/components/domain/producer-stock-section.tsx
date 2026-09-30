"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Boxes,
  Download,
  Eye,
  History,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import {
  StockCategoryTable,
  type StockTableColumn,
} from "@/components/domain/stock/stock-category-table";
import { Button } from "@recomenda/ui/primitives/button";
import { EXPORT_ACTION_CLASS } from "@/components/domain/export-action-class";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { Label } from "@recomenda/ui/primitives/label";
import { MoneyInput, brToCanonical } from "@recomenda/ui/forms/money-input";
import { SearchableSelect } from "@recomenda/ui/forms/select";
import { PageHero } from "@/components/domain/page-hero";
import { StockExportDialog } from "@/components/domain/stock-export-dialog";
import { StockHistoryDialog } from "@/components/domain/stock-history-dialog";
import { StockOriginsDialog } from "@/components/domain/stock-origins-dialog";
import { useLocalCatalog } from "@recomenda/api-hooks";
import {
  useProducerStock,
  useProducerStockByCycle,
  useAdjustProducerStock,
  useDeleteProducerStock,
} from "@recomenda/api-hooks/producers";
import type { StockByCycle } from "@recomenda/api/producers";
import { SEED_CATEGORIES } from "@recomenda/domain/purchase-list/list-item";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { StockExportData } from "@recomenda/domain/stock/stock-export";
import { CROP_LABELS, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

const withUnit = (n: number, unit?: string | null) =>
  `${fmtQty(n)}${unit ? ` ${unit}` : ""}`;

const sumValue = <T,>(rows: T[], value: (r: T) => number | null) =>
  fmtBrl(rows.reduce((s, r) => s + (value(r) ?? 0), 0));

const isSeedCategory = (category: string | null | undefined) =>
  Boolean(category && SEED_CATEGORIES.includes(category));

type StockTab = "galpao" | "sobra" | `cycle:${string}`;
type KindTab = "dose" | "seed";

const TAB_STORAGE = "recomenda:estoque-aba:";

function readStoredTab(producerId: string): StockTab {
  try {
    if (typeof window === "undefined") return "galpao";
    const v = window.localStorage.getItem(TAB_STORAGE + producerId);
    return (v as StockTab | null) ?? "galpao";
  } catch {
    return "galpao";
  }
}

function storeTab(producerId: string, tab: StockTab) {
  try {
    window.localStorage.setItem(TAB_STORAGE + producerId, tab);
  } catch {
    // Sem storage (aba anônima/bloqueado): a aba só não é lembrada.
  }
}

type CycleRow = StockByCycle["cycles"][number]["items"][number] & { key: string };
type LeftoverRow = StockByCycle["unallocated"][number] & { key: string };

/**
 * Estoque do produtor: quantidade e preço são deste produtor apenas —
 * nunca alteram o catálogo global. Pré-preenchem a lista de compra.
 */
export function ProducerStockSection({
  producerId,
  producerName,
}: {
  producerId: string;
  producerName?: string | null;
}) {
  const { data: stock, isLoading } = useProducerStock(producerId);
  const { data: byCycle, isLoading: loadingByCycle } = useProducerStockByCycle(producerId);
  const [storedTab, setStoredTab] = useState<StockTab>(() => readStoredTab(producerId));
  const [kindTab, setKindTab] = useState<KindTab | null>(null);
  const { data: catalogData } = useLocalCatalog();
  const adjust = useAdjustProducerStock(producerId);
  const removeStock = useDeleteProducerStock(producerId);

  const [formOpen, setFormOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [originProduct, setOriginProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    local_product_id: string;
    product_name: string;
    in_use: boolean;
    list_names: string[];
  } | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceBrl, setPriceBrl] = useState("");

  const products = useMemo(() => catalogData?.data ?? [], [catalogData?.data]);
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, keywords: p.name })),
    [products],
  );

  const enrichedRows = useMemo(() => {
    return (stock ?? []).map((item) => {
      const catalog = productById.get(item.local_product_id);
      const price =
        item.price_brl != null && Number.isFinite(Number(item.price_brl))
          ? Number(item.price_brl)
          : null;
      const qty = Number(item.quantity) || 0;
      const category = item.category ?? catalog?.category ?? "";
      return {
        id: item.id,
        local_product_id: item.local_product_id,
        product_name: item.product_name ?? catalog?.name ?? "Produto",
        category,
        categoryLabel:
          PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
          category ??
          "—",
        quantity: qty,
        dose_unit: item.dose_unit ?? catalog?.dose_unit ?? "",
        price_brl: price,
        value_brl: price != null ? price * qty : null,
        in_use: Boolean(item.in_use),
        list_names: item.list_names ?? [],
        key: item.id,
        // Livre = não reservado para nenhuma safra; comprometido = o resto.
        free: Math.min(qty, Math.max(0, Number(item.available ?? qty) || 0)),
        committed: Math.max(0, qty - Math.min(qty, Math.max(0, Number(item.available ?? qty) || 0))),
      };
    });
  }, [stock, productById]);

  // Abas: Galpão · uma por safra ativa com lista de compra · Sem safra. Safra
  // ainda sem estoque também aparece, com todos os produtos da lista e o selo
  // "Aguardando compra" — mostra tudo o que falta comprar.
  const cycleTabs = useMemo(() => byCycle?.cycles ?? [], [byCycle]);
  const tabItems = useMemo(() => {
    const nameCount = new Map<string, number>();
    for (const c of cycleTabs) nameCount.set(c.cycle_name, (nameCount.get(c.cycle_name) ?? 0) + 1);
    return [
      { value: "galpao" as StockTab, label: "Galpão" },
      ...cycleTabs.map((c) => {
        const name =
          (nameCount.get(c.cycle_name) ?? 0) > 1
            ? `${c.cycle_name} · ${c.crops.map((crop) => CROP_LABELS[crop] ?? crop).join(", ")}`
            : c.cycle_name;
        return {
          value: `cycle:${c.cycle_id}` as StockTab,
          label: c.has_stock ? (
            name
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {name}
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                Aguardando compra
              </Badge>
            </span>
          ),
        };
      }),
      { value: "sobra" as StockTab, label: "Sem safra" },
    ];
  }, [cycleTabs]);
  const tab: StockTab = tabItems.some((t) => t.value === storedTab) ? storedTab : "galpao";
  const selectTab = (next: StockTab) => {
    setStoredTab(next);
    setKindTab(null);
    storeTab(producerId, next);
  };
  const activeCycle =
    tab.startsWith("cycle:") ? cycleTabs.find((c) => `cycle:${c.cycle_id}` === tab) ?? null : null;

  const cycleRows: CycleRow[] = useMemo(
    () => (activeCycle?.items ?? []).map((it) => ({ ...it, key: it.local_product_id })),
    [activeCycle],
  );
  const leftoverRows: LeftoverRow[] = useMemo(
    () => (byCycle?.unallocated ?? []).map((it) => ({ ...it, key: it.local_product_id })),
    [byCycle],
  );

  const dashboard = useMemo(() => {
    const productCount = enrichedRows.length;
    const totalQty = enrichedRows.reduce((s, r) => s + r.quantity, 0);
    const totalValue = enrichedRows.reduce((s, r) => s + (r.value_brl ?? 0), 0);
    const withPrice = enrichedRows.filter((r) => r.price_brl != null).length;
    return { productCount, totalQty, totalValue, withPrice };
  }, [enrichedRows]);

  const resetForm = () => {
    setProductId("");
    setQuantity("");
    setPriceBrl("");
    setFormOpen(false);
  };

  const onProductChange = (id: string) => {
    setProductId(id);
    const existing = enrichedRows.find((r) => r.local_product_id === id);
    if (existing) {
      setQuantity(String(existing.quantity));
      setPriceBrl(existing.price_brl != null ? String(existing.price_brl) : "");
    } else {
      setQuantity("");
      setPriceBrl("");
    }
  };

  const save = async () => {
    if (!productId) return toast.error("Selecione o produto.");
    const n = Number(brToCanonical(quantity) || quantity);
    if (!Number.isFinite(n) || n < 0) {
      return toast.error("Informe uma quantidade válida.");
    }

    const priceRaw = priceBrl.trim();
    let price: number | null = null;
    if (priceRaw !== "") {
      price = Number(priceRaw);
      if (!Number.isFinite(price) || price < 0) {
        return toast.error("Informe um preço válido.");
      }
    }

    try {
      await adjust.mutateAsync({
        local_product_id: productId,
        new_quantity: n,
        // Sempre envia o preço deste produtor (null limpa) — não mexe no catálogo.
        price_brl: price,
      });
      toast.success("Estoque atualizado.");
      resetForm();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar o estoque."));
    }
  };

  const editEntry = (row: (typeof enrichedRows)[number]) => {
    setFormOpen(true);
    setProductId(row.local_product_id);
    setQuantity(String(row.quantity));
    setPriceBrl(row.price_brl != null ? String(row.price_brl) : "");
  };

  const exportData: StockExportData = useMemo(
    () => ({
      producerName: producerName ?? null,
      items: enrichedRows.map((r) => ({
        product_name: r.product_name,
        category: r.category,
        category_label: r.categoryLabel,
        quantity: r.quantity,
        dose_unit: r.dose_unit,
        price_brl: r.price_brl,
        value_brl: r.value_brl,
      })),
    }),
    [enrichedRows, producerName],
  );

  /** Divide em Sementes | Defensivos e fertilizantes, igual à lista de compra. */
  function renderKindSplit<R extends { category: string | null }>(
    rows: R[],
    render: (rows: R[]) => ReactNode,
  ) {
    const seeds = rows.filter((r) => isSeedCategory(r.category));
    const doses = rows.filter((r) => !isSeedCategory(r.category));
    const kind: KindTab =
      kindTab ?? (doses.length > 0 || seeds.length === 0 ? "dose" : "seed");
    const both = seeds.length > 0 && doses.length > 0;
    return (
      <div className="flex flex-col gap-3">
        {both ? (
          <SegmentedTabs
            variant="pill"
            value={kind}
            onValueChange={setKindTab}
            items={[
              { value: "dose", label: "Defensivos e fertilizantes", badgeCount: doses.length },
              { value: "seed", label: "Sementes", badgeCount: seeds.length },
            ]}
          />
        ) : null}
        {render(kind === "seed" ? seeds : doses)}
      </div>
    );
  }

  type GalpaoRow = (typeof enrichedRows)[number];
  const galpaoColumns: StockTableColumn<GalpaoRow>[] = [
    {
      id: "quantity",
      label: "Quantidade",
      align: "right",
      accessor: { kind: "range", get: (r) => r.quantity },
      render: (r) => withUnit(r.quantity, r.dose_unit),
    },
    {
      id: "committed",
      label: "Comprometido",
      align: "right",
      accessor: { kind: "range", get: (r) => r.committed },
      render: (r) =>
        r.committed > 0 ? (
          <span title={r.list_names.length ? `Safras: ${r.list_names.join(", ")}` : undefined}>
            {withUnit(r.committed, r.dose_unit)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "free",
      label: "Livre",
      align: "right",
      accessor: { kind: "range", get: (r) => r.free },
      render: (r) =>
        r.free > 0 ? withUnit(r.free, r.dose_unit) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "price",
      label: "Preço médio",
      align: "right",
      accessor: { kind: "range", get: (r) => r.price_brl },
      render: (r) => (r.price_brl != null ? fmtBrl(r.price_brl) : "—"),
    },
    {
      id: "value",
      label: "Valor",
      align: "right",
      accessor: { kind: "range", get: (r) => r.value_brl },
      render: (r) => (r.value_brl != null ? fmtBrl(r.value_brl) : "—"),
      total: (rows) => sumValue(rows, (r) => r.value_brl),
      className: "font-medium",
    },
    {
      id: "origin",
      label: "Origem",
      align: "center",
      render: (r) => (
        <button
          type="button"
          onClick={() => setOriginProduct({ id: r.local_product_id, name: r.product_name })}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Ver origem"
          title="Ver origem"
        >
          <Eye className="mx-auto h-4 w-4" />
        </button>
      ),
    },
    {
      id: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.in_use ? (
            <Badge
              variant="warning"
              title={r.list_names.length ? `Em uso em: ${r.list_names.join(", ")}` : undefined}
            >
              Em uso
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={() => editEntry(r)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Editar item"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setPendingDelete({
                local_product_id: r.local_product_id,
                product_name: r.product_name,
                in_use: r.in_use,
                list_names: r.list_names,
              })
            }
            className="text-muted-foreground hover:text-destructive"
            aria-label="Excluir item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const cycleValue = (r: CycleRow) =>
    r.price_brl != null ? r.price_brl * r.in_stock_for_cycle : null;
  const cycleColumns: StockTableColumn<CycleRow>[] = [
    {
      id: "in_stock",
      label: "Em estoque p/ a safra",
      align: "right",
      accessor: { kind: "range", get: (r) => r.in_stock_for_cycle },
      render: (r) =>
        r.in_stock_for_cycle > 0 ? (
          withUnit(r.in_stock_for_cycle, r.dose_unit)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "font-medium",
    },
    {
      id: "required",
      label: "Necessário",
      align: "right",
      accessor: { kind: "range", get: (r) => r.required_remaining },
      render: (r) => withUnit(r.required_remaining, r.dose_unit),
    },
    {
      id: "applied",
      label: "Já aplicado",
      align: "right",
      accessor: { kind: "range", get: (r) => r.applied },
      render: (r) =>
        r.applied > 0 ? withUnit(r.applied, r.dose_unit) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "to_buy",
      label: "Falta comprar",
      align: "right",
      accessor: { kind: "range", get: (r) => r.to_buy },
      render: (r) =>
        r.to_buy > 0 ? (
          <span className="font-semibold text-warning-strong">{withUnit(r.to_buy, r.dose_unit)}</span>
        ) : (
          <span className="text-success-strong">Coberto</span>
        ),
    },
    {
      id: "price",
      label: "Preço médio",
      align: "right",
      accessor: { kind: "range", get: (r) => r.price_brl ?? null },
      render: (r) => (r.price_brl != null ? fmtBrl(r.price_brl) : "—"),
    },
    {
      id: "value",
      label: "Valor em estoque",
      align: "right",
      accessor: { kind: "range", get: cycleValue },
      render: (r) => {
        const v = cycleValue(r);
        return v != null ? fmtBrl(v) : "—";
      },
      total: (rows) => sumValue(rows, cycleValue),
      className: "font-medium",
    },
  ];

  const leftoverValue = (r: LeftoverRow) =>
    r.price_brl != null ? r.price_brl * r.quantity : null;
  const leftoverColumns: StockTableColumn<LeftoverRow>[] = [
    {
      id: "quantity",
      label: "Quantidade",
      align: "right",
      accessor: { kind: "range", get: (r) => r.quantity },
      render: (r) => withUnit(r.quantity, r.dose_unit),
      className: "font-medium",
    },
    {
      id: "price",
      label: "Preço médio",
      align: "right",
      accessor: { kind: "range", get: (r) => r.price_brl ?? null },
      render: (r) => (r.price_brl != null ? fmtBrl(r.price_brl) : "—"),
    },
    {
      id: "value",
      label: "Valor",
      align: "right",
      accessor: { kind: "range", get: leftoverValue },
      render: (r) => {
        const v = leftoverValue(r);
        return v != null ? fmtBrl(v) : "—";
      },
      total: (rows) => sumValue(rows, leftoverValue),
      className: "font-medium",
    },
  ];

  const saving = adjust.isPending;
  const title = producerName
    ? `Estoque · ${producerName}`
    : "Estoque do produtor";

  return (
    <>
      <PageHero
        icon={<Boxes className="size-6" />}
        eyebrow="Estoque do produtor"
        title={title}
        stats={[
          {
            label: "Produtos",
            value: isLoading ? "…" : dashboard.productCount,
          },
          {
            label: "Qtde total",
            value: isLoading ? "…" : fmtQty(dashboard.totalQty),
          },
          {
            label:
              !isLoading &&
              dashboard.productCount > 0 &&
              dashboard.withPrice < dashboard.productCount
                ? `Valor estimado · ${dashboard.withPrice}/${dashboard.productCount} com preço`
                : "Valor estimado",
            value: isLoading ? "…" : fmtBrl(dashboard.totalValue),
          },
        ]}
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Itens em estoque</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
            <Button
              type="button"
              size="sm"
              className={`gap-1.5 ${EXPORT_ACTION_CLASS}`}
              onClick={() => setExportOpen(true)}
              disabled={enrichedRows.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {!formOpen ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar ao estoque
              </Button>
            ) : null}
          </div>
        </div>

        {formOpen ? (
          <div className="mb-5 rounded-xl border border-border bg-surface-2/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {productId && enrichedRows.some((r) => r.local_product_id === productId)
                  ? "Editar item"
                  : "Novo item"}
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="Fechar formulário"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Produto</Label>
                <SearchableSelect
                  value={productId}
                  onValueChange={onProductChange}
                  options={productOptions}
                  placeholder="Selecione o produto…"
                  filterLabel="Buscar produto"
                  searchPlaceholder="Buscar produto…"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5 sm:w-36">
                <Label>Quantidade</Label>
                <MoneyInput
                  value={quantity}
                  onValueChange={setQuantity}
                  decimals={2}
                  grouping={false}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5 sm:w-40">
                <Label>Preço médio R$/un.</Label>
                <MoneyInput
                  placeholder="R$"
                  value={priceBrl}
                  onValueChange={setPriceBrl}
                />
              </div>
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading || loadingByCycle ? (
          <div
            role="status"
            aria-label="Carregando estoque"
            className="flex justify-center py-12"
          >
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : enrichedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum produto em estoque cadastrado.
            </p>
            {!formOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar primeiro item
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SegmentedTabs value={tab} onValueChange={selectTab} items={tabItems} />
            {tab === "galpao" || tab === "sobra" ? (
              <p className="-mt-1 text-xs text-muted-foreground">
                {tab === "galpao"
                  ? "Estoque físico do produtor. Comprometido é o que já está reservado para as safras; livre é o que sobra."
                  : "O que sobra no galpão e nenhuma safra ativa vai usar — inclui a sobra de safra colhida ou arquivada."}
              </p>
            ) : null}
            {activeCycle && !activeCycle.has_stock ? (
              <div className="rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
                Nenhum estoque para esta safra ainda.
              </div>
            ) : null}
            {tab === "galpao"
              ? renderKindSplit(enrichedRows, (rows) => (
                  <StockCategoryTable
                    rows={rows}
                    columns={galpaoColumns}
                    emptyText="Nenhum produto nesta categoria."
                  />
                ))
              : tab === "sobra"
                ? renderKindSplit(leftoverRows, (rows) => (
                    <StockCategoryTable
                      rows={rows}
                      columns={leftoverColumns}
                      emptyText="Todo o estoque está reservado para as safras."
                    />
                  ))
                : renderKindSplit(cycleRows, (rows) => (
                    <StockCategoryTable
                      rows={rows}
                      columns={cycleColumns}
                      emptyText="Nenhum produto desta safra nesta categoria."
                    />
                  ))}
          </div>
        )}
      </section>

      <StockExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={exportData}
      />
      <StockHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        producerId={producerId}
      />
      <StockOriginsDialog
        open={originProduct != null}
        onOpenChange={(v) => {
          if (!v) setOriginProduct(null);
        }}
        producerId={producerId}
        localProductId={originProduct?.id ?? ""}
        productName={originProduct?.name ?? ""}
      />
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete
            ? `Excluir ${pendingDelete.product_name} do estoque?`
            : "Excluir produto do estoque?"
        }
        description={
          pendingDelete?.in_use ? (
            <>
              Este produto está vinculado a{" "}
              {pendingDelete.list_names.length
                ? pendingDelete.list_names.join(", ")
                : "uma safra ativa"}
              . A necessidade de compra dessas safras será recalculada.
            </>
          ) : (
            "O produto sai do estoque deste produtor. Esta ação não pode ser desfeita."
          )
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={removeStock.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await removeStock.mutateAsync(pendingDelete.local_product_id);
            toast.success("Produto excluído do estoque.");
            setPendingDelete(null);
          } catch (e) {
            toast.error(apiErrorMessage(e, "Não foi possível excluir o estoque."));
          }
        }}
      />
    </>
  );
}
