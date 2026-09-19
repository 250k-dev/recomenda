"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ListFilter, Plus, Sprout, Trash2 } from "lucide-react";
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
import { fmt, fmtArea } from "@/components/domain/season/_shared";
import { PurchaseListParamsRow } from "@/components/domain/purchase-list-params-row";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import {
  applyTableView,
  columnOptions,
  ColumnFilterHeader,
  hasActiveFilters,
  isTableViewActive,
  withColumnFilter,
  type ColumnAccessor,
  type TableView,
} from "@/components/domain/table-column-filter";
import { PaginationBar } from "@recomenda/ui/patterns/pagination-bar";
import { useIsMobile } from "@recomenda/ui/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@recomenda/ui/primitives/tooltip";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { removePurchaseListItems } from "@recomenda/api/purchase-lists";
import {
  areaFactorOf,
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

/** Colunas que ordenam e filtram. As de semente e as de defensivo dividem as
 *  compartilhadas (estoque em diante). */
type ColumnId =
  | "category"
  | "product"
  | "seedsPerMeter"
  | "cycle"
  | "population"
  | "bags"
  | "seedArea"
  | "formulation"
  | "dose"
  | "unit"
  | "nApps"
  | "volume"
  | "areaPercent"
  | "areaNote"
  | "stock"
  | "priceUsd"
  | "priceBrl"
  | "toBuy"
  | "totalBrl"
  | "totalUsd";

const EMPTY_VIEW: TableView<ColumnId> = { sort: null, filters: {} };

/**
 * Larguras das colunas da tabela (px), em faixas. Nenhum título quebra linha:
 * cada coluna entra na menor faixa em que cabem o título (em uma linha, com o
 * botão de filtro) e o conteúdo — lido e em edição. As compartilhadas (estoque
 * em diante) medem igual nas duas tabelas, então trocar de aba não mexe nelas.
 *
 * Medidas em Inter, título 11px: texto + ~38px de botão, vão e recuo da célula.
 */
const COL = {
  /** Checkbox e o espaçador do outro lado. */
  edge: 36,
  /** Form., Dose, Un., Nº apl., % área, Ciclo. Quem pede os 100 é o select
   *  de unidade em edição ("Dose" + seta). */
  xs: 100,
  /** Volume, Qtde final, Preço US$, Valor. Cabe "QTDE FINAL" e "R$ 12.345,67". */
  sm: 112,
  /** Total, Total US$, Semente/metro, População final, Volume BAG's, Área
   *  plantado, Obs. área. Cabe "POPULAÇÃO FINAL" e o total do rodapé em
   *  negrito, "R$ 15.522.769,62". */
  md: 148,
  /** Estoque disponível — o título mais longo da tabela. */
  lg: 168,
  /** Classe: cabe "Fertilizante" com a seta do select. */
  classe: 144,
  /** Categoria e Variedades: cabe "Híbrido de milho" com a seta do select. */
  seedName: 184,
  /** Produto: mínimo — é a única coluna que cresce com o card, porque nome de
   *  produto é o que trunca ("Soberan / Terex / Habil / …"). */
  product: 240,
  /** Produto e Variedades no celular, presos à esquerda: estreitos o bastante
   *  para sobrar tela para as colunas que rolam por baixo. */
  pinned: 152,
} as const;

type ColSpec = { width: number; grow?: boolean };

/** Select na tabela com a altura dos inputs dela (h-8) — o `sm` dos selects é
 *  h-9, e a linha ficava com campos de duas alturas. */
const TABLE_SELECT_CLASS = "[&>button]:h-8";

/** Input da tabela. No celular, 16px: abaixo disso o Safari do iPhone dá zoom
 *  na página ao focar o campo. */
const TABLE_INPUT_CLASS =
  "h-8 w-full min-w-0 px-2 text-sm tabular-nums max-md:text-base";

/**
 * Coluna do produto (ou da variedade) abaixo de `lg` — celular e tablet, onde a
 * tabela sempre rola de lado: presa à esquerda, para a linha não perder o nome. As outras colunas passam por
 * baixo, então o fundo tem de ser opaco — e com a cor da linha, que é
 * translúcida no cabeçalho e na linha selecionada: daí as misturas com o card.
 * O `!` vence o `[&>td]:bg-transparent` das linhas destacadas.
 */
const PIN_CLASS =
  "max-lg:sticky max-lg:left-0 max-lg:z-[1] max-lg:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.25)]";
const PIN_HEADER_BG =
  "max-lg:bg-[color-mix(in_srgb,var(--color-muted)_40%,var(--color-card))]!";

/** Conteúdo de linha que atravessa a tabela toda (rodapé, área plantada, sem
 *  resultado): abaixo de `lg` a célula é bem mais larga que a tela, então o
 *  texto fica preso na parte visível ao rolar de lado, e quebra linha nela. */
const SPAN_TEXT_CLASS =
  "max-lg:sticky max-lg:left-2 max-lg:w-fit max-lg:max-w-[calc(100vw-5rem)]";

/** "" vira `null` (a célula mostra "—"); o resto, número. */
function numberOrNull(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

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
  const isMobile = useIsMobile();
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

  // Ordenação e filtros das colunas, um conjunto por aba: as colunas mudam de
  // uma tabela para a outra, e voltar à aba devolve o que estava lá.
  const [views, setViews] = useState<
    Partial<Record<BandId, TableView<ColumnId>>>
  >({});
  const viewOf = (id: BandId) => views[id] ?? EMPTY_VIEW;
  const updateView = (
    id: BandId,
    update: (view: TableView<ColumnId>) => TableView<ColumnId>,
  ) => {
    setViews((prev) => ({ ...prev, [id]: update(prev[id] ?? EMPTY_VIEW) }));
    setPage(1);
  };
  // Em edição, a ordem da tabela não segue o que se digita: ordenada ou
  // filtrada, cada tecla faria a linha pular de página ou sumir no meio da
  // conta. A ordem é tirada quando a ordenação/filtro muda e fica congelada até
  // a próxima mudança; item novo entra no fim, visível mesmo fora do filtro.
  const [frozenView, setFrozenView] = useState<{
    token: string;
    keys: string[];
    /** Tudo o que a aba tinha na hora — o que não está aqui é item novo. */
    seen: ReadonlySet<string>;
  } | null>(null);

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

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  // O valor de cada coluna, como a célula o mostra — é o que ordena e filtra.
  const categoryLabelOf = (it: ListItem): string =>
    PRODUCT_CATEGORY_LABELS[
      it.category as keyof typeof PRODUCT_CATEGORY_LABELS
    ] ?? it.category;
  const hasPriceOf = (it: ListItem) => Boolean(it.price || it.priceUsd);
  const toBuyOf = (it: ListItem) => toBuyByKey.get(it.key) ?? 0;
  const columns: Record<ColumnId, ColumnAccessor<ListItem>> = {
    category: { kind: "options", get: categoryLabelOf },
    product: { kind: "text", get: (it) => it.productName },
    seedsPerMeter: {
      kind: "range",
      get: (it) => numberOrNull(it.seedsPerMeter),
    },
    cycle: { kind: "range", get: (it) => numberOrNull(it.cycleDays) },
    population: {
      kind: "range",
      get: (it) => Number(it.thousandPlants || 0) || null,
    },
    bags: { kind: "range", get: (it) => listItemQuantity(it, totalHa) },
    seedArea: {
      kind: "range",
      get: (it) => Number(it.seedingArea || 0) || null,
    },
    formulation: {
      kind: "options",
      get: (it) => {
        const label = formulationShortLabel(
          resolveFormulationKey(it.equivalenceGroup),
        );
        return label === "—" ? "" : label;
      },
    },
    dose: { kind: "range", get: (it) => numberOrNull(it.dose) },
    unit: { kind: "options", get: (it) => it.unit },
    nApps: { kind: "range", get: (it) => numberOrNull(it.nApps) },
    volume: { kind: "range", get: (it) => listItemQuantity(it, totalHa) },
    areaPercent: { kind: "range", get: (it) => areaFactorOf(it) * 100 },
    areaNote: { kind: "text", get: (it) => it.areaNote ?? "" },
    stock: { kind: "range", get: (it) => Number(it.stock || 0) },
    priceUsd: { kind: "range", get: (it) => numberOrNull(it.priceUsd) },
    priceBrl: {
      kind: "range",
      get: (it) => (hasPriceOf(it) ? unitBrl(it) : null),
    },
    toBuy: { kind: "range", get: toBuyOf },
    totalBrl: {
      kind: "range",
      get: (it) => (hasPriceOf(it) ? toBuyOf(it) * unitBrl(it) : null),
    },
    totalUsd: {
      kind: "range",
      get: (it) =>
        hasPriceOf(it) && unitUsd(it) > 0 ? toBuyOf(it) * unitUsd(it) : null,
    },
  };

  // Colunas de resumo à direita (Qtde final, Total, Total US$ e o espaçador da
  // ponta): laranja claro do tema no cabeçalho e nas linhas, para se
  // destacarem. Translúcido, para a zebra das linhas continuar aparecendo.
  const summaryCellClass =
    "bg-clay-soft/60 px-1.5 py-1.5 text-sm tabular-nums whitespace-nowrap";
  const summaryHeaderClass = "bg-clay-soft/60 px-1.5 py-2 leading-tight";
  /** Célula do rodapé: sem o laranja das colunas de resumo. */
  const footerCellClass =
    "px-1.5 py-1.5 text-sm tabular-nums whitespace-nowrap";

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
          // 52px: a mesma altura lida ou em edição. Em edição, campos e selects
          // têm h-8 (34px, porque o html deste app usa font-size 17px e o rem
          // escala junto); o resto é o py-1.5 das células e respiro. A altura
          // vai nas CÉLULAS, onde o navegador a trata como mínimo; em <tr> ela
          // nem sempre pega.
          "align-middle [&>td]:h-[52px]",
          // Zebra: branco e meio tom acima, para o olho não pular de linha.
          // O `surface-2` inteiro pesava demais. A coluna presa do celular
          // repete a mesma mistura, opaca.
          rowIndex % 2 === 0 ? "bg-card" : "bg-surface-2/50",
          // `[&>td]` apaga o laranja das colunas de resumo, para o verde
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
              className={cn("min-w-0 max-w-none", TABLE_SELECT_CLASS)}
            />
          )}
        </td>
        <td
          className={cn(
            "px-1.5 py-1.5",
            PIN_CLASS,
            // Mesma cor da linha, só que opaca (ver `PIN_CLASS`).
            selectedKeys.has(it.key)
              ? "max-lg:bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-card))]!"
              : isNew
                ? "max-lg:bg-primary-soft!"
                : rowIndex % 2 === 0
                  ? "max-lg:bg-card!"
                  : "max-lg:bg-[color-mix(in_srgb,var(--color-surface-2)_50%,var(--color-card))]!",
          )}
        >
          {readOnly ? (
            <span className="block truncate text-sm font-medium text-foreground">
              {it.productName || "—"}
            </span>
          ) : (
            renderProductField(
              it,
              rowProducts,
              cn("min-w-0", TABLE_SELECT_CLASS),
            )
          )}
        </td>
        {!seed ? (
          <td className="px-1.5 py-1.5">
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
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
            {/* Ciclo (dias) */}
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
            {/* População final — derivada de semente/metro ÷ espaçamento */}
            <td className="px-1.5 py-1.5">
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
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
            {/* Área plantado (ha) — derivada dos bags ÷ população */}
            <td className="px-1.5 py-1.5">
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
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
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
                  className={cn("w-full min-w-0", TABLE_SELECT_CLASS)}
                />
              )}
            </td>
            {/* Nº aplicações — só inteiros ≥ 1 */}
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
            {/* Volume — editável; se mexer, recalcula a dose (ha/% ficam) */}
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
            {/* % da área — hectares da linha = % × área da lista */}
            <td className="px-1.5 py-1.5">
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
                  className={TABLE_INPUT_CLASS}
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
                  className={TABLE_INPUT_CLASS}
                />
              )}
            </td>
          </>
        )}
        <td className="px-1.5 py-1.5">
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
              className={TABLE_INPUT_CLASS}
            />
          )}
        </td>
        {canViewPrices ? (
          <td className="px-1.5 py-1.5">
            {readOnly ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                {it.priceUsd ? fmtUsd(Number(it.priceUsd)) : "—"}
              </span>
            ) : (
              <MoneyInput
                placeholder="US$"
                value={it.priceUsd}
                onValueChange={(v) => updateItem(it.key, { priceUsd: v })}
                className={TABLE_INPUT_CLASS}
              />
            )}
          </td>
        ) : null}
        {canViewPrices ? (
          <td className="px-1.5 py-1.5">
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
                className={TABLE_INPUT_CLASS}
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
                <span className="inline-flex cursor-help items-center gap-1">
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
            <span className="inline-flex items-center gap-1">
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

  /** Título de coluna com o botão que abre ordenação e filtro. */
  const renderHeaderCell = (
    band: Band,
    column: ColumnId,
    label: string,
    className = "px-1.5 py-2 text-left leading-tight",
  ) => {
    const view = viewOf(band.id);
    const accessor = columns[column];
    return (
      <td className={className}>
        <ColumnFilterHeader
          label={label}
          kind={accessor.kind}
          sort={view.sort?.column === column ? view.sort.dir : null}
          onSortChange={(dir) =>
            updateView(band.id, (v) => ({
              ...v,
              sort: dir
                ? { column, dir }
                : v.sort?.column === column
                  ? null
                  : v.sort,
            }))
          }
          filter={view.filters[column]}
          onFilterChange={(filter) =>
            updateView(band.id, (v) => withColumnFilter(v, column, filter))
          }
          options={
            accessor.kind === "options"
              ? columnOptions(band.items, accessor)
              : undefined
          }
        />
      </td>
    );
  };

  // Cabeçalho das colunas compartilhadas (à direita) — igual para sementes e
  // defensivos. As de resumo (Qtde final → Total US$) ganham o laranja.
  const renderSharedHeaderCells = (band: Band) => (
    <>
      {renderHeaderCell(band, "stock", "Estoque disponível")}
      {canViewPrices
        ? renderHeaderCell(band, "priceUsd", "Preço US$")
        : null}
      {canViewPrices
        ? renderHeaderCell(band, "priceBrl", "Valor")
        : null}
      {renderHeaderCell(band, "toBuy", "Qtde final", summaryHeaderClass)}
      {canViewPrices
        ? renderHeaderCell(band, "totalBrl", "Total", summaryHeaderClass)
        : null}
      {canViewPrices
        ? renderHeaderCell(band, "totalUsd", "Total US$", summaryHeaderClass)
        : null}
      {/* Espaçador: o mesmo recuo da coluna do checkbox, do outro lado. */}
      <td className={summaryHeaderClass} />
    </>
  );

  // Cada banda (sementes / defensivos) vira sua própria tabela com rolagem
  // horizontal simples, pois têm conjuntos de colunas diferentes. `rows` são os
  // itens da banda já filtrados e ordenados.
  const renderBandTable = (band: Band, rows: ListItem[]) => {
    const seedBand = band.seed;
    // Com filtro, o rodapé soma só o que passou nele — como o subtotal de uma
    // planilha filtrada — e diz quantos itens ficaram de fora.
    const filtered = hasActiveFilters(viewOf(band.id));
    // Colunas de resumo à direita (as do `renderSharedHeaderCells`) — o rodapé
    // usa a conta para saber quanto a célula do rótulo precisa cobrir à
    // esquerda.
    // +1: a coluna-espaçador da direita.
    const summaryColCount = 3 + (canViewPrices ? 4 : 0);
    const bandTotals = rows.reduce(
      (acc, it) => {
        const toBuy = toBuyByKey.get(it.key) ?? 0;
        acc.qty += toBuy;
        acc.brl += toBuy * unitBrl(it);
        acc.usd += toBuy * unitUsd(it);
        return acc;
      },
      { qty: 0, brl: 0, usd: 0 },
    );
    const bandOverStock = rows.filter(exceedsStockOf).length;
    const pageItems = rows.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize,
    );
    const seedArea = seedBand
      ? rows.reduce((acc, it) => acc + (Number(it.seedingArea) || 0), 0)
      : 0;
    // Culturas que passaram dos hectares da safra — marcam o total no rodapé.
    // Contam a lista inteira, com ou sem filtro: é a conferência contra a safra.
    const seedAreaAlerts = seedBand
      ? seedAreaRows(band.items).filter((row) => row.over)
      : [];
    // Uma entrada por coluna, na ordem do cabeçalho. Sem PRICE_VIEW, saem as
    // quatro de preço.
    const colSpecs: ColSpec[] = [
      { width: COL.edge },
      ...(seedBand
        ? [
            { width: COL.seedName }, // Categoria
            { width: isMobile ? COL.pinned : COL.seedName }, // Variedades
            { width: COL.md }, // Semente/metro
            { width: COL.xs }, // Ciclo
            { width: COL.md }, // População final
            { width: COL.md }, // Volume BAG's
            { width: COL.md }, // Área plantado
          ]
        : [
            { width: COL.classe },
            isMobile
              ? { width: COL.pinned }
              : { width: COL.product, grow: true },
            { width: COL.xs }, // Form.
            { width: COL.xs }, // Dose
            { width: COL.xs }, // Un.
            { width: COL.xs }, // Nº apl.
            { width: COL.sm }, // Volume
            { width: COL.xs }, // % área
            { width: COL.md }, // Obs. área
          ]),
      { width: COL.lg }, // Estoque disponível
      ...(canViewPrices
        ? [{ width: COL.sm }, { width: COL.sm }] // Preço US$, Valor
        : []),
      { width: COL.sm }, // Qtde final
      ...(canViewPrices
        ? [{ width: COL.md }, { width: COL.md }] // Total, Total US$
        : []),
      { width: COL.edge },
    ];
    const colCount = colSpecs.length;
    // Soma das colunas: largura mínima (abaixo dela, rola na horizontal). Acima,
    // o que sobra do card vai para o Produto; sem coluna que cresça (sementes),
    // a sobra se reparte na proporção e as faixas continuam iguais entre si.
    const tableMinWidth = colSpecs.reduce((sum, col) => sum + col.width, 0);
    return (
      <div
        key={band.id}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        {/* `overscroll-x-contain`: no celular, chegar à borda da tabela rolando
            de lado não vira o gesto de voltar do navegador. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <table
            className="w-full table-fixed text-sm"
            style={{ minWidth: tableMinWidth }}
          >
            {/* Coluna sem largura, na tabela `table-fixed`, fica com o resto. */}
            <colgroup>
              {colSpecs.map((col, i) => (
                <col
                  key={i}
                  style={col.grow ? undefined : { width: col.width }}
                />
              ))}
            </colgroup>
            <tbody className="divide-y">
              <tr className="bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <td className="px-1.5 py-2" />
                {renderHeaderCell(
                  band,
                  "category",
                  seedBand ? "Categoria" : "Classe",
                )}
                {renderHeaderCell(
                  band,
                  "product",
                  seedBand ? "Variedades" : "Produto",
                  cn(
                    "px-1.5 py-2 text-left leading-tight",
                    PIN_CLASS,
                    PIN_HEADER_BG,
                  ),
                )}
                {seedBand ? (
                  <>
                    {renderHeaderCell(band, "seedsPerMeter", "Semente/metro")}
                    {renderHeaderCell(band, "cycle", "Ciclo")}
                    {renderHeaderCell(band, "population", "População final")}
                    {renderHeaderCell(band, "bags", "Volume BAG's")}
                    {renderHeaderCell(band, "seedArea", "Área plantado")}
                  </>
                ) : (
                  <>
                    {renderHeaderCell(band, "formulation", "Form.")}
                    {renderHeaderCell(band, "dose", "Dose")}
                    {renderHeaderCell(band, "unit", "Un.")}
                    {renderHeaderCell(band, "nApps", "Nº apl.")}
                    {renderHeaderCell(band, "volume", "Volume")}
                    {renderHeaderCell(band, "areaPercent", "% área")}
                    {renderHeaderCell(band, "areaNote", "Obs. área")}
                  </>
                )}
                {renderSharedHeaderCells(band)}
              </tr>
              {pageItems.map((it, idx) => renderRow(it, idx))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-3 py-10 text-center text-sm text-muted-foreground max-lg:text-left"
                  >
                    <div className={SPAN_TEXT_CLASS}>
                      Nenhum item com esses filtros.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              {/* Uma cor só, um tom acima do cabeçalho, e sem o laranja das
                colunas de resumo: o rodapé fecha a tabela como faixa própria.
                `h-11` (47px): um pouco mais alto que o conteúdo pede, para os
                totais respirarem. */}
              <tr className="border-t bg-muted/70 text-sm [&>td]:h-11">
                <td className={footerCellClass} />
                <td
                  colSpan={colCount - summaryColCount - 1 - (seedBand ? 1 : 0)}
                  className="px-1.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <span
                    className={cn(
                      "inline-flex flex-wrap items-center gap-x-4 gap-y-1",
                      SPAN_TEXT_CLASS,
                    )}
                  >
                    {filtered ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <ListFilter className="h-3 w-3" />
                        {rows.length} de {band.items.length} itens
                        <button
                          type="button"
                          onClick={() =>
                            updateView(band.id, (v) => ({ ...v, filters: {} }))
                          }
                          className="uppercase tracking-wide underline-offset-2 hover:underline"
                        >
                          · limpar filtros
                        </button>
                      </span>
                    ) : null}
                    {bandOverStock > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        {bandOverStock} acima do estoque
                      </span>
                    ) : null}
                  </span>
                </td>
                {/* Área plantada em vermelho quando alguma cultura passou dos
                    hectares da safra — mesma conta da faixa abaixo. */}
                {seedBand ? (
                  <td
                    className={cn(
                      "px-1.5 py-2.5 text-sm font-semibold tabular-nums whitespace-nowrap",
                      seedAreaAlerts.length > 0
                        ? "text-danger-strong"
                        : "text-foreground",
                    )}
                  >
                    {seedAreaAlerts.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help items-center gap-1">
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
                <td className={footerCellClass} />
                {canViewPrices ? <td className={footerCellClass} /> : null}
                {canViewPrices ? <td className={footerCellClass} /> : null}
                <td
                  className={cn(
                    footerCellClass,
                    "font-semibold text-foreground",
                  )}
                >
                  {fmt(bandTotals.qty)}
                </td>
                {canViewPrices ? (
                  <td
                    className={cn(
                      footerCellClass,
                      "font-semibold text-foreground",
                    )}
                  >
                    {fmtBrl(bandTotals.brl)}
                  </td>
                ) : null}
                {canViewPrices ? (
                  <td className={cn(footerCellClass, "text-muted-foreground")}>
                    {fmtUsd(bandTotals.usd)}
                  </td>
                ) : null}
                <td className={footerCellClass} />
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

  /**
   * Linhas da mesma tabela. Dentro do `tfoot` elas herdam as colunas,
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
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2",
              // Abaixo de `lg`, o número vem logo depois do rótulo: com o
              // `justify-between`, ficaria na outra ponta da tabela.
              "max-lg:justify-start max-lg:gap-x-3",
              SPAN_TEXT_CLASS,
            )}
          >
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
  // Itens da aba aberta como a tabela os mostra: filtrados e ordenados — ou,
  // em edição, na ordem congelada (ver `frozenView`). Os incluídos nesta edição
  // (verdes) ficam fora do filtro e da ordem, sempre no fim: quem acabou de
  // adicionar uma linha vazia precisa vê-la, não perdê-la para o filtro.
  const activeView = activeBand ? viewOf(activeBand.id) : EMPTY_VIEW;
  let visibleItems: ListItem[] = activeBand?.items ?? [];
  if (!activeBand || !isTableViewActive(activeView)) {
    // Solta a ordem congelada: a próxima ordenação/filtro tira uma nova.
    if (frozenView !== null) setFrozenView(null);
  } else if (readOnly) {
    visibleItems = applyTableView(activeBand.items, activeView, columns);
    if (frozenView !== null) setFrozenView(null);
  } else {
    const viewToken = `${activeBand.id}:${JSON.stringify(activeView)}`;
    const base = activeBand.items.filter((it) => !addedKeys.has(it.key));
    const added = activeBand.items.filter((it) => addedKeys.has(it.key));
    // Chave que a foto não conhece e não foi incluída aqui: a lista foi
    // trocada por fora (rascunho restaurado) — a foto não vale mais.
    const stale =
      frozenView?.token !== viewToken ||
      base.some((it) => !frozenView.seen.has(it.key));
    if (stale) {
      const ordered = applyTableView(base, activeView, columns);
      setFrozenView({
        token: viewToken,
        keys: ordered.map((it) => it.key),
        seen: new Set(base.map((it) => it.key)),
      });
      visibleItems = [...ordered, ...added];
    } else {
      const byKey = new Map(base.map((it) => [it.key, it]));
      visibleItems = [
        ...frozenView.keys.flatMap((key) => byKey.get(key) ?? []),
        ...added,
      ];
    }
  }
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
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

      {/* Abas das tabelas e a ação da lista. */}
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
        <div className="rounded-xl border bg-card px-3 py-10 text-center text-sm text-muted-foreground shadow-sm">
          Nenhum produto adicionado. Use o botão abaixo para incluir insumos.
        </div>
      ) : activeBand ? (
        <>
          {renderBandTable(activeBand, visibleItems)}
          <PaginationBar
            className="border-0 bg-transparent px-0 pb-0"
            page={safePage}
            pageSize={pageSize}
            total={visibleItems.length}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      ) : null}

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
