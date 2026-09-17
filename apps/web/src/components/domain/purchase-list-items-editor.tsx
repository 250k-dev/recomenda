"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Plus, Sprout, Trash2 } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency";
import { toast } from "sonner";
import { DoseUnitSelect } from "@/components/domain/dose-unit-select";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import { Select, SearchableSelect } from "@recomenda/ui/forms/select";
import {
  useCloneGlobalProduct,
  useCreateLocalProduct,
  useGlobalCatalog,
  usePlatformCatalog,
} from "@recomenda/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useCan } from "@recomenda/api-hooks/use-can";
import {
  cn,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@recomenda/utils";
import {
  buildPurchaseListCatalog,
  productsForPurchaseListCategory,
  purchaseListProductLabel,
  type PurchaseListCatalogProduct,
  type PurchaseListCrop,
} from "@recomenda/domain/catalog/purchase-list-catalog";
import { Field, fmt, fmtArea } from "@/components/domain/season/_shared";
import { PurchaseListParamsRow } from "@/components/domain/purchase-list-params-row";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { PaginationBar } from "@recomenda/ui/patterns/pagination-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@recomenda/ui/primitives/tooltip";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { removePurchaseListItems } from "@recomenda/api/purchase-lists";
import {
  areaFromBags,
  doseFromCommercialVolume,
  hasVolumeOverride,
  isSeedItem,
  listItemQuantity,
  listItemsToBuyByKey,
  parseNApplications,
  populationFromSeeds,
  seedQuantityUnitLabel,
  treatedHectaresOf,
  DEFAULT_SPACING_M,
  SEED_CATEGORIES,
  type ListItem,
} from "@recomenda/domain/purchase-list/list-item";
import {
  formulationShortLabel,
  resolveFormulationKey,
} from "@recomenda/domain/recommendations/formulation-mix-order";

const DEFAULT_ITEM_STAGE = "Outra";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
/** Em quantos pixels de scroll o fundo da faixa fixa entra por completo. */
const STICK_RAMP_PX = 40;
/** Ciclo padrão da semente (dias) — soja gira em ~110 dias. */
const DEFAULT_CYCLE_DAYS = "110";

type PurchaseListItemsEditorProps = {
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  /** Cultura(s) da lista — "ANY" = soja e milho. Filtra as categorias de semente. */
  crop?: PurchaseListCrop | "ANY" | null;
  /** Estoque do produtor por produto (local_product_id → quantidade) — auto-preenche. */
  stockByProductId?: Record<
    string,
    number | { quantity: number; price_brl: number | null }
  >;
  className?: string;
  readOnly?: boolean;
  /** A linha de parâmetros (dólar, saca, espaçamento) é montada fora — no herói. */
  hideParams?: boolean;
  /** Ação à direita da linha das abas (ex.: "Editar Lista de Compras"). */
  tabsActions?: ReactNode;
  /** Lista persistida: ao remover um produto, consulta recomendações da safra. */
  listId?: string | null;
  /** Marca o próximo PUT para cascatear exclusão nas recomendações pendentes. */
  onRemovalCascadeArmed?: () => void;
};

/** Chave estável e única de item. A antiga (`Date.now()`+índice) colidia ao
 *  remover e re-adicionar no mesmo milissegundo, fazendo `updateItem` editar
 *  dois itens de uma vez. */
let itemKeySeq = 0;
function newItemKey(): string {
  itemKeySeq += 1;
  return `i-${itemKeySeq}-${globalThis.crypto?.randomUUID?.() ?? itemKeySeq}`;
}

function toProductOptionValue(item: ListItem): string {
  return item.productId;
}

function seedQuantityUnitAbbrev(category: string): string {
  return seedQuantityUnitLabel(category).toLowerCase().startsWith("s")
    ? "S"
    : "B";
}

type BandId = "seed" | "dose" | "out";

type Band = {
  id: BandId;
  /** Rótulo da aba que mostra esta tabela. */
  tab: string;
  seed: boolean;
  out?: boolean;
  items: ListItem[];
};

export function PurchaseListItemsEditor({
  items,
  setItems,
  totalHa,
  crop,
  stockByProductId,
  className,
  readOnly = false,
  hideParams = false,
  tabsActions,
  listId,
  onRemovalCascadeArmed,
}: PurchaseListItemsEditorProps) {
  const canViewPrices = useCan("PRICE_VIEW");
  const queryClient = useQueryClient();
  const platformCatalog = usePlatformCatalog();
  const globalCatalog = useGlobalCatalog();
  const cloneGlobal = useCloneGlobalProduct();
  const createLocal = useCreateLocalProduct();
  const [resolvingProductKey, setResolvingProductKey] = useState<string | null>(
    null,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removalBusy, setRemovalBusy] = useState(false);

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
  const listCrop: PurchaseListCrop | null =
    crop === "ANY" ? null : (crop ?? null);

  const products = useMemo(
    () =>
      buildPurchaseListCatalog(
        platformCatalog.data?.data ?? [],
        globalCatalog.data?.data ?? [],
      ),
    [platformCatalog.data?.data, globalCatalog.data?.data],
  );
  // Linha recém-adicionada: depois que ela entra na tela (pode ser em outra
  // aba), a página rola até lá — no fim de uma lista longa, o item novo nasce
  // fora do campo de visão.
  const scrollToKeyRef = useRef<string | null>(null);
  // Itens incluídos nesta edição — ficam em verde claro até sair da edição.
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // Sair da edição (salvando ou cancelando) limpa a seleção e o destaque dos
  // itens novos — senão a próxima edição começa com a marcação da anterior.
  // Ajuste de estado durante a renderização, o padrão do React para "derivar de
  // prop" sem passar por efeito.
  const [wasEditing, setWasEditing] = useState(!readOnly);
  if (wasEditing !== !readOnly) {
    setWasEditing(!readOnly);
    if (readOnly) {
      setSelectedKeys(new Set());
      setAddedKeys(new Set());
    }
  }
  useEffect(() => {
    const key = scrollToKeyRef.current;
    if (!key) return;
    scrollToKeyRef.current = null;
    document
      .querySelector(`[data-item-key="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [items]);

  // Aba da tabela visível no desktop (uma banda por vez). Sem escolha — ou
  // sumiu a banda escolhida, porque removeram os itens dela — cai na primeira
  // da ordem: fora da programação, que pede ação, vem antes das outras.
  const [bandTab, setBandTab] = useState<BandId | null>(null);
  // Paginação da tabela aberta. A página é limitada na renderização, então
  // trocar de aba (ou remover itens) nunca deixa a tela vazia.
  const [page, setPage] = useState(1);
  // O fundo branco da faixa entra conforme o scroll, não por transição de
  // tempo: num scroll rápido de volta ao topo ela some junto com o movimento,
  // em vez de ficar desbotando depois que o dedo já parou.
  const tabsSentinelRef = useRef<HTMLDivElement | null>(null);
  const [tabsStickProgress, setTabsStickProgress] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  /** Item novo entra no fim: a última página é onde ele aparece. */
  const goToLastPage = () => setPage(Number.MAX_SAFE_INTEGER);

  const toBuyByKey = useMemo(
    () => listItemsToBuyByKey(items, totalHa),
    [items, totalHa],
  );

  // Item 14: tem estoque, mas não o bastante — o que falta vira compra. Marca
  // a linha (⚠ na qtde final), a aba e o rodapé da tabela.
  const exceedsStockOf = (it: ListItem) =>
    Number(it.stock || 0) > 0 && (toBuyByKey.get(it.key) ?? 0) > 0;

  const addItem = () => {
    const key = newItemKey();
    setBandTab("dose");
    scrollToKeyRef.current = key;
    goToLastPage();
    setAddedKeys((prev) => new Set(prev).add(key));
    setItems((prev) => [
      ...prev,
      {
        key,
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
    const key = newItemKey();
    setBandTab("seed");
    scrollToKeyRef.current = key;
    goToLastPage();
    setAddedKeys((prev) => new Set(prev).add(key));
    setItems((prev) => [
      ...prev,
      {
        key,
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
    setItems((prev) => {
      const current = prev.find((it) => it.key === key);
      const nextStock = patch.stock;
      if (nextStock !== undefined && current?.productId) {
        const productId = current.productId;
        return prev.map((it) => {
          if (it.key === key) return { ...it, ...patch, stock: nextStock };
          if (it.productId === productId) return { ...it, stock: nextStock };
          return it;
        });
      }
      return prev.map((it) => (it.key === key ? { ...it, ...patch } : it));
    });
  };

  const setDose = (key: string, dose: string) => {
    updateItem(key, { dose, volumeOverride: "" });
  };

  const setVolumeOverride = (key: string, raw: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    const vol = Number(String(raw).replace(",", "."));
    const ha = treatedHectaresOf(item, totalHa);
    const nApps = parseNApplications(item.nApps);
    updateItem(key, {
      volumeOverride: raw,
      dose: doseFromCommercialVolume(vol, ha, nApps) || item.dose,
    });
  };

  const setAreaPercent = (key: string, raw: string) => {
    // % só muda os hectares da linha. A dose de bula fica; o volume recalcula.
    // Se o volume comercial ficasse travado, 10% inflava a dose (ex.: 1,5 → 15).
    updateItem(key, { areaPercent: raw, volumeOverride: "" });
  };

  const setNApps = (key: string, nApps: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) {
      updateItem(key, { nApps });
      return;
    }
    if (hasVolumeOverride(item)) {
      const vol = Number(String(item.volumeOverride).replace(",", "."));
      const ha = treatedHectaresOf(item, totalHa);
      updateItem(key, {
        nApps,
        dose:
          doseFromCommercialVolume(vol, ha, parseNApplications(nApps)) ||
          item.dose,
      });
      return;
    }
    updateItem(key, { nApps, volumeOverride: "" });
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
      seedingArea: areaString(
        Number(item?.bagsOverride || 0),
        pop,
        item?.category ?? "",
      ),
    });
  };

  // Volume de bags/sacos é digitado à mão pelo agrônomo (o produtor diz "faço
  // com 10 bags"). NÃO calcula sozinho — ao informar, a área plantada recalcula.
  // Bag é unidade fechada: só inteiros (decimais digitados/colados são cortados).
  const setBags = (key: string, value: string) => {
    const item = items.find((i) => i.key === key);
    const pop = Number(item?.thousandPlants || 0);
    const whole = value.replace(/[.,].*$/, "").replace(/\D/g, "");
    updateItem(key, {
      bagsOverride: whole === "" ? undefined : whole,
      seedingArea: areaString(Number(whole || 0), pop, item?.category ?? ""),
    });
  };

  const dropItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    setSelectedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeItem = (key: string) => {
    const item = items.find((it) => it.key === key);
    if (!item) return;
    if (!listId || !item.productId) {
      dropItem(key);
      return;
    }
    setSelectedKeys(new Set([key]));
    setConfirmOpen(true);
  };

  const confirmRemoval = () => {
    void (async () => {
      const selected = items.filter((it) => selectedKeys.has(it.key));
      if (selected.length === 0) {
        setConfirmOpen(false);
        return;
      }
      const unsaved = selected.filter((it) => !it.productId);
      if (unsaved.length === selected.length || !listId) {
        setItems((prev) => prev.filter((it) => !selectedKeys.has(it.key)));
        setSelectedKeys(new Set());
        setConfirmOpen(false);
        return;
      }
      setRemovalBusy(true);
      try {
        const payload = selected
          .filter((it) => it.productId)
          .map((it) => ({
            local_product_id: it.productId,
            stage: it.stage || DEFAULT_ITEM_STAGE,
          }));
        const res = await removePurchaseListItems(listId, payload);
        const removedKeys = new Set(
          selected
            .filter((it) =>
              res.removed.some(
                (r) =>
                  r.local_product_id === it.productId &&
                  r.stage === (it.stage || DEFAULT_ITEM_STAGE),
              ),
            )
            .map((it) => it.key),
        );
        for (const it of unsaved) removedKeys.add(it.key);
        setItems((prev) => prev.filter((it) => !removedKeys.has(it.key)));
        setSelectedKeys(new Set());
        onRemovalCascadeArmed?.();
        if (res.removed.length > 0) {
          toast.success(
            `${res.removed.length} ${res.removed.length === 1 ? "item removido" : "itens removidos"} da lista.`,
          );
          void queryClient.invalidateQueries({
            queryKey: ["cycle-purchase-list"],
          });
          void queryClient.invalidateQueries({ queryKey: ["cycle-cost-plan"] });
        }
        if (res.blocked.length > 0) {
          toast.error(
            `${res.blocked.map((b) => b.product_name).join(", ")} ${res.blocked.length === 1 ? "não saiu" : "não saíram"}: compra confirmada ou já aplicado.`,
          );
        }
      } catch {
        toast.error("Não foi possível remover os produtos.");
      } finally {
        setRemovalBusy(false);
        setConfirmOpen(false);
      }
    })();
  };

  // Cotação do dólar (US$ → R$) — global, preenchida manualmente. Converte
  // automaticamente os produtos cotados em dólar para reais.
  const { fxRate, spacing: spacingStr } = useCurrencyStore();
  const fx = Number(fxRate) || 0;
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
        const area = areaFromBags(
          Number(it.bagsOverride || 0),
          pop,
          it.category,
        );
        return {
          ...it,
          thousandPlants: String(Math.round(pop)),
          seedingArea: area > 0 ? String(Math.round(area * 100) / 100) : "",
        };
      }),
    );
  }, [spacing, readOnly, setItems]);

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

  const handleCategoryChange = (
    key: string,
    category: string,
    previousCategory: string,
  ) => {
    const patch: Partial<ListItem> = { category };
    if (category !== previousCategory) {
      patch.productId = "";
      patch.productName = "";
      patch.equivalenceGroup = null;
      // Alterna entre campos de dose e campos de semente conforme a categoria.
      if (SEED_CATEGORIES.includes(category)) {
        patch.dose = "";
        patch.nApps = "1";
        patch.volumeOverride = "";
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
    const product = rowProducts.find(
      (entry) => entry.optionValue === optionValue,
    );
    if (!product) return;

    const current = items.find((i) => i.key === itemKey);
    const stage = current?.stage || DEFAULT_ITEM_STAGE;
    const alreadyOnStage = items.some(
      (i) =>
        i.key !== itemKey &&
        Boolean(i.productId) &&
        i.productId === product.optionValue &&
        (i.stage || DEFAULT_ITEM_STAGE) === stage,
    );
    if (alreadyOnStage) {
      toast.error(
        "Este produto já está nesta etapa. Não é possível duplicar a linha.",
      );
      return;
    }

    const category = items.find((i) => i.key === itemKey)?.category;
    // A variedade selecionada puxa a unidade: soja→bag, milho→sacos; fertilizante→t/ha.
    const unitForSelection = (productUnit: string): string => {
      if (category === "CULTIVAR_SOJA") return "BAG";
      if (category === "HIBRIDO_MILHO") return "SACA";
      if (category === "FERTILIZER") return "T_HA";
      return productUnit;
    };

    const stockPatch = (localId: string) => {
      const entry = stockByProductId?.[localId];
      if (entry == null) return {};
      if (typeof entry === "number") {
        return { stock: String(entry) };
      }
      return {
        stock: String(entry.quantity),
        ...(entry.price_brl != null ? { price: String(entry.price_brl) } : {}),
      };
    };

    if (!product.globalId || !product.isGlobalOnly) {
      updateItem(itemKey, {
        productId: product.optionValue,
        productName: product.name,
        equivalenceGroup: product.equivalence_group ?? null,
        unit: unitForSelection(product.dose_unit),
        ...stockPatch(product.optionValue),
      });
      return;
    }

    setResolvingProductKey(itemKey);
    try {
      const cloned = await cloneGlobal.mutateAsync(product.globalId);
      const clonedDup = items.some(
        (i) =>
          i.key !== itemKey &&
          i.productId === cloned.id &&
          (i.stage || DEFAULT_ITEM_STAGE) === stage,
      );
      if (clonedDup) {
        toast.error(
          "Este produto já está nesta etapa. Não é possível duplicar a linha.",
        );
        return;
      }
      updateItem(itemKey, {
        productId: cloned.id,
        productName: cloned.name ?? product.name,
        equivalenceGroup:
          (cloned as { equivalence_group?: string | null }).equivalence_group ??
          product.equivalence_group ??
          null,
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

  const renderRow = (it: ListItem, rowIndex: number) => {
    const seed = isSeedItem(it);
    const required = listItemQuantity(it, totalHa);
    const toBuy = toBuyByKey.get(it.key) ?? 0;
    const rowUnitBrl = unitBrl(it);
    const rowUnitUsd = unitUsd(it);
    const totalValue = toBuy * rowUnitBrl;
    const totalValueUsd = toBuy * rowUnitUsd;
    const hasPrice = Boolean(it.price || it.priceUsd);
    const usdDriven = Boolean(it.priceUsd) && fx > 0;
    // Tem estoque, mas não o bastante: a quantidade da coluna é só o que falta
    // comprar, e o ⚠ explica a conta no tooltip.
    const stockQty = Number(it.stock || 0);
    const exceedsStock = exceedsStockOf(it);
    const qtyUnit = seed ? seedQuantityUnitLabel(it.category) : it.unit;
    const isNew = !readOnly && addedKeys.has(it.key);
    const catLabel =
      PRODUCT_CATEGORY_LABELS[
        it.category as keyof typeof PRODUCT_CATEGORY_LABELS
      ] ??
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
      <tr
        key={it.key}
        data-item-key={it.key}
        className={cn(
          // 52px: a altura da linha em edição — select h-9 (38px, porque o
          // html deste app usa font-size 17px e o rem escala junto) + o py-1.5
          // das células + a borda. A altura vai nas CÉLULAS, onde o navegador a
          // trata como mínimo; em <tr> ela nem sempre pega.
          "align-middle [&>td]:h-[52px]",
          // Zebra: branco e um tom acima, para o olho não pular de linha.
          rowIndex % 2 === 0 ? "bg-card" : "bg-surface-2",
          // `[&>td]` apaga o tom "rail" das colunas de resumo, para o verde
          // valer na linha inteira.
          isNew && "bg-primary-soft [&>td]:bg-transparent",
          selectedKeys.has(it.key) && "bg-primary/10 [&>td]:bg-transparent",
          !readOnly && "cursor-pointer",
        )}
        onClick={
          readOnly
            ? undefined
            : (event) => {
                // Clicar na linha marca/desmarca o item, menos quando o clique
                // caiu num controle da própria linha (input, select, botão…) —
                // aí quem manda é o controle.
                if (
                  (event.target as HTMLElement).closest(
                    "input, select, textarea, button, a, label, [role='combobox'], [contenteditable='true']",
                  )
                ) {
                  return;
                }
                toggleSelected(it.key);
              }
        }
      >
        <td className="px-1.5 py-1.5 text-center">
          {readOnly ? null : (
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selectedKeys.has(it.key)}
              onChange={() => toggleSelected(it.key)}
              aria-label="Selecionar para excluir"
            />
          )}
        </td>
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
              options={(seed ? seedCategories : nonSeedCategories).map(
                (category) => ({
                  value: category,
                  label: PRODUCT_CATEGORY_LABELS[category],
                }),
              )}
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
        {!seed ? (
          <td className="px-1.5 py-1.5 text-center">
            <span
              className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-md border border-border bg-surface-2 px-1.5 text-[10px] font-bold tracking-wide text-muted-foreground"
              title={it.equivalenceGroup ?? undefined}
            >
              {formulationShortLabel(
                resolveFormulationKey(it.equivalenceGroup),
              )}
            </span>
          </td>
        ) : null}
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
                  onChange={(e) =>
                    updateItem(it.key, { cycleDays: e.target.value })
                  }
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
                  step="1"
                  min="0"
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
                  onChange={(e) => setDose(it.key, e.target.value)}
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
                  size="sm"
                  className="w-full min-w-0"
                />
              )}
            </td>
            {/* Nº aplicações — só inteiros ≥ 1 */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">{`${it.nApps}×`}</span>
              ) : (
                <Input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  value={it.nApps}
                  onChange={(e) => {
                    const whole = e.target.value
                      .replace(/[.,].*$/, "")
                      .replace(/\D/g, "");
                    setNApps(it.key, whole === "" ? "" : whole);
                  }}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* Volume — editável; se mexer, recalcula a dose (ha/% ficam) */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmt(required)}
                </span>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    it.volumeOverride !== undefined && it.volumeOverride !== ""
                      ? it.volumeOverride
                      : required > 0
                        ? String(Number(required.toFixed(4)))
                        : ""
                  }
                  onChange={(e) => setVolumeOverride(it.key, e.target.value)}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* % da área — hectares da linha = % × área da lista */}
            <td className="px-1.5 py-1.5 text-right">
              {readOnly ? (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {it.areaPercent || "100"}
                </span>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={it.areaPercent ?? ""}
                  onChange={(e) => setAreaPercent(it.key, e.target.value)}
                  className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
                />
              )}
            </td>
            {/* Observação de área — informativa, aparece no PDF do produtor. */}
            <td className="px-1.5 py-1.5">
              {readOnly ? (
                <span className="block truncate text-sm text-muted-foreground">
                  {it.areaNote || "—"}
                </span>
              ) : (
                <Input
                  value={it.areaNote ?? ""}
                  placeholder="Ex: áreas sujas"
                  onChange={(e) =>
                    updateItem(it.key, { areaNote: e.target.value })
                  }
                  className="h-8 w-full min-w-0 px-2 text-sm"
                />
              )}
            </td>
          </>
        )}
        <td className="px-1.5 py-1.5 text-right">
          {readOnly ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {Number(it.stock || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          ) : (
            // pt-BR: aceita "1.410,5". `type="number"` leria o ponto de milhar
            // como decimal e viraria 1,41.
            <MoneyInput
              value={it.stock}
              onValueChange={(v) => updateItem(it.key, { stock: v })}
              decimals={2}
              grouping={false}
              className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
            />
          )}
        </td>
        {canViewPrices ? (
          <td className="px-1.5 py-1.5 text-right">
            {readOnly ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                {it.priceUsd ? fmtUsd(Number(it.priceUsd)) : "—"}
              </span>
            ) : (
              <MoneyInput
                placeholder="US$"
                value={it.priceUsd}
                onValueChange={(v) => updateItem(it.key, { priceUsd: v })}
                className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
              />
            )}
          </td>
        ) : null}
        {canViewPrices ? (
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
              <MoneyInput
                placeholder="R$"
                value={it.price}
                onValueChange={(v) => updateItem(it.key, { price: v })}
                className="h-8 w-full min-w-0 px-2 text-right text-sm tabular-nums"
              />
            )}
          </td>
        ) : null}
        <td
          className={cn(
            summaryCellClass,
            "font-semibold",
            exceedsStock ? "text-amber-700" : "text-foreground",
          )}
        >
          {exceedsStock ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help items-center justify-end gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {fmt(toBuy)}
                </span>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={6}
                className="max-w-xs whitespace-normal text-left leading-relaxed"
              >
                Necessário {fmt(required)} · estoque {fmt(stockQty)} · comprar{" "}
                {fmt(toBuy)} {qtyUnit}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="inline-flex items-center justify-end gap-1">
              {fmt(toBuy)}
            </span>
          )}
        </td>
        {canViewPrices ? (
          <td className={cn(summaryCellClass, "font-medium text-foreground")}>
            {hasPrice ? fmtBrl(totalValue) : "—"}
          </td>
        ) : null}
        {canViewPrices ? (
          <td className={cn(summaryCellClass, "text-muted-foreground")}>
            {hasPrice && rowUnitUsd > 0 ? fmtUsd(totalValueUsd) : "—"}
          </td>
        ) : null}
        <td className={summaryCellClass} />
      </tr>
    );
  };

  // Cabeçalho das colunas compartilhadas (à direita) — igual para sementes e
  // defensivos. As de resumo (Necessário → Total US$) ganham o tom "rail".
  const sharedHeaderCells = (
    <>
      <td className="px-1.5 py-2 text-right">Estoque disponível</td>
      {canViewPrices ? (
        <td className="px-1.5 py-2 text-right">Preço US$</td>
      ) : null}
      {canViewPrices ? <td className="px-1.5 py-2 text-right">Valor</td> : null}
      <td className={summaryHeaderClass}>Qtde final</td>
      {canViewPrices ? <td className={summaryHeaderClass}>Total</td> : null}
      {canViewPrices ? <td className={summaryHeaderClass}>Total US$</td> : null}
      {/* Espaçador: o mesmo recuo da coluna do checkbox, do outro lado. */}
      <td className={summaryHeaderClass} />
    </>
  );

  // Cada banda (sementes / defensivos) vira sua própria tabela com rolagem
  // horizontal simples, pois têm conjuntos de colunas diferentes.
  const renderBandTable = (band: Band) => {
    const seedBand = band.seed;
    // Colunas de resumo à direita (as do `sharedHeaderCells`) — o rodapé usa a
    // conta para saber quanto a célula do rótulo precisa cobrir à esquerda.
    // +1: a coluna-espaçador da direita.
    const summaryColCount = 3 + (canViewPrices ? 4 : 0);
    const bandTotals = band.items.reduce(
      (acc, it) => {
        const toBuy = toBuyByKey.get(it.key) ?? 0;
        acc.qty += toBuy;
        acc.brl += toBuy * unitBrl(it);
        acc.usd += toBuy * unitUsd(it);
        return acc;
      },
      { qty: 0, brl: 0, usd: 0 },
    );
    const bandOverStock = band.items.filter(exceedsStockOf).length;
    const pageItems = band.items.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize,
    );
    const seedArea = seedBand
      ? band.items.reduce((acc, it) => acc + (Number(it.seedingArea) || 0), 0)
      : 0;
    // Culturas que passaram dos hectares da safra — marcam o total no rodapé.
    const seedAreaAlerts = seedBand
      ? seedAreaRows(band.items).filter((row) => row.over)
      : [];
    // Defensivos: Form. + Dose/Un/Nº + % área + obs. Sem PRICE_VIEW, −4 cols de preço.
    const priceCols = canViewPrices ? 4 : 0;
    const colCount = (seedBand ? 15 : 17) - (4 - priceCols);
    // Soma das colunas: largura mínima (abaixo dela, rola na horizontal). Acima,
    // a tabela ocupa o card inteiro e as colunas crescem na proporção.
    const tableMinWidth = seedBand
      ? canViewPrices
        ? "min-w-[1824px]"
        : "min-w-[1320px]"
      : canViewPrices
        ? "min-w-[1996px]"
        : "min-w-[1492px]";
    return (
      <div
        key={band.id}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className={cn("w-full table-fixed text-sm", tableMinWidth)}>
            <colgroup>
              {seedBand ? (
                <>
                  <col className="w-[36px]" />
                  <col className="w-[144px]" />
                  <col className="w-[240px]" />
                  <col className="w-[112px]" />
                  <col className="w-[88px]" />
                  <col className="w-[112px]" />
                  <col className="w-[128px]" />
                  <col className="w-[112px]" />
                  <col className="w-[104px]" />
                  {canViewPrices ? <col className="w-[120px]" /> : null}
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  <col className="w-[104px]" />
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  <col className="w-[36px]" />
                </>
              ) : (
                <>
                  <col className="w-[36px]" />
                  <col className="w-[144px]" />
                  <col className="w-[260px]" />
                  <col className="w-[80px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  {/* volume + % área + obs. área */}
                  <col className="w-[104px]" />
                  <col className="w-[80px]" />
                  <col className="w-[160px]" />
                  <col className="w-[104px]" />
                  {canViewPrices ? <col className="w-[120px]" /> : null}
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  <col className="w-[104px]" />
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  {canViewPrices ? <col className="w-[128px]" /> : null}
                  <col className="w-[36px]" />
                </>
              )}
            </colgroup>
            <tbody className="divide-y">
              <tr className="bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <td className="px-1.5 py-2" />
                <td className="px-1.5 py-2 text-left">
                  {seedBand ? "Categoria" : "Classe"}
                </td>
                <td className="px-1.5 py-2 text-left">
                  {seedBand ? "Variedades" : "Produto"}
                </td>
                {seedBand ? (
                  <>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Semente/metro
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Ciclo
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      População final
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Volume BAG&apos;s
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Área plantado
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-1.5 py-2 text-center leading-tight">
                      Form.
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Dose
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Un.
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Nº apl.
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      Volume
                    </td>
                    <td className="px-1.5 py-2 text-right leading-tight">
                      % área
                    </td>
                    <td className="px-1.5 py-2 text-left leading-tight">
                      Obs. área
                    </td>
                  </>
                )}
                {sharedHeaderCells}
              </tr>
              {pageItems.map((it, idx) => renderRow(it, idx))}
            </tbody>
            <tfoot>
              {/* Mesmo fundo do cabeçalho das colunas — o `[&>td]` apaga o tom
                "rail" das colunas de resumo para a faixa ficar uniforme. */}
              <tr className="border-t bg-muted/40 text-sm [&>td]:bg-transparent">
                <td className={summaryCellClass} />
                <td
                  colSpan={colCount - summaryColCount - 1 - (seedBand ? 1 : 0)}
                  className="px-1.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {bandOverStock > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {bandOverStock} acima do estoque
                    </span>
                  ) : null}
                </td>
                {/* Área plantada em vermelho quando alguma cultura passou dos
                    hectares da safra — mesma conta da faixa abaixo. */}
                {seedBand ? (
                  <td
                    className={cn(
                      "px-1.5 py-2.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap",
                      seedAreaAlerts.length > 0
                        ? "text-danger-strong"
                        : "text-foreground",
                    )}
                  >
                    {seedAreaAlerts.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help items-center justify-end gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {fmtArea(seedArea)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          sideOffset={6}
                          className="max-w-xs whitespace-normal text-left leading-relaxed"
                        >
                          {seedAreaAlerts.map((row) => (
                            <span key={row.category} className="block">
                              {row.label} · {row.detail}
                            </span>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      fmtArea(seedArea)
                    )}
                  </td>
                ) : null}
                {/* Estoque e preço unitário não somam — são por linha. A qtde
                    final soma mesmo misturando unidade (L, kg, sacas): é o mesmo
                    número que a coluna mostra item a item. */}
                <td className={summaryCellClass} />
                {canViewPrices ? <td className={summaryCellClass} /> : null}
                {canViewPrices ? <td className={summaryCellClass} /> : null}
                <td
                  className={cn(
                    summaryCellClass,
                    "font-semibold text-foreground",
                  )}
                >
                  {fmt(bandTotals.qty)}
                </td>
                {canViewPrices ? (
                  <td
                    className={cn(
                      summaryCellClass,
                      "font-semibold text-foreground",
                    )}
                  >
                    {fmtBrl(bandTotals.brl)}
                  </td>
                ) : null}
                {canViewPrices ? (
                  <td className={cn(summaryCellClass, "text-muted-foreground")}>
                    {fmtUsd(bandTotals.usd)}
                  </td>
                ) : null}
                <td className={summaryCellClass} />
              </tr>
              {seedBand ? renderSeedAreaTableRows(band.items, colCount) : null}
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // Soma da área plantada das sementes × hectares da safra, POR CULTURA (soja e
  // milho podem ocupar a área total cada um). Avisa ao chegar perto (≥90%) e ao
  // passar — os bags são digitados à mão e é fácil estourar a área sem notar.
  // Soja e milho podem ocupar a área toda cada um, então a área plantada é
  // comparada com a safra POR CULTURA — nunca no total das sementes.
  const seedAreaByCategory = (seedItems: ListItem[]) => {
    const byCategory = new Map<string, number>();
    for (const it of seedItems) {
      const area = Number(it.seedingArea || 0);
      if (area <= 0) continue;
      byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + area);
    }
    return byCategory;
  };

  /** `attached`: sem moldura própria, para entrar no cartão da tabela. */
  /** Texto e tom da faixa de área plantada, por cultura. */
  const seedAreaRows = (seedItems: ListItem[]) => {
    if (totalHa <= 0) return [];
    return [...seedAreaByCategory(seedItems).entries()].map(
      ([category, sum]) => {
        const pct = (sum / totalHa) * 100;
        const over = pct > 100;
        const near = !over && pct >= 90;
        return {
          category,
          over,
          near,
          label:
            PRODUCT_CATEGORY_LABELS[
              category as keyof typeof PRODUCT_CATEGORY_LABELS
            ] ?? category,
          detail: `${fmtArea(sum)} de ${fmtArea(totalHa)} ha (${fmt(pct)}%)${
            over
              ? ` — passou ${fmtArea(sum - totalHa)} ha da safra`
              : near
                ? " — quase atingindo a área da safra"
                : ""
          }`,
        };
      },
    );
  };

  /** Cartão solto (mobile, onde não há tabela). */
  const renderSeedAreaSummary = (seedItems: ListItem[]) => {
    const rows = seedAreaRows(seedItems);
    if (rows.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div
            key={row.category}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
              row.over
                ? "border-danger-border bg-danger-soft text-danger-strong"
                : row.near
                  ? "border-warning-border bg-warning-soft text-warning-strong"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-1.5 font-medium">
              {row.over || row.near ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Sprout className="h-4 w-4 shrink-0" />
              )}
              Área plantada · {row.label}
            </span>
            <span className="tabular-nums">{row.detail}</span>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Linhas da mesma tabela (desktop). Dentro do `tfoot` elas herdam as colunas,
   * então o texto encosta exatamente onde encosta o conteúdo das células — o
   * recuo acompanha a coluna-espaçador, que estica junto com a tabela.
   */
  const renderSeedAreaTableRows = (seedItems: ListItem[], colCount: number) =>
    seedAreaRows(seedItems).map((row) => (
      <tr
        key={row.category}
        className={cn(
          "border-t text-[11px] [&>td]:bg-transparent",
          row.over
            ? "bg-danger-soft text-danger-strong"
            : row.near
              ? "bg-warning-soft text-warning-strong"
              : "text-muted-foreground",
        )}
      >
        <td />
        <td colSpan={colCount - 2} className="px-1.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
              {row.over || row.near ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Sprout className="h-3 w-3 shrink-0" />
              )}
              Área plantada · {row.label}
            </span>
            {/* Os números seguem o corpo das células da tabela; só o rótulo
                à esquerda usa o 11px do rodapé. */}
            <span className="text-sm tabular-nums">{row.detail}</span>
          </div>
        </td>
        <td />
      </tr>
    ));

  const bandDefs: Band[] = [
    // Produtos recomendados nas etapas sem estar na lista — entram aqui para o
    // custo não virar fantasma. O agrônomo completa preço/estoque ou remove.
    {
      id: "out",
      tab: "Fora da programação",
      seed: false,
      out: true,
      items: items.filter((it) => !isSeedItem(it) && Boolean(it.outOfProgram)),
    },
    {
      id: "seed",
      tab: "Sementes",
      seed: true,
      out: false,
      items: items.filter((it) => isSeedItem(it)),
    },
    {
      id: "dose",
      tab: "Defensivos e fertilizantes",
      seed: false,
      out: false,
      items: items.filter((it) => !isSeedItem(it) && !it.outOfProgram),
    },
  ];
  const bands = bandDefs.filter((b) => b.items.length > 0);
  const activeBand = bands.find((b) => b.id === bandTab) ?? bands[0];
  const showTabsRow = Boolean(tabsActions) || bands.length > 1;
  useEffect(() => {
    if (!showTabsRow) return;
    // O sentinela fica na posição natural da faixa: o quanto ele já subiu além
    // do topo é o quanto a faixa está grudada.
    const desktop = window.matchMedia("(min-width: 768px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = tabsSentinelRef.current;
      if (!el || !desktop.matches) {
        setTabsStickProgress(0);
        return;
      }
      const offset = -el.getBoundingClientRect().top;
      const next = Math.min(1, Math.max(0, offset / STICK_RAMP_PX));
      setTabsStickProgress((prev) =>
        Math.abs(prev - next) < 0.02 ? prev : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    desktop.addEventListener("change", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      desktop.removeEventListener("change", schedule);
    };
  }, [showTabsRow]);
  const totalPages = Math.max(
    1,
    Math.ceil((activeBand?.items.length ?? 0) / pageSize),
  );
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div
      className={cn(
        "flex min-w-0 w-full flex-col",
        // Espaço para a faixa fixa do rodapé não cobrir o fim da lista.
        !readOnly && "pb-24",
        className,
      )}
    >
      {hideParams ? null : (
        <PurchaseListParamsRow
          items={items}
          totalHa={totalHa}
          readOnly={readOnly}
          className="mb-3"
        />
      )}

      {/* Abas (só no desktop, onde há tabela) e a ação da lista, que vale em
          qualquer largura — por isso a linha fica fora do bloco `lg:block`. */}
      {showTabsRow ? (
        // Fica no topo ao rolar: as abas e a ação da lista seguem à mão com a
        // tabela longa. Só em md+ — no mobile o topo já é da barra do app.
        // Grudada, ganha fundo branco e sombra; a transição faz a passagem.
        <>
          <div ref={tabsSentinelRef} aria-hidden className="h-0" />
          <div
            className={cn(
              "relative mb-3",
              "max-md:static md:sticky md:top-0 md:z-10",
              // Sangra até as bordas da janela; o conteúdo segue alinhado com a
              // página pelo contêiner de dentro.
              "md:mx-[calc(50%-50vw)] md:w-screen",
            )}
          >
            {/* Camada só do fundo: a opacidade acompanha o scroll sem levar
              junto o texto das abas. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-card shadow-[0_6px_20px_-8px_rgb(0_0_0/0.25)]"
              style={{ opacity: tabsStickProgress }}
            />
            {/* A largura máxima soma o px-8 do `main`: sem isso o recuo entra
              duas vezes e as abas saem da prumada da tabela em tela larga. */}
            <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3 md:max-w-[calc(var(--container-app)+4rem)] md:px-8 md:py-2">
              {bands.length > 1 ? (
                <SegmentedTabs
                  className="hidden lg:inline-flex"
                  value={activeBand?.id ?? bands[0].id}
                  onValueChange={(id: BandId) => {
                    setBandTab(id);
                    setPage(1);
                  }}
                  items={bands.map((band) => ({
                    value: band.id,
                    // Fora da programação em vermelho — menos quando é a aba ativa,
                    // que fica no verde primário como as outras.
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={
                            band.out && activeBand?.id !== band.id
                              ? "text-danger-strong"
                              : undefined
                          }
                        >
                          {band.tab}
                        </span>
                        {/* Itens acima do estoque nesta tabela — o âmbar sai na aba
                          ativa, onde o fundo é o verde primário. */}
                        {band.items.some(exceedsStockOf) ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5",
                              activeBand?.id !== band.id && "text-amber-700",
                            )}
                            title="Itens acima do estoque disponível"
                          >
                            <AlertTriangle className="size-3.5" />
                            {band.items.filter(exceedsStockOf).length}
                          </span>
                        ) : null}
                      </span>
                    ),
                  }))}
                />
              ) : (
                <span />
              )}
              {tabsActions}
            </div>
          </div>
        </>
      ) : null}
      {items.length === 0 ? (
        <div className="hidden rounded-xl border bg-card px-3 py-10 text-center text-sm text-muted-foreground shadow-sm lg:block">
          Nenhum produto adicionado. Use o botão abaixo para incluir insumos.
        </div>
      ) : (
        <div className="hidden lg:block">
          {activeBand ? (
            <>
              {renderBandTable(activeBand)}
              <PaginationBar
                className="border-0 bg-transparent px-0 pb-0"
                page={safePage}
                pageSize={pageSize}
                total={activeBand.items.length}
                onPageChange={setPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : null}
        </div>
      )}

      <div className="mt-6 space-y-3 lg:hidden">
        {items.some((it) => isSeedItem(it))
          ? renderSeedAreaSummary(items.filter((it) => isSeedItem(it)))
          : null}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum produto adicionado.
          </div>
        ) : readOnly ? (
          items.map((it) => {
            const seed = isSeedItem(it);
            const toBuy = toBuyByKey.get(it.key) ?? 0;
            const rowUnitBrl = unitBrl(it);
            const rowUnitUsd = unitUsd(it);
            const hasPrice = Boolean(it.price || it.priceUsd);
            const totalValue = toBuy * rowUnitBrl;
            const totalValueUsd = toBuy * rowUnitUsd;
            const catLabel =
              PRODUCT_CATEGORY_LABELS[
                it.category as keyof typeof PRODUCT_CATEGORY_LABELS
              ] ??
              it.category ??
              "—";
            return (
              <div
                key={it.key}
                data-item-key={it.key}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {catLabel}
                  {it.outOfProgram ? (
                    <span className="ml-2 inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-destructive">
                      Fora da programação
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-base font-medium text-foreground">
                  {it.productName || "—"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Estoque disponível
                    </span>
                    <p className="mt-0.5 tabular-nums">
                      {Number(it.stock || 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {seed ? seedQuantityUnitLabel(it.category) : it.unit}
                    </p>
                  </div>
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
                    <span className="text-xs font-medium text-muted-foreground">
                      A comprar
                    </span>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {fmt(toBuy)}{" "}
                      {seed ? seedQuantityUnitLabel(it.category) : it.unit}
                    </p>
                  </div>
                  {canViewPrices ? (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Preço
                      </span>
                      <p className="mt-0.5 tabular-nums">
                        {it.priceUsd ? `${fmtUsd(Number(it.priceUsd))} · ` : ""}
                        {hasPrice ? fmtBrl(rowUnitBrl) : "—"}
                      </p>
                    </div>
                  ) : null}
                  {canViewPrices ? (
                    <div className="col-span-2 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        Valor total
                      </span>
                      <p className="mt-0.5 break-words font-semibold tabular-nums">
                        {hasPrice ? fmtBrl(totalValue) : "—"}
                        {hasPrice && rowUnitUsd > 0 ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {fmtUsd(totalValueUsd)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
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
            const toBuy = toBuyByKey.get(it.key) ?? 0;
            return (
              <div
                key={it.key}
                data-item-key={it.key}
                className={cn(
                  "rounded-xl border p-4 shadow-sm",
                  addedKeys.has(it.key) ? "bg-primary-soft" : "bg-card",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <label className="flex items-center gap-2">
                    {!readOnly ? (
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selectedKeys.has(it.key)}
                        onChange={() => toggleSelected(it.key)}
                        aria-label="Selecionar para excluir"
                      />
                    ) : null}
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Insumo
                      {it.outOfProgram ? (
                        <span className="ml-2 inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-destructive">
                          Fora da programação
                        </span>
                      ) : null}
                    </p>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    disabled={removalBusy}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
                      options={(seed ? seedCategories : nonSeedCategories).map(
                        (category) => ({
                          value: category,
                          label: PRODUCT_CATEGORY_LABELS[category],
                        }),
                      )}
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
                          onChange={(e) =>
                            setSeedsPerMeter(it.key, e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Ciclo (dias)">
                        <Input
                          type="number"
                          step="1"
                          value={it.cycleDays ?? ""}
                          onChange={(e) =>
                            updateItem(it.key, { cycleDays: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label={`Volume BAG's (${seedQuantityUnitLabel(it.category)})`}
                      >
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder={seedQuantityUnitLabel(it.category)}
                          value={it.bagsOverride ?? ""}
                          onChange={(e) => setBags(it.key, e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Área plantado (ha)"
                        hint="calculada pelos bags"
                      >
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
                          onChange={(e) => setDose(it.key, e.target.value)}
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
                          step="1"
                          min="1"
                          inputMode="numeric"
                          value={it.nApps}
                          onChange={(e) => {
                            const whole = e.target.value
                              .replace(/[.,].*$/, "")
                              .replace(/\D/g, "");
                            setNApps(it.key, whole === "" ? "" : whole);
                          }}
                        />
                      </Field>
                      <Field
                        label="Volume"
                        hint="Digite o volume comercial; a dose recalcula. Digite a dose e o volume sai sozinho."
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            it.volumeOverride !== undefined &&
                            it.volumeOverride !== ""
                              ? it.volumeOverride
                              : required > 0
                                ? String(Number(required.toFixed(4)))
                                : ""
                          }
                          onChange={(e) =>
                            setVolumeOverride(it.key, e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="% da área"
                        hint="Vazio = 100% da safra. 20 = só 20% dos hectares."
                      >
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="100"
                          value={it.areaPercent ?? ""}
                          onChange={(e) =>
                            setAreaPercent(it.key, e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Observação da área"
                        hint="Só aparece no PDF."
                      >
                        <Input
                          placeholder="Ex: áreas sujas"
                          value={it.areaNote ?? ""}
                          onChange={(e) =>
                            updateItem(it.key, { areaNote: e.target.value })
                          }
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Estoque disponível">
                    <MoneyInput
                      value={it.stock}
                      onValueChange={(v) => updateItem(it.key, { stock: v })}
                      decimals={2}
                      grouping={false}
                    />
                  </Field>
                  {canViewPrices ? (
                    <Field label="Preço US$/un.">
                      <MoneyInput
                        placeholder="US$"
                        value={it.priceUsd}
                        onValueChange={(v) =>
                          updateItem(it.key, { priceUsd: v })
                        }
                      />
                    </Field>
                  ) : null}
                  {canViewPrices ? (
                    <Field label="Preço R$/un.">
                      {it.priceUsd && fx > 0 ? (
                        <div className="flex h-9 items-center text-sm tabular-nums text-muted-foreground">
                          {fmtBrl(unitBrl(it))}{" "}
                          <span className="ml-1 text-[10px]">(do US$)</span>
                        </div>
                      ) : (
                        <MoneyInput
                          placeholder="R$"
                          value={it.price}
                          onValueChange={(v) =>
                            updateItem(it.key, { price: v })
                          }
                        />
                      )}
                    </Field>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Necessário{" "}
                    <span className="tabular-nums text-foreground">
                      {fmt(required)}
                    </span>
                  </span>
                  <span className="font-semibold">
                    A comprar{" "}
                    <span className="tabular-nums text-foreground">
                      {fmt(toBuy)}
                    </span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!readOnly ? (
        // Faixa fixa no rodapé da janela: adicionar produto fica à mão em lista
        // longa, sem rolar até o fim. O `pb` do container abre o espaço para o
        // fim da lista não terminar embaixo dela.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 shadow-[0_-6px_20px_-8px_rgb(0_0_0/0.25)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-[calc(var(--container-app)+2rem)] flex-wrap items-center justify-end gap-2 px-4 py-3 md:max-w-[calc(var(--container-app)+4rem)] md:px-8">
            {selectedKeys.size > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={removalBusy}
                // O `destructive` do sistema é o vermelho suave; aqui a ação
                // pede o vermelho cheio.
                className="mr-auto shrink-0 gap-2 border-transparent bg-danger-strong text-white hover:bg-danger-strong/90"
              >
                <Trash2 className="h-4 w-4" />
                Remover {selectedKeys.size}{" "}
                {selectedKeys.size === 1 ? "selecionado" : "selecionados"}
              </Button>
            ) : null}
            {seedCategories.length > 0 ? (
              <Button
                type="button"
                onClick={addSeedItem}
                className="shrink-0 gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar semente
              </Button>
            ) : null}
            <Button type="button" onClick={addItem} className="shrink-0 gap-2">
              <Plus className="h-4 w-4" />
              Adicionar produto
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir da lista?"
        loading={removalBusy}
        description={
          <div className="space-y-2">
            <p>
              {selectedKeys.size}{" "}
              {selectedKeys.size === 1 ? "item sai" : "itens saem"} da lista. Se
              estiverem em recomendações pendentes, também saem de lá. Compra
              confirmada ou já aplicado não sai.
            </p>
            <ul className="space-y-1">
              {items
                .filter((it) => selectedKeys.has(it.key))
                .map((it) => (
                  <li key={it.key}>
                    • {it.productName || "Produto"} —{" "}
                    {it.stage || DEFAULT_ITEM_STAGE}
                  </li>
                ))}
            </ul>
          </div>
        }
        tone="destructive"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
