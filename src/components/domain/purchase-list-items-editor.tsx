"use client";

import { Plus, Trash2 } from "lucide-react";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalCatalog } from "@/lib/api/hooks";
import type { Product } from "@/lib/api/catalog";
import {
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import { cn } from "@/lib/utils";
import { Field, STAGES, fmt, type ListItem } from "@/components/domain/season/_shared";

type PurchaseListItemsEditorProps = {
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  className?: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function productsForCategory(products: Product[], category: string): Product[] {
  if (!category) return [];
  return products.filter((product) => (product.category ?? "OTHER") === category);
}

export function PurchaseListItemsEditor({
  items,
  setItems,
  totalHa,
  className,
}: PurchaseListItemsEditorProps) {
  const catalog = useLocalCatalog();
  const products = catalog.data?.data ?? [];

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: `i-${Date.now()}-${prev.length}`,
        category: "",
        productId: "",
        productName: "",
        stage: STAGES[0],
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

  const handleCategoryChange = (key: string, category: string, currentProductId: string) => {
    const patch: Partial<ListItem> = { category };
    const currentProduct = products.find((product) => product.id === currentProductId);
    if (
      currentProductId &&
      currentProduct &&
      (currentProduct.category ?? "OTHER") !== category
    ) {
      patch.productId = "";
      patch.productName = "";
    }
    updateItem(key, patch);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm lg:block">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Categoria</th>
              <th className="px-3 py-2.5 text-left">Produto</th>
              <th className="px-3 py-2.5 text-left">Etapa</th>
              <th className="px-3 py-2.5 text-left">Dose/ha</th>
              <th className="px-3 py-2.5 text-left">Un.</th>
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
                <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto adicionado. Use o botão abaixo para incluir insumos.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const rowProducts = productsForCategory(products, it.category);
                const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
                const toBuy = Math.max(0, required - Number(it.stock || 0));
                const totalValue = toBuy * Number(it.price || 0);
                return (
                  <tr key={it.key} className="align-middle">
                    <td className="px-3 py-2">
                      <select
                        value={it.category}
                        onChange={(e) => handleCategoryChange(it.key, e.target.value, it.productId)}
                        className={cn(selectClass, "min-w-[140px]")}
                      >
                        <option value="">Selecione…</option>
                        {GLOBAL_PRODUCT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {PRODUCT_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const prod = rowProducts.find((product) => product.id === e.target.value);
                          updateItem(it.key, {
                            productId: e.target.value,
                            productName: prod?.name ?? "",
                            unit: prod?.dose_unit ?? it.unit,
                          });
                        }}
                        disabled={!it.category}
                        className={cn(selectClass, "min-w-[180px]")}
                      >
                        <option value="">
                          {it.category ? "Selecione…" : "Escolha a categoria"}
                        </option>
                        {rowProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.stage}
                        onChange={(e) => updateItem(it.key, { stage: e.target.value })}
                        className={cn(selectClass, "min-w-[150px]")}
                      >
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
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
                    <td className="px-3 py-2">
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
            const rowProducts = productsForCategory(products, it.category);
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
                    <select
                      value={it.category}
                      onChange={(e) => handleCategoryChange(it.key, e.target.value, it.productId)}
                      className={selectClass}
                    >
                      <option value="">Selecione…</option>
                      {GLOBAL_PRODUCT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {PRODUCT_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Produto">
                    <select
                      value={it.productId}
                      onChange={(e) => {
                        const prod = rowProducts.find((product) => product.id === e.target.value);
                        updateItem(it.key, {
                          productId: e.target.value,
                          productName: prod?.name ?? "",
                          unit: prod?.dose_unit ?? it.unit,
                        });
                      }}
                      disabled={!it.category}
                      className={selectClass}
                    >
                      <option value="">
                        {it.category ? "Selecione…" : "Escolha a categoria"}
                      </option>
                      {rowProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Etapa">
                    <select
                      value={it.stage}
                      onChange={(e) => updateItem(it.key, { stage: e.target.value })}
                      className={selectClass}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </Field>
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
