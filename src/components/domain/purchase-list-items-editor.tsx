"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, DollarSign, Plus, Sprout, Trash2 } from "lucide-react";
import { useCurrencyStore, DEFAULT_GRAIN_PRICE_BRL } from "@/stores/currency";
import { useLiveFxRate } from "@/hooks/use-live-fx-rate";
import { toast } from "sonner";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SearchableSelect } from "@/components/ui/select";
import {
  useCloneGlobalProduct,
  useCreateLocalProduct,
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
import {
  Field,
  fmt,
  fmtArea,
  areaFromBags,
  isSeedItem,
  listItemQuantity,
  populationFromSeeds,
  seedQuantityUnitLabel,
  DEFAULT_SPACING_M,
  SEED_CATEGORIES,
  type ListItem,
} from "@/components/domain/season/_shared";

const DEFAULT_ITEM_STAGE = "Outra";
/** Ciclo padrão da semente (dias) — soja gira em ~110 dias. */
const DEFAULT_CYCLE_DAYS = "110";

type PurchaseListItemsEditorProps = {
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  /** Cultura(s) da lista — "ANY" = soja e milho. Filtra as categorias de semente. */
  crop?: PurchaseListCrop | "ANY" | null;
  /** Estoque do produtor por produto (local_product_id → quantidade) — auto-preenche. */
  stockByProductId?: Record<string, number>;
  className?: string;
  readOnly?: boolean;
};

function toProductOptionValue(item: ListItem): string {
  return item.productId;
}

function seedQuantityUnitAbbrev(category: string): string {
  return seedQuantityUnitLabel(category).toLowerCase().startsWith("s") ? "S" : "B";
}

export function PurchaseListItemsEditor({
  items,
  setItems,
  totalHa,
  crop,
  stockByProductId,
  className,
  readOnly = false,
}: PurchaseListItemsEditorProps) {
  const platformCatalog = usePlatformCatalog();
  const globalCatalog = useGlobalCatalog();
  const cloneGlobal = useCloneGlobalProduct();
  const createLocal = useCreateLocalProduct();
  const [resolvingProductKey, setResolvingProductKey] = useState<string | null>(null);

  const defaultUnitForCategory = (category: string): string => {
    if (category === "CULTIVAR_SOJA") return "BAG";
    if (category === "HIBRIDO_MILHO") return "SACA";
    if (category === "FERTILIZER") return "T_HA";
    return "DOSE";
  };

  // Cultura(s) da lista: "ANY" = soja e milho. Define quais categorias de
  // semente aparecem no seletor (a antiga "Variedade/Híbrido" foi removida).
  const selectedCrops: PurchaseListCrop[] =
    crop === "ANY"
      ? ["SOYBEAN", "CORN"]
      : crop === "SOYBEAN" || crop === "CORN"
        ? [crop]
        : [];
  // Categorias de semente disponiveis conforme a(s) cultura(s) selecionada(s).
  const seedCategories = GLOBAL_PRODUCT_CATEGORIES.filter(
    (c) =>
      (c === "CULTIVAR_SOJA" && selectedCrops.includes("SOYBEAN")) ||
      (c === "HIBRIDO_MILHO" && selectedCrops.includes("CORN")),
  );
  // Demais categorias (defensivos, fertilizante, etc.) — sem sementes.
  const nonSeedCategories = GLOBAL_PRODUCT_CATEGORIES.filter(
    (c) => c !== "SEED" && c !== "CULTIVAR_SOJA" && c !== "HIBRIDO_MILHO",
  );
  // Para o catálogo legado de SEED por cultura; "ANY" não restringe.
  const listCrop: PurchaseListCrop | null = crop === "ANY" ? null : (crop ?? null);

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
        priceUsd: "",
        thousandPlants: "",
        seedingArea: "",
      },
    ]);
  };

  const addSeedItem = () => {
    const category = seedCategories[0];
    if (!category) return;
    setItems((prev) => [
      ...prev,
      {
        key: `i-${Date.now()}-${prev.length}`,
        category,
        productId: "",
        productName: "",
        stage: DEFAULT_ITEM_STAGE,
        dose: "",
        unit: defaultUnitForCategory(category),
        nApps: "1",
        stock: "0",
        price: "",
        priceUsd: "",
        thousandPlants: "",
        seedingArea: "",
        cycleDays: DEFAULT_CYCLE_DAYS,
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<ListItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  // Área derivada (ha), formatada com 2 casas ("" quando não há bags/população).
  const areaString = (bags: number, pop: number, category: string): string => {
    const area = areaFromBags(bags, pop, category);
    return area > 0 ? String(Math.round(area * 100) / 100) : "";
  };

  // Semente/metro é o input. A população (plantas/ha) deriva pelo espaçamento e,
  // como o volume de bags é fixo (manual), a ÁREA PLANTADA recalcula sozinha —
  // igual à planilha: mexeu na semente/metro, a área se ajusta.
  const setSeedsPerMeter = (key: string, value: string) => {
    const item = items.find((i) => i.key === key);
    const pop = populationFromSeeds(Number(value) || 0, spacing);
    updateItem(key, {
      seedsPerMeter: value,
      thousandPlants: pop > 0 ? String(Math.round(pop)) : "",
      seedingArea: areaString(Number(item?.bagsOverride || 0), pop, item?.category ?? ""),
    });
  };

  // Volume de bags/sacos é digitado à mão pelo agrônomo (o produtor diz "faço
  // com 10 bags"). NÃO calcula sozinho — ao informar, a área plantada recalcula.
  const setBags = (key: string, value: string) => {
    const item = items.find((i) => i.key === key);
    const pop = Number(item?.thousandPlants || 0);
    updateItem(key, {
      bagsOverride: value === "" ? undefined : value,
      seedingArea: areaString(Number(value || 0), pop, item?.category ?? ""),
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  // Cotação do dólar (US$ → R$) — global, preenchida manualmente. Converte
  // automaticamente os produtos cotados em dólar para reais.
  const { fxRate, setFxRate, grainPrice, setGrainPrice, spacing: spacingStr, setSpacing } =
    useCurrencyStore();
  const fx = Number(fxRate) || 0;
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;
  const spacing = Number(spacingStr) || DEFAULT_SPACING_M;

  // População das sementes é derivada de semente/metro ÷ espaçamento. Quando o
  // espaçamento (parâmetro único) muda, recalcula a população e — como o volume
  // de bags é fixo — a área plantada de todas as sementes.
  const spacingRef = useRef(spacing);
  useEffect(() => {
    if (spacingRef.current === spacing) return;
    spacingRef.current = spacing;
    if (readOnly) return;
    setItems((prev) =>
      prev.map((it) => {
        if (!(isSeedItem(it) && it.seedsPerMeter)) return it;
        const pop = populationFromSeeds(Number(it.seedsPerMeter) || 0, spacing);
        const area = areaFromBags(Number(it.bagsOverride || 0), pop, it.category);
        return {
          ...it,
          thousandPlants: String(Math.round(pop)),
          seedingArea: area > 0 ? String(Math.round(area * 100) / 100) : "",
        };
      }),
    );
  }, [spacing, readOnly, setItems]);

  // Item 4: traz a cotação real do dólar como valor padrão a cada abertura da
  // lista, mas sem sobrescrever uma edição manual feita nesta tela.
  const liveFx = useLiveFxRate();
  const fxDefaultedRef = useRef(false);
  const fxUserEditedRef = useRef(false);
  useEffect(() => {
    if (readOnly || fxUserEditedRef.current || fxDefaultedRef.current) return;
    if (liveFx.rate != null) {
      fxDefaultedRef.current = true;
      setFxRate(String(liveFx.rate));
    }
  }, [liveFx.rate, readOnly, setFxRate]);

  /** Preço unitário efetivo em R$: usa a conversão do US$ quando houver. */
  const unitBrl = (it: ListItem): number => {
    if (it.priceUsd && fx > 0) return Number(it.priceUsd) * fx;
    return Number(it.price || 0);
  };
  /** Preço unitário efetivo em US$: usa o US$ digitado, ou converte o R$. */
  const unitUsd = (it: ListItem): number => {
    if (it.priceUsd) return Number(it.priceUsd);
    if (it.price && fx > 0) return Number(it.price) / fx;
    return 0;
  };

  const totals = items.reduce(
    (acc, it) => {
      const required = listItemQuantity(it, totalHa);
      const toBuy = Math.max(0, required - Number(it.stock || 0));
      acc.brl += toBuy * unitBrl(it);
      acc.usd += toBuy * unitUsd(it);
      return acc;
    },
    { brl: 0, usd: 0 },
  );

  const handleCategoryChange = (key: string, category: string, previousCategory: string) => {
    const patch: Partial<ListItem> = { category };
    if (category !== previousCategory) {
      patch.productId = "";
      patch.productName = "";
      // Alterna entre campos de dose e campos de semente conforme a categoria.
      if (SEED_CATEGORIES.includes(category)) {
        patch.dose = "";
        patch.nApps = "1";
        // Ciclo (dias) já nasce com o padrão da soja quando vira semente.
        const current = items.find((i) => i.key === key);
        if (!current?.cycleDays) patch.cycleDays = DEFAULT_CYCLE_DAYS;
      } else {
        patch.seedsPerMeter = "";
        patch.cycleDays = "";
        patch.thousandPlants = "";
        patch.seedingArea = "";
      }
      // Unidade padrão por categoria (item editável).
      if (category === "CULTIVAR_SOJA") patch.unit = "BAG";
      else if (category === "HIBRIDO_MILHO") patch.unit = "SACA";
      else if (category === "FERTILIZER") patch.unit = "T_HA";
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

    const category = items.find((i) => i.key === itemKey)?.category;
    // A variedade selecionada puxa a unidade: soja→bag, milho→sacos; fertilizante→t/ha.
    const unitForSelection = (productUnit: string): string => {
      if (category === "CULTIVAR_SOJA") return "BAG";
      if (category === "HIBRIDO_MILHO") return "SACA";
      if (category === "FERTILIZER") return "T_HA";
      return productUnit;
    };

    const stockPatch = (localId: string) =>
      stockByProductId?.[localId] != null
        ? { stock: String(stockByProductId[localId]) }
        : {};

    if (!product.globalId || !product.isGlobalOnly) {
      updateItem(itemKey, {
        productId: product.optionValue,
        productName: product.name,
        unit: unitForSelection(product.dose_unit),
        ...stockPatch(product.optionValue),
      });
      return;
    }

    setResolvingProductKey(itemKey);
    try {
      const cloned = await cloneGlobal.mutateAsync(product.globalId);
      updateItem(itemKey, {
        productId: cloned.id,
        productName: cloned.name ?? product.name,
        unit: unitForSelection(cloned.dose_unit ?? product.dose_unit),
        ...stockPatch(cloned.id),
      });
    } catch {
      toast.error("Não foi possível adicionar o produto da plataforma global.");
    } finally {
      setResolvingProductKey(null);
    }
  };

  // Cadastra um produto inexistente direto pelo texto digitado na busca. Na
  // lista de compra ele entra normalmente, sem marcação de "fora da programação".
  const createProductInline = async (it: ListItem, rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setResolvingProductKey(it.key);
    try {
      const created = await createLocal.mutateAsync({
        name,
        category: it.category || "OTHER",
        dose_unit: defaultUnitForCategory(it.category),
      });
      updateItem(it.key, {
        productId: created.id,
        productName: created.name ?? name,
        unit: defaultUnitForCategory(it.category),
      });
    } catch {
      toast.error("Não foi possível cadastrar o produto.");
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
        creatable={Boolean(it.category)}
        onCreate={(name) => void createProductInline(it, name)}
        size="sm"
        panelMinWidth={360}
        className={cn("w-full", minWidth)}
      />
    );
  };

  const fmtBrl = (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    });

  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });

  // Tabela com rolagem horizontal simples — nenhuma coluna fixa. As colunas de
  // resumo à direita ganham um leve tom "rail" só para agrupá-las visualmente.
  const summaryCellClass =
    "bg-rail/50 px-1.5 py-1.5 text-right text-sm tabular-nums whitespace-nowrap";
  const summaryHeaderClass =
    "bg-rail/50 px-1.5 py-2 text-right leading-tight whitespace-nowrap";

  const renderRow = (it: ListItem) => {
    const seed = isSeedItem(it);
    const required = listItemQuantity(it, totalHa);
    const toBuy = Math.max(0, required - Number(it.stock || 0));
    const rowUnitBrl = unitBrl(it);
    const rowUnitUsd = unitUsd(it);
    const totalValue = toBuy * rowUnitBrl;
    const totalValueUsd = toBuy * rowUnitUsd;
    const hasPrice = Boolean(it.price || it.priceUsd);
    const usdDriven = Boolean(it.priceUsd) && fx > 0;
    const exceedsStock = Number(it.stock || 0) > 0 && toBuy > 0;
    const catLabel =
      PRODUCT_CATEGORY_LABELS[it.category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
      it.category ??
      "—";
    const categoryTint =
      it.category === "CULTIVAR_SOJA"
        ? "rounded-lg bg-primary/10"
        : it.category === "HIBRIDO_MILHO"
          ? "rounded-lg bg-amber-100/70"
          : "";
    const rowProducts = readOnly
      ? []
      : productsForPurchaseListCategory(
          products,
          it.category,
          toProductOptionValue(it),
          it.productName,
          listCrop,
        );

    return (
      <tr key={it.key} className="align-middle">
        <td className="px-1.5 py-1.5">
          {readOnly ? (
            <span className="text-sm text-muted-foreground">{catLabel}</span>
          ) : (
            <Select
              value={it.category}
              onValueChange={(category) =>
                handleCategoryChange(it.key, category, it.category)
              }
              placeholder="Selecione…"
              filterLabel="Categoria"
              size="sm"
              options={(seed ? seedCategories : nonSeedCategories).map((category) => ({
                value: category,
                label: PRODUCT_CATEGORY_LABELS[category],
              }))}
              panelMinWidth={260}
              className={cn("min-w-0 max-w-none", categoryTint)}
            />
          )}
        </td>
        <td className="px-1.5 py-1.5">
          {readOnly ? (
            <span className="block truncate text-sm font-medium text-foreground">
              {it.productName || "—"}
            </span>
          ) : (
            renderProductField(it, rowProducts, "min-w-0")
          )}
        </td>
        {seed ? (
          <>
            {/* Semente/metro */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmt(Number(it.seedsPerMeter || 0))}
                </span>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  value={it.seedsPerMeter ?? ""}
                  onChange={(e) => setSeedsPerMeter(it.key, e.target.value)}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* Ciclo (dias) */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {it.cycleDays ? it.cycleDays : "—"}
                </span>
              ) : (
                <Input
                  type="number"
                  step="1"
                  placeholder="dias"
                  value={it.cycleDays ?? ""}
                  onChange={(e) => updateItem(it.key, { cycleDays: e.target.value })}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* População final — derivada de semente/metro ÷ espaçamento */}
            <td className="px-1.5 py-1.5 text-right">
              <span
                className="text-sm tabular-nums text-muted-foreground"
                title="População final = semente/metro × 10.000 ÷ espaçamento"
              >
                {Number(it.thousandPlants || 0) > 0
                  ? fmt(Number(it.thousandPlants || 0))
                  : "—"}
              </span>
            </td>
            {/* Volume BAG's — digitado à mão (não calcula sozinho) */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {`${fmt(required)} ${seedQuantityUnitAbbrev(it.category)}`}
                </span>
              ) : (
                <Input
                  type="number"
                  step="0.0001"
                  placeholder={seedQuantityUnitAbbrev(it.category)}
                  value={it.bagsOverride ?? ""}
                  onChange={(e) => setBags(it.key, e.target.value)}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* Área plantado (ha) — derivada dos bags ÷ população */}
            <td className="px-1.5 py-1.5 text-right">
              <span
                className="text-sm tabular-nums text-muted-foreground"
                title="Área plantada = volume de bags × sementes/unidade ÷ população"
              >
                {Number(it.seedingArea || 0) > 0
                  ? fmtArea(Number(it.seedingArea || 0))
                  : "—"}
              </span>
            </td>
          </>
        ) : (
          <>
            {/* Dose */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmt(Number(it.dose || 0))}
                </span>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  value={it.dose}
                  onChange={(e) => updateItem(it.key, { dose: e.target.value })}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* Unidade */}
            <td className="px-1.5 py-1.5">
              {readOnly ? (
                <span className="text-sm text-muted-foreground">{it.unit}</span>
              ) : (
                <DoseUnitSelect
                  value={it.unit}
                  onChange={(val) => updateItem(it.key, { unit: val })}
                  className="w-full min-w-0"
                />
              )}
            </td>
            {/* Nº aplicações */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">{`${it.nApps}×`}</span>
              ) : (
                <Input
                  type="number"
                  value={it.nApps}
                  onChange={(e) => updateItem(it.key, { nApps: e.target.value })}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
          </>
        )}
        <td className="px-1.5 py-1.5 text-right">
          {readOnly ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {fmt(Number(it.stock || 0))}
            </span>
          ) : (
            <Input
              type="number"
              step="0.01"
              value={it.stock}
              onChange={(e) => updateItem(it.key, { stock: e.target.value })}
              className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
            />
          )}
        </td>
        <td className="px-1.5 py-1.5 text-right">
          {readOnly ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {it.priceUsd ? fmtUsd(Number(it.priceUsd)) : "—"}
            </span>
          ) : (
            <Input
              type="number"
              step="0.01"
              placeholder="US$"
              value={it.priceUsd}
              onChange={(e) => updateItem(it.key, { priceUsd: e.target.value })}
              className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
            />
          )}
        </td>
        <td className="px-1.5 py-1.5 text-right">
          {readOnly ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {hasPrice ? fmtBrl(rowUnitBrl) : "—"}
            </span>
          ) : usdDriven ? (
            <span
              title="Convertido automaticamente do US$ pela cotação"
              className="inline-block text-sm tabular-nums text-muted-foreground"
            >
              {fmtBrl(rowUnitBrl)}
            </span>
          ) : (
            <Input
              type="number"
              step="0.01"
              placeholder="R$"
              value={it.price}
              onChange={(e) => updateItem(it.key, { price: e.target.value })}
              className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
            />
          )}
        </td>
        <td className={cn(summaryCellClass, "text-muted-foreground")}>
          {fmt(required)}
        </td>
        <td
          className={cn(
            summaryCellClass,
            "font-semibold",
            exceedsStock ? "text-amber-700" : "text-foreground",
          )}
        >
          <span className="inline-flex items-center justify-end gap-1">
            {exceedsStock ? <AlertTriangle className="h-3 w-3" /> : null}
            {fmt(toBuy)}
          </span>
        </td>
        <td className={cn(summaryCellClass, "font-medium text-foreground")}>
          {hasPrice ? fmtBrl(totalValue) : "—"}
        </td>
        <td className={cn(summaryCellClass, "text-muted-foreground")}>
          {hasPrice && rowUnitUsd > 0 ? fmtUsd(totalValueUsd) : "—"}
        </td>
        {!readOnly ? (
          <td className={cn(summaryCellClass, "text-center")}>
            <button
              type="button"
              onClick={() => removeItem(it.key)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        ) : null}
      </tr>
    );
  };

  // Cabeçalho das colunas compartilhadas (à direita) — igual para sementes e
  // defensivos. As de resumo (Necessário → Total US$) ganham o tom "rail".
  const sharedHeaderCells = (
    <>
      <td className="px-1.5 py-2 text-right">Estoque</td>
      <td className="px-1.5 py-2 text-right">Preço US$</td>
      <td className="px-1.5 py-2 text-right">Valor</td>
      <td className={summaryHeaderClass}>Necessário</td>
      <td className={summaryHeaderClass}>Qtde final</td>
      <td className={summaryHeaderClass}>Total</td>
      <td className={summaryHeaderClass}>Total US$</td>
      {!readOnly ? <td className={summaryHeaderClass} /> : null}
    </>
  );

  // Cada banda (sementes / defensivos) vira sua própria tabela com rolagem
  // horizontal simples, pois têm conjuntos de colunas diferentes.
  const renderBandTable = (band: {
    id: string;
    title: string;
    seed: boolean;
    items: ListItem[];
  }) => {
    const seedBand = band.seed;
    const colCount = seedBand ? (readOnly ? 14 : 15) : readOnly ? 12 : 13;
    const tableWidth = seedBand
      ? readOnly
        ? "w-[1752px]"
        : "w-[1796px]"
      : readOnly
        ? "w-[1580px]"
        : "w-[1624px]";
    return (
      <div
        key={band.id}
        className="overflow-x-auto rounded-xl border bg-card shadow-sm"
      >
        <table className={cn("table-fixed text-sm", tableWidth)}>
          <colgroup>
            {seedBand ? (
              <>
                <col className="w-[144px]" />
                <col className="w-[240px]" />
                <col className="w-[112px]" />
                <col className="w-[88px]" />
                <col className="w-[112px]" />
                <col className="w-[128px]" />
                <col className="w-[112px]" />
                <col className="w-[104px]" />
                <col className="w-[120px]" />
                <col className="w-[128px]" />
                <col className="w-[104px]" />
                <col className="w-[104px]" />
                <col className="w-[128px]" />
                <col className="w-[128px]" />
                {!readOnly ? <col className="w-[44px]" /> : null}
              </>
            ) : (
              <>
                <col className="w-[144px]" />
                <col className="w-[260px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[104px]" />
                <col className="w-[120px]" />
                <col className="w-[128px]" />
                <col className="w-[104px]" />
                <col className="w-[104px]" />
                <col className="w-[128px]" />
                <col className="w-[128px]" />
                {!readOnly ? <col className="w-[44px]" /> : null}
              </>
            )}
          </colgroup>
          <tbody className="divide-y">
            <tr className={seedBand ? "bg-primary/10" : "bg-rail"}>
              <td
                colSpan={colCount}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
                  seedBand ? "text-primary-strong" : "text-muted-foreground",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-sm",
                      seedBand ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                  />
                  {band.title} · {band.items.length}{" "}
                  {band.items.length === 1 ? "item" : "itens"}
                </span>
              </td>
            </tr>
            <tr className="bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <td className="px-1.5 py-2 text-left">
                {seedBand ? "Categoria" : "Classe"}
              </td>
              <td className="px-1.5 py-2 text-left">
                {seedBand ? "Variedades" : "Produto"}
              </td>
              {seedBand ? (
                <>
                  <td className="px-1.5 py-2 text-right leading-tight">Semente/metro</td>
                  <td className="px-1.5 py-2 text-right leading-tight">Ciclo</td>
                  <td className="px-1.5 py-2 text-right leading-tight">População final</td>
                  <td className="px-1.5 py-2 text-right leading-tight">Volume BAG&apos;s</td>
                  <td className="px-1.5 py-2 text-right leading-tight">Área plantado</td>
                </>
              ) : (
                <>
                  <td className="px-1.5 py-2 text-right leading-tight">Dose</td>
                  <td className="px-1.5 py-2 text-right leading-tight">Un.</td>
                  <td className="px-1.5 py-2 text-right leading-tight">Nº apl.</td>
                </>
              )}
              {sharedHeaderCells}
            </tr>
            {band.items.map((it) => renderRow(it))}
          </tbody>
        </table>
      </div>
    );
  };

  const bands = [
    {
      id: "seed",
      title: "Sementes · variedades e híbridos",
      seed: true,
      items: items.filter((it) => isSeedItem(it)),
    },
    {
      id: "dose",
      title: "Defensivos e fertilizantes",
      seed: false,
      items: items.filter((it) => !isSeedItem(it)),
    },
  ].filter((b) => b.items.length > 0);

  // Item 14: avisa quando o volume recomendado ultrapassa o estoque disponível.
  const stockWarnings = items
    .map((it) => {
      const required = listItemQuantity(it, totalHa);
      const stock = Number(it.stock || 0);
      const excess = required - stock;
      if (stock <= 0 || excess <= 0) return null;
      const unit = isSeedItem(it) ? seedQuantityUnitLabel(it.category) : it.unit;
      return { key: it.key, name: it.productName || "Produto", excess, unit };
    })
    .filter((w): w is { key: string; name: string; excess: number; unit: string } => w !== null);

  const useStickyActions = !readOnly && items.length > 3;

  return (
    <div className={cn("flex min-w-0 w-full flex-col", className)}>
      {/* Cotação do dólar — conversão automática US$ → R$ na lista de compra */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <DollarSign className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cotação do dólar
            </span>
            <span className="text-[11px] text-muted-foreground">
              converte produtos cotados em US$ para R$
            </span>
          </div>
          {readOnly ? (
            <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
              {fx > 0 ? fmtBrl(fx) : "—"}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className="text-sm text-muted-foreground">US$ 1 =</span>
              <Input
                type="number"
                step="0.0001"
                placeholder="5,50"
                value={fxRate}
                onChange={(e) => {
                  fxUserEditedRef.current = true;
                  setFxRate(e.target.value);
                }}
                className="h-8 w-24"
              />
            </div>
          )}
        </div>
        {/* Preço da saca (R$) — ao lado do dólar, default 110. Converte o custo em sacas. */}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <Sprout className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Preço da saca
            </span>
            <span className="text-[11px] text-muted-foreground">
              converte o custo em sacas
            </span>
          </div>
          {readOnly ? (
            <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
              {fmtBrl(saca)}
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="110,00"
                value={grainPrice}
                onChange={(e) => setGrainPrice(e.target.value)}
                className="h-8 w-24"
              />
            </div>
          )}
        </div>
        {/* Espaçamento entre linhas (m) — parâmetro único; deriva a população da semente. */}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <Sprout className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Espaçamento
            </span>
            <span className="text-[11px] text-muted-foreground">
              deriva a população da semente
            </span>
          </div>
          {readOnly ? (
            <span className="ml-2 self-end text-sm font-semibold tabular-nums text-foreground">
              {fmt(spacing)} m
            </span>
          ) : (
            <div className="ml-2 flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                placeholder="0,65"
                value={spacingStr}
                onChange={(e) => setSpacing(e.target.value)}
                className="h-8 w-20"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total R$
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {fmtBrl(totals.brl)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total US$
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {totals.usd > 0 ? fmtUsd(totals.usd) : "—"}
            </span>
          </div>
        </div>
      </div>

      {!readOnly && stockWarnings.length > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Volume recomendado acima do estoque
          </div>
          <ul className="mt-1 list-disc pl-6">
            {stockWarnings.map((w) => (
              <li key={w.key}>
                <strong>{w.name}</strong> excede o estoque em {fmt(w.excess)} {w.unit}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="hidden rounded-xl border bg-card px-3 py-10 text-center text-sm text-muted-foreground shadow-sm lg:block">
          Nenhum produto adicionado. Use o botão abaixo para incluir insumos.
        </div>
      ) : (
        <div className="hidden space-y-4 lg:block">{bands.map(renderBandTable)}</div>
      )}

      <div className="mt-6 space-y-3 lg:hidden">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum produto adicionado.
          </div>
        ) : readOnly ? (
          items.map((it) => {
            const seed = isSeedItem(it);
            const required = listItemQuantity(it, totalHa);
            const toBuy = Math.max(0, required - Number(it.stock || 0));
            const rowUnitBrl = unitBrl(it);
            const rowUnitUsd = unitUsd(it);
            const hasPrice = Boolean(it.price || it.priceUsd);
            const totalValue = toBuy * rowUnitBrl;
            const totalValueUsd = toBuy * rowUnitUsd;
            const catLabel =
              PRODUCT_CATEGORY_LABELS[it.category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
              it.category ??
              "—";
            return (
              <div key={it.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {catLabel}
                </p>
                <p className="mt-1 text-base font-medium text-foreground">{it.productName || "—"}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {seed ? "População" : "Dose/ha"}
                    </span>
                    <p className="mt-0.5 tabular-nums">
                      {seed
                        ? `${fmt(Number(it.thousandPlants || 0))} plantas/ha · ${fmtArea(Number(it.seedingArea || 0))} ha`
                        : `${fmt(Number(it.dose || 0))} ${it.unit}/ha · ${it.nApps}×`}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">A comprar</span>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {fmt(toBuy)} {seed ? seedQuantityUnitLabel(it.category) : it.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Preço</span>
                    <p className="mt-0.5 tabular-nums">
                      {it.priceUsd ? `${fmtUsd(Number(it.priceUsd))} · ` : ""}
                      {hasPrice ? fmtBrl(rowUnitBrl) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Valor total</span>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {hasPrice ? fmtBrl(totalValue) : "—"}
                      {hasPrice && rowUnitUsd > 0 ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          · {fmtUsd(totalValueUsd)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          items.map((it) => {
            const rowProducts = productsForPurchaseListCategory(
              products,
              it.category,
              toProductOptionValue(it),
              it.productName,
              listCrop,
            );
            const seed = isSeedItem(it);
            const required = listItemQuantity(it, totalHa);
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
                      options={(seed ? seedCategories : nonSeedCategories).map((category) => ({
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
                  {seed ? (
                    <>
                      <Field
                        label="Semente/metro"
                        hint={
                          Number(it.thousandPlants || 0) > 0
                            ? `${fmt(Number(it.thousandPlants || 0))} pl/ha`
                            : undefined
                        }
                      >
                        <Input
                          type="number"
                          step="0.01"
                          value={it.seedsPerMeter ?? ""}
                          onChange={(e) => setSeedsPerMeter(it.key, e.target.value)}
                        />
                      </Field>
                      <Field label="Ciclo (dias)">
                        <Input
                          type="number"
                          step="1"
                          value={it.cycleDays ?? ""}
                          onChange={(e) => updateItem(it.key, { cycleDays: e.target.value })}
                        />
                      </Field>
                      <Field label={`Volume BAG's (${seedQuantityUnitLabel(it.category)})`}>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder={seedQuantityUnitLabel(it.category)}
                          value={it.bagsOverride ?? ""}
                          onChange={(e) => setBags(it.key, e.target.value)}
                        />
                      </Field>
                      <Field label="Área plantado (ha)" hint="calculada pelos bags">
                        <div className="flex h-9 items-center text-sm tabular-nums text-muted-foreground">
                          {Number(it.seedingArea || 0) > 0
                            ? `${fmtArea(Number(it.seedingArea || 0))} ha`
                            : "—"}
                        </div>
                      </Field>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                  <Field label="Estoque atual">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.stock}
                      onChange={(e) => updateItem(it.key, { stock: e.target.value })}
                    />
                  </Field>
                  <Field label="Preço US$/un.">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="US$"
                      value={it.priceUsd}
                      onChange={(e) => updateItem(it.key, { priceUsd: e.target.value })}
                    />
                  </Field>
                  <Field label="Preço R$/un.">
                    {it.priceUsd && fx > 0 ? (
                      <div className="flex h-9 items-center text-sm tabular-nums text-muted-foreground">
                        {fmtBrl(unitBrl(it))}{" "}
                        <span className="ml-1 text-[10px]">(do US$)</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="R$"
                        value={it.price}
                        onChange={(e) => updateItem(it.key, { price: e.target.value })}
                      />
                    )}
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

      {!readOnly ? (
        // Lista longa (desktop): barra sticky no rodapé do viewport — só em lg+,
        // onde a tabela larga rola dentro do overflow-x-auto sem empurrar a página.
        <div
          className={cn(
            "mt-4 flex w-full max-w-full justify-end",
            useStickyActions && "lg:sticky lg:bottom-3 lg:z-10",
          )}
        >
          <div
            className={cn(
              "flex max-w-full flex-wrap items-center justify-end gap-2",
              useStickyActions &&
                "lg:rounded-full lg:border lg:border-border lg:bg-card/95 lg:px-2 lg:py-1.5 lg:shadow-lg lg:backdrop-blur",
            )}
          >
            {seedCategories.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size={useStickyActions ? "sm" : "default"}
                onClick={addSeedItem}
                className={cn("shrink-0 gap-2", useStickyActions && "lg:rounded-full")}
              >
                <Plus className="h-4 w-4" />
                Adicionar semente
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size={useStickyActions ? "sm" : "default"}
              onClick={addItem}
              className={cn("shrink-0 gap-2", useStickyActions && "lg:rounded-full")}
            >
              <Plus className="h-4 w-4" />
              Adicionar produto
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
