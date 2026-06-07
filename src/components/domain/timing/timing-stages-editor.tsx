"use client";

import { ArrowDown, ArrowUp, FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Field } from "@/components/domain/season/_shared";
import { useLocalCatalog } from "@/lib/api/hooks";
import {
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import type { Product } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

export const TIMING_STAGE_PRESETS = [
  "Dessecação",
  "Pós-emergência",
  "Fungicida V4",
  "Fungicida V6",
  "Fungicida VT",
  "Inseticida",
  "Foliar",
  "Outra",
] as const;

export const TIMING_TRIGGER_LABELS: Record<string, string> = {
  DAYS_AFTER_PLANTING: "Dias após plantio",
  DAYS_AFTER_DESICCATION: "Dias após dessecação",
  DAYS_AFTER_TASSELING: "Dias após pendoamento",
  FIXED_DATE_OFFSET: "Offset de data fixa",
};

export type StageProductDraft = {
  key: string;
  category: string;
  productId: string;
  productName: string;
  dose: string;
  unit: string;
  mixItemId?: string;
};

function productsForCategory(products: Product[], category: string): Product[] {
  if (!category) return [];
  return products.filter((product) => (product.category ?? "OTHER") === category);
}

export type TimingStageField = {
  key: string;
  name: string;
  trigger_type: string;
  window_start_days: string;
  window_end_days: string;
  products: StageProductDraft[];
};

export function newStageProductDraft(): StageProductDraft {
  return {
    key: crypto.randomUUID(),
    category: "",
    productId: "",
    productName: "",
    dose: "",
    unit: "L",
  };
}

export function newTimingStageField(name = ""): TimingStageField {
  return {
    key: crypto.randomUUID(),
    name,
    trigger_type: "DAYS_AFTER_PLANTING",
    window_start_days: "0",
    window_end_days: "7",
    products: [],
  };
}

function StageProductsEditor({
  products,
  onChange,
}: {
  products: StageProductDraft[];
  onChange: (products: StageProductDraft[]) => void;
}) {
  const { data: catalogData, isLoading } = useLocalCatalog();
  const productList = catalogData?.data ?? [];

  const updateProduct = (key: string, patch: Partial<StageProductDraft>) => {
    onChange(products.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeProduct = (key: string) => {
    onChange(products.filter((item) => item.key !== key));
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Produtos da etapa</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange([...products, newStageProductDraft()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando catálogo…</p>
      ) : productList.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Cadastre produtos no catálogo antes de montar a receita desta etapa.
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Nenhum produto nesta etapa. Adicione insumos e doses por hectare.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((item) => {
            const rowProducts = productsForCategory(productList, item.category);
            return (
            <div
              key={item.key}
              className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_120px_88px_auto]"
            >
              <Field label="Categoria">
                <NativeSelect
                  value={item.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value;
                    const patch: Partial<StageProductDraft> = { category: nextCategory };
                    const currentProduct = productList.find((product) => product.id === item.productId);
                    if (
                      item.productId &&
                      currentProduct &&
                      (currentProduct.category ?? "OTHER") !== nextCategory
                    ) {
                      patch.productId = "";
                      patch.productName = "";
                    }
                    updateProduct(item.key, patch);
                  }}
                  className="w-full"
                >
                  <option value="">Selecione…</option>
                  {GLOBAL_PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {PRODUCT_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="min-w-0">
                <Field label="Produto">
                <NativeSelect
                  value={item.productId}
                  onChange={(e) => {
                    const selected = rowProducts.find((product) => product.id === e.target.value);
                    updateProduct(item.key, {
                      productId: e.target.value,
                      productName: selected?.name ?? "",
                      unit: selected?.dose_unit ?? item.unit,
                    });
                  }}
                  disabled={!item.category}
                  className="w-full"
                >
                  <option value="">
                    {item.category ? "Selecione…" : "Escolha a categoria"}
                  </option>
                  {rowProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </NativeSelect>
                </Field>
              </div>
              <Field label="Dose/ha">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.dose}
                  onChange={(e) => updateProduct(item.key, { dose: e.target.value })}
                  placeholder="0"
                />
              </Field>
              <Field label="Un.">
                <DoseUnitSelect
                  value={item.unit}
                  onChange={(unit) => updateProduct(item.key, { unit })}
                  className="w-full"
                />
              </Field>
              <div className="flex items-end justify-end sm:pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label="Remover produto"
                  onClick={() => removeProduct(item.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export function TimingStagesEditor({
  stages,
  onChange,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  isAdding = false,
  minStages = 1,
  showProducts = false,
  className,
}: {
  stages: TimingStageField[];
  onChange: (key: string, patch: Partial<TimingStageField>) => void;
  onAdd: (presetName?: string) => void;
  onRemove: (key: string) => void;
  onMoveUp?: (key: string) => void;
  onMoveDown?: (key: string) => void;
  isAdding?: boolean;
  minStages?: number;
  showProducts?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Etapas de aplicação</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Defina a ordem e as janelas de cada aplicação. Dessecação entra como estágio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isAdding}
          onClick={() => onAdd()}
        >
          <Plus className="h-4 w-4" />
          {isAdding ? "Adicionando…" : "Adicionar etapa"}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TIMING_STAGE_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isAdding}
            onClick={() => onAdd(preset)}
          >
            + {preset}
          </Button>
        ))}
      </div>

      {stages.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma etapa cadastrada. Use os atalhos acima ou adicione a primeira etapa.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((stage, index) => (
            <div key={stage.key} className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {onMoveUp && onMoveDown ? (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => onMoveUp(stage.key)}
                        disabled={index === 0}
                        aria-label="Mover para cima"
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDown(stage.key)}
                        disabled={index === stages.length - 1}
                        aria-label="Mover para baixo"
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Etapa {index + 1}
                  </span>
                </div>
                {stages.length > minStages ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => onRemove(stage.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input
                    value={stage.name}
                    onChange={(e) => onChange(stage.key, { name: e.target.value })}
                    placeholder="Ex: 1ª Fungicida"
                  />
                </Field>
                <Field label="Gatilho">
                  <NativeSelect
                    value={stage.trigger_type}
                    onChange={(e) => onChange(stage.key, { trigger_type: e.target.value })}
                  >
                    {Object.entries(TIMING_TRIGGER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Início (dias)">
                  <Input
                    type="number"
                    value={stage.window_start_days}
                    onChange={(e) => onChange(stage.key, { window_start_days: e.target.value })}
                  />
                </Field>
                <Field label="Fim (dias)">
                  <Input
                    type="number"
                    value={stage.window_end_days}
                    onChange={(e) => onChange(stage.key, { window_end_days: e.target.value })}
                  />
                </Field>
              </div>
              {showProducts ? (
                <StageProductsEditor
                  products={stage.products}
                  onChange={(products) => onChange(stage.key, { products })}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
