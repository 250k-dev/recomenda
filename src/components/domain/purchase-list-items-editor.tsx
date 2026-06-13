"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SearchableSelect } from "@/components/ui/select";
import {
  useCloneGlobalProduct,
  useGlobalCatalog,
  usePlatformCatalog,
} from "@/lib/api/hooks";
import {
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import {
  buildPurchaseListCatalog,
  productsForPurchaseListCategory,
  purchaseListProductLabel,
  type PurchaseListCatalogProduct,
  type PurchaseListCrop,
} from "@/lib/catalog/purchase-list-catalog";
import { cn } from "@/lib/utils";
import { Field, fmt, type ListItem } from "@/components/domain/season/_shared";

const DEFAULT_ITEM_STAGE = "Outra";

type PurchaseListItemsEditorProps = {
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  /** Cultura da lista — filtra variedades/híbridos por soja ou milho. */
  crop?: PurchaseListCrop | null;
  className?: string;
};

function toProductOptionValue(item: ListItem): string {
  return item.productId;
}

export function PurchaseListItemsEditor({
  items,
  setItems,
  totalHa,
  crop,
  className,
}: PurchaseListItemsEditorProps) {
  const platformCatalog = usePlatformCatalog();
  const globalCatalog = useGlobalCatalog();
  const cloneGlobal = useCloneGlobalProduct();
  const [resolvingProductKey, setResolvingProductKey] = useState<string | null>(null);

  const products = useMemo(
    () =>
      buildPurchaseListCatalog(
        platformCatalog.data?.data ?? [],
        globalCatalog.data?.data ?? [],
      ),
    [platformCatalog.data?.data, globalCatalog.data?.data],
  );

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: `i-${Date.now()}-${prev.length}`,
        category: "",
        productId: "",
        productName: "",
        stage: DEFAULT_ITEM_STAGE,
        dose: "",
        unit: "L",
        nApps: "1",
        stock: "0",
        price: "",
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<ListItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const handleCategoryChange = (key: string, category: string, previousCategory: string) => {
    const patch: Partial<ListItem> = { category };
    if (category !== previousCategory) {
      patch.productId = "";
      patch.productName = "";
    }
    updateItem(key, patch);
  };

  const resolveProductSelection = async (
    itemKey: string,
    optionValue: string,
    rowProducts: PurchaseListCatalogProduct[],
  ) => {
    const product = rowProducts.find((entry) => entry.optionValue === optionValue);
    if (!product) return;

    if (!product.globalId || !product.isGlobalOnly) {
      updateItem(itemKey, {
        productId: product.optionValue,
        productName: product.name,
        unit: product.dose_unit,
      });
      return;
    }

    setResolvingProductKey(itemKey);
    try {
      const cloned = await cloneGlobal.mutateAsync(product.globalId);
      updateItem(itemKey, {
        productId: cloned.id,
        productName: cloned.name ?? product.name,
        unit: cloned.dose_unit ?? product.dose_unit,
      });
    } catch {
      toast.error("Não foi possível adicionar o produto da plataforma global.");
    } finally {
      setResolvingProductKey(null);
    }
  };

  const renderProductField = (
    it: ListItem,
    rowProducts: PurchaseListCatalogProduct[],
    minWidth?: string,
  ) => {
    const optionValue = toProductOptionValue(it);
    const productOptions = rowProducts.map((product) => ({
      value: product.optionValue,
      label: purchaseListProductLabel(product),
      keywords: `${product.name} ${product.crop === "SOYBEAN" ? "soja" : product.crop === "CORN" ? "milho" : ""}`,
    }));

    return (
      <SearchableSelect
        key={`${it.key}-${it.category}`}
        value={optionValue}
        onValueChange={(nextValue) => {
          void resolveProductSelection(it.key, nextValue, rowProducts);
        }}
        options={productOptions}
        placeholder={it.category ? "Selecione…" : "Escolha a categoria"}
        filterLabel="Buscar produto"
        searchPlaceholder="Buscar produto…"
        selectedLabel={it.productId ? it.productName || undefined : undefined}
        disabled={!it.category || resolvingProductKey === it.key}
        loading={resolvingProductKey === it.key}
        loadingMessage="Vinculando…"
        className={minWidth}
      />
    );
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm lg:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Categoria</th>
              <th className="px-3 py-2.5 text-left">Produto</th>
              <th className="px-3 py-2.5 text-left">Dose/ha</th>
              <th className="min-w-[108px] px-3 py-2.5 text-left">Un.</th>
              <th className="px-3 py-2.5 text-left">Nº apl.</th>
              <th className="px-3 py-2.5 text-left">Estoque</th>
              <th className="px-3 py-2.5 text-left">Preço R$/un.</th>
              <th className="px-3 py-2.5 text-right">Necessário</th>
              <th className="px-3 py-2.5 text-right">A comprar</th>
              <th className="px-3 py-2.5 text-right">Valor total</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto adicionado. Use o botão abaixo para incluir insumos.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const rowProducts = productsForPurchaseListCategory(
                  products,
                  it.category,
                  toProductOptionValue(it),
                  it.productName,
                  crop,
                );
                const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
                const toBuy = Math.max(0, required - Number(it.stock || 0));
                const totalValue = toBuy * Number(it.price || 0);
                return (
                  <tr key={it.key} className="align-middle">
                    <td className="px-3 py-2">
                      <Select
                        value={it.category}
                        onValueChange={(category) =>
                          handleCategoryChange(it.key, category, it.category)
                        }
                        placeholder="Selecione…"
                        filterLabel="Categoria"
                        options={GLOBAL_PRODUCT_CATEGORIES.map((category) => ({
                          value: category,
                          label: PRODUCT_CATEGORY_LABELS[category],
                        }))}
                        className="min-w-[140px]"
                      />
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      {renderProductField(it, rowProducts, "min-w-[200px]")}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.dose}
                        onChange={(e) => updateItem(it.key, { dose: e.target.value })}
                        className="w-24"
                      />
                    </td>
                    <td className="min-w-[108px] px-3 py-2">
                      <DoseUnitSelect
                        value={it.unit}
                        onChange={(val) => updateItem(it.key, { unit: val })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={it.nApps}
                        onChange={(e) => updateItem(it.key, { nApps: e.target.value })}
                        className="w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.stock}
                        onChange={(e) => updateItem(it.key, { stock: e.target.value })}
                        className="w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="opcional"
                        value={it.price}
                        onChange={(e) => updateItem(it.key, { price: e.target.value })}
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmt(required)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                      {fmt(toBuy)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {it.price
                        ? totalValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-3 lg:hidden">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum produto adicionado.
          </div>
        ) : (
          items.map((it) => {
            const rowProducts = productsForPurchaseListCategory(
              products,
              it.category,
              toProductOptionValue(it),
              it.productName,
              crop,
            );
            const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
            const toBuy = Math.max(0, required - Number(it.stock || 0));
            return (
              <div key={it.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Insumo
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <Field label="Categoria">
                    <Select
                      value={it.category}
                      onValueChange={(category) =>
                        handleCategoryChange(it.key, category, it.category)
                      }
                      placeholder="Selecione…"
                      filterLabel="Categoria"
                      options={GLOBAL_PRODUCT_CATEGORIES.map((category) => ({
                        value: category,
                        label: PRODUCT_CATEGORY_LABELS[category],
                      }))}
                    />
                  </Field>
                  <Field label="Produto">
                    {renderProductField(it, rowProducts)}
                  </Field>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Dose/ha">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.dose}
                      onChange={(e) => updateItem(it.key, { dose: e.target.value })}
                    />
                  </Field>
                  <Field label="Unidade">
                    <DoseUnitSelect
                      value={it.unit}
                      onChange={(val) => updateItem(it.key, { unit: val })}
                    />
                  </Field>
                  <Field label="Nº aplicações">
                    <Input
                      type="number"
                      value={it.nApps}
                      onChange={(e) => updateItem(it.key, { nApps: e.target.value })}
                    />
                  </Field>
                  <Field label="Estoque atual">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.stock}
                      onChange={(e) => updateItem(it.key, { stock: e.target.value })}
                    />
                  </Field>
                  <Field label="Preço R$/un.">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="opcional"
                      value={it.price}
                      onChange={(e) => updateItem(it.key, { price: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Necessário{" "}
                    <span className="tabular-nums text-foreground">{fmt(required)}</span>
                  </span>
                  <span className="font-semibold">
                    A comprar{" "}
                    <span className="tabular-nums text-foreground">{fmt(toBuy)}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <Button type="button" variant="outline" onClick={addItem} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar produto
        </Button>
      </div>
    </div>
  );
}
