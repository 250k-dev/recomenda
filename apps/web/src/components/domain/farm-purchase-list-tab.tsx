"use client";


import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Boxes, Leaf, Pencil, Plus, Share2, Store, Target, X, Check, Loader2 } from "lucide-react";
import { Select } from "@recomenda/ui/forms/select";
import { PageHero } from "@/components/domain/page-hero";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { EXPORT_ACTION_CLASS } from "@/components/domain/export-action-class";
import { apiErrorCode, apiErrorMessage, apiHttpStatus } from "@recomenda/api/api-error";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import { PurchaseListParamsRow } from "@/components/domain/purchase-list-params-row";
import {
  useCurrencyStore,
  DEFAULT_GRAIN_PRICE_BRL,
  DEFAULT_SPACING_M,
} from "@/stores/currency";
import {
  computePurchaseListMetrics,
  detailItemToListItem,
  applyManualTotalSpent,
  usesManualListTotal,
} from "@recomenda/domain/purchase-list/breakdown";
import { clearLocalDraft } from "@recomenda/api-hooks/use-local-draft";
import {
  readVersionedLocalDraft,
  writeVersionedLocalDraft,
} from "@recomenda/api-hooks/versioned-local-draft";
import { useUnsavedChangesWarning } from "@recomenda/api-hooks/use-unsaved-changes-warning";
import { useLeaveBusyGuard } from "@/hooks/use-leave-busy-guard";
import { CategoryDistributionPanel } from "@/components/domain/category-distribution-panel";
import {
  CategoryMetaProgress,
  hasSingleTotalTarget,
} from "@/components/domain/category-meta-progress";
import {
  useFarmAggregatedShoppingList,
  useUpdatePurchaseList,
} from "@recomenda/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@recomenda/api-hooks/queryKeys";
import {
  getPurchaseListByCycle,
  syncPurchaseListItems,
  updatePurchaseList,
} from "@recomenda/api/purchase-lists";
import {
  computePurchaseListItemsDelta,
  purchaseListDeltaIsEmpty,
  remapDraftKeysFromSyncItems,
} from "@recomenda/domain/purchase-list/item-delta";
import { usePurchaseListEditChannel } from "@/hooks/use-purchase-list-edit-channel";
import { PurchaseListDraftRestoreDialog } from "@/components/domain/purchase-list-draft-restore-dialog";
import { useProducerStock } from "@recomenda/api-hooks/producers";
import type { ListItem } from "@recomenda/domain/purchase-list/list-item";
import {
  listItemToPayload,
  validateListItems,
} from "@recomenda/domain/purchase-list/list-item";
import type { PurchaseListDetail, PurchaseListItemInput } from "@recomenda/api";
import { CROP_LABELS } from "@recomenda/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { DataTable } from "@recomenda/ui/patterns/data-table";
import { FulfillWithoutQuoteButton } from "@/components/domain/fulfill-without-quote-dialog";
import { PurchaseListExportDialog } from "@/components/domain/purchase-list-export-dialog";
import { IconActionButton } from "@/components/domain/icon-action-button";
import { useCan } from "@recomenda/api-hooks/use-can";
import { PurchaseListTargetsDialog } from "@/components/domain/purchase-list-targets-dialog";
import { SavePurchaseListTemplateButton } from "@/components/domain/save-purchase-list-template-dialog";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Autosave com save incremental (deltas) — debounce longo. `NEXT_PUBLIC_PURCHASE_LIST_AUTOSAVE=false` desliga. */
const PURCHASE_LIST_AUTOSAVE_ENABLED =
  process.env.NEXT_PUBLIC_PURCHASE_LIST_AUTOSAVE !== "false";
const PURCHASE_LIST_AUTOSAVE_MS = 4000;

function draftPayloadEquals(
  a: ListItem[],
  b: ListItem[],
  listCrop?: string | null,
): boolean {
  return (
    JSON.stringify(listItemsToPayload(a, listCrop)) ===
    JSON.stringify(listItemsToPayload(b, listCrop))
  );
}

/** Indicador do save manual durante a edição da lista. */
function SaveStatus({
  state,
  savedAt,
  dirty,
}: {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
  dirty: boolean;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-primary-strong">
        <Check className="h-3.5 w-3.5" />
        Salvo
        {savedAt
          ? ` ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : ""}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-warning-strong">
        <X className="h-3.5 w-3.5" /> Não salvo
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        Alterações não salvas — use Salvar
      </span>
    );
  }
  return null;
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
  newPurchaseListHref: Route;
  fallbackSeasonIds: string[];
  /** Hide edit affordances (used by the standalone read-only list page). */
  readOnly?: boolean;
  /** Quando informado, mostra o botão Estoque na mesma linha dos outros. */
  stockHref?: Route;
  /** Página de cotações das lojas (compartilhar link e comparar preços). */
  quotesHref?: Route;
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
  stockHref,
  quotesHref,
}: FarmPurchaseListTabProps) {
  const canListCrud = useCan("LIST_CRUD");
  const canQuoteCrud = useCan("QUOTE_CRUD");
  const canViewPrices = useCan("PRICE_VIEW");
  const effectiveReadOnly = readOnly || !canListCrud;
  const { data: producerStock } = useProducerStock(producerId ?? "");
  const stockByProductId = useMemo(() => {
    const map: Record<string, { quantity: number; price_brl: number | null }> =
      {};
    for (const s of producerStock ?? []) {
      map[s.local_product_id] = {
        quantity: Number(s.available ?? s.quantity) || 0,
        price_brl:
          s.price_brl != null && Number.isFinite(Number(s.price_brl))
            ? Number(s.price_brl)
            : null,
      };
    }
    for (const it of list?.items ?? []) {
      if (!it.local_product_id) continue;
      const existing = map[it.local_product_id];
      map[it.local_product_id] = {
        quantity: Number(it.current_stock ?? 0),
        price_brl:
          existing?.price_brl ??
          (it.price_brl_fixed != null && Number.isFinite(Number(it.price_brl_fixed))
            ? Number(it.price_brl_fixed)
            : null),
      };
    }
    return map;
  }, [producerStock, list?.items]);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ListItem[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);

  // Rede de segurança do autosave: além de gravar no servidor, guarda os itens em
  // edição no navegador (localStorage). O servidor pode falhar calado (servidor
  // free "acordando", ou item incompleto que bloqueia o autosave); o backup local
  // não. Some quando um save de verdade dá certo.
  const editDraftKey = `pl-edit:${list?.id ?? "none"}`;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDialogMode, setLeaveDialogMode] = useState<"confirm" | "saving">("confirm");
  const [leaveValidationError, setLeaveValidationError] = useState<string | null>(null);
  const [peerTakeoverOpen, setPeerTakeoverOpen] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const router = useRouter();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restoreItems, setRestoreItems] = useState<ListItem[] | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [editBaseline, setEditBaseline] = useState<ListItem[]>([]);
  const [editBaselineUpdatedAt, setEditBaselineUpdatedAt] = useState<string | null>(
    null,
  );

  const queryClient = useQueryClient();
  const { remotePeerEditing } = usePurchaseListEditChannel(list?.id, editing);
  const updateMutation = useUpdatePurchaseList(list?.id ?? "", { farmId });
  const cascadeRecommendationItemsRef = useRef(false);
  const draftItemsRef = useRef(draftItems);
  draftItemsRef.current = draftItems;

  const itemsFromList = useCallback(
    (source: PurchaseListDetail | null | undefined) =>
      (source?.items ?? []).map(detailItemToListItem),
    [],
  );

  const resetDraft = useCallback(() => {
    if (!list) {
      setDraftItems([]);
      return;
    }
    setDraftItems(itemsFromList(list));
  }, [list, itemsFromList]);

  // Reseta o estado local quando a lista selecionada muda — padrão recomendado
  // pelo React (https://react.dev/learn/you-might-not-need-an-effect) em vez de
  // setState dentro de useEffect.
  // Inicia como `undefined` (não `list?.id`) para o bloco abaixo rodar também no
  // primeiro render — inclusive quando a lista já vem do cache.
  const [trackedListId, setTrackedListId] = useState<string | undefined>(undefined);
  if (list?.id !== trackedListId) {
    setTrackedListId(list?.id);
    setEditing(false);
    setDraftItems(list ? itemsFromList(list) : []);
    setSaveState("idle");
    setSavedAt(null);
    // Havia trabalho não salvo guardado localmente? (o último autosave pode ter
    // falhado calado — servidor frio ou item incompleto.) Só oferece restaurar
    // quando o backup DIFERE do que está salvo no servidor — evita falso alarme.
    const backup = list
      ? readVersionedLocalDraft<{ items: ListItem[] }>(`pl-edit:${list.id}`)
      : null;
    const serverItems = list ? itemsFromList(list) : [];
    const hasUnsaved =
      !!backup?.data.items &&
      backup.data.items.length > 0 &&
      !draftPayloadEquals(backup.data.items, serverItems, list?.crop);
    setRestoreItems(hasUnsaved ? backup!.data.items : null);
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

  const closeLeaveDialog = () => {
    setLeaveDialogOpen(false);
    setLeaveDialogMode("confirm");
    pendingNavRef.current = null;
  };

  const discardEditsAndLeave = () => {
    const dest = pendingNavRef.current;
    pendingNavRef.current = null;
    cancelEditing();
    setLeaveDialogOpen(false);
    setLeaveDialogMode("confirm");
    if (dest) router.push(dest as Route);
  };

  const saveEditsAndLeave = async () => {
    const validationError = validateItems(draftItemsRef.current);
    if (validationError) {
      setLeaveValidationError(validationError);
      toast.error(validationError);
      return;
    }
    const dest = pendingNavRef.current;
    setLeaveDialogMode("saving");
    setLeaveDialogOpen(true);
    const ok = await saveItems({ silent: true, forLeave: true });
    if (!ok) {
      setLeaveDialogMode("confirm");
      return;
    }
    pendingNavRef.current = null;
    setLeaveDialogOpen(false);
    setLeaveDialogMode("confirm");
    setLeaveValidationError(null);
    cancelEditing();
    if (list?.cycle_id) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cyclePurchaseList(list.cycle_id),
      });
    }
    if (dest) router.push(dest as Route);
  };

  /** Abre na hora com o que já está na tela; GET pesado só em background (If-Match / KPIs). */
  const beginEditingSession = () => {
    if (!list || editing) return;
    const seedSnapshot = itemsFromList(list);
    setDraftItems(seedSnapshot);
    setEditBaseline(seedSnapshot);
    setEditBaselineUpdatedAt(list.updated_at ?? null);
    setSaveState("idle");
    setSavedAt(null);
    setEditing(true);

    const cycleId = list.cycle_id;
    if (!cycleId) return;

    void (async () => {
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: queryKeys.cyclePurchaseList(cycleId),
          queryFn: () => getPurchaseListByCycle(cycleId),
          staleTime: 45_000,
        });
        if (!fresh) return;
        applyListToCache(fresh);
        if (!draftPayloadEquals(draftItemsRef.current, seedSnapshot, list.crop)) {
          return;
        }
        const freshSeed = itemsFromList(fresh);
        setEditBaselineUpdatedAt(fresh.updated_at ?? null);
        if (!draftPayloadEquals(freshSeed, seedSnapshot, list.crop)) {
          setDraftItems(freshSeed);
          setEditBaseline(freshSeed);
          toast.message("Lista atualizada com os dados mais recentes do servidor.");
        }
      } catch {
        // Edição já aberta com o cache da visualização.
      }
    })();
  };

  const startEditing = () => {
    if (!list || editing) return;
    if (remotePeerEditing) {
      setPeerTakeoverOpen(true);
      return;
    }
    beginEditingSession();
  };

  const cancelEditing = () => {
    resetDraft();
    setEditing(false);
    // Cancelar = descartar as alterações, inclusive o backup local.
    clearLocalDraft(editDraftKey);
    setRestoreItems(null);
    setSaveState("idle");
  };

  const applyRestoredDraft = (nextDraft: ListItem[]) => {
    setDraftItems(nextDraft);
    setEditBaseline(itemsFromList(list));
    setEditBaselineUpdatedAt(list?.updated_at ?? null);
    setSaveState("idle");
    setEditing(true);
  };
  const discardBackup = () => {
    clearLocalDraft(editDraftKey);
    setRestoreItems(null);
  };

  const saveInFlightRef = useRef(false);
  const saveWaitersRef = useRef<Array<(ok: boolean) => void>>([]);
  const notifySaveWaiters = (ok: boolean) => {
    const waiters = saveWaitersRef.current;
    saveWaitersRef.current = [];
    for (const waiter of waiters) waiter(ok);
  };
  const applyListToCache = useCallback(
    (data: PurchaseListDetail) => {
      if (data.cycle_id) {
        queryClient.setQueryData(queryKeys.cyclePurchaseList(data.cycle_id), data);
      }
      if (data.producer_id) {
        queryClient.setQueryData(
          queryKeys.producerPurchaseLists(data.producer_id),
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            return old.map((row: { id: string }) => (row.id === data.id ? data : row));
          },
        );
      }
      if (farmId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.farmPurchaseLists(farmId) });
      }
    },
    [queryClient, farmId],
  );

  /** GET completo (FIFO, comprar, cost_summary) após sync leve. */
  const enrichListFromServer = useCallback(
    async (cycleId: string) => {
      const fresh = await queryClient.fetchQuery({
        queryKey: queryKeys.cyclePurchaseList(cycleId),
        queryFn: () => getPurchaseListByCycle(cycleId),
        staleTime: 0,
      });
      if (!fresh) return null;
      applyListToCache(fresh);
      return fresh;
    },
    [queryClient, applyListToCache],
  );

  const listParamsDirty = useCallback(() => {
    if (!list) return false;
    const {
      fxRate: fxRaw,
      grainPrice: grainRaw,
      spacing: spacingRaw,
    } = useCurrencyStore.getState();
    const fx = fxRaw ? Number(fxRaw) : null;
    const grain = grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL;
    const spacing = spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M;
    const serverFx = list.fx_rate_usd_brl != null ? Number(list.fx_rate_usd_brl) : null;
    const serverGrain =
      list.grain_price_brl != null ? Number(list.grain_price_brl) : DEFAULT_GRAIN_PRICE_BRL;
    const serverSpacing =
      list.spacing_m != null ? Number(list.spacing_m) : DEFAULT_SPACING_M;
    return fx !== serverFx || grain !== serverGrain || spacing !== serverSpacing;
  }, [list]);

  const saveItems = async (opts?: {
    silent?: boolean;
    /** Saída da tela: não enriquece em background (evita “sujo” antes do redirect). */
    forLeave?: boolean;
  }): Promise<boolean> => {
    if (!list) return false;
    if (saveInFlightRef.current) return false;
    const draftForSave = draftItemsRef.current;
    const validationError = validateItems(draftForSave);
    if (validationError) {
      // Autosave não grita validação no meio da digitação; o Salvar manual sim.
      if (!opts?.silent) toast.error(validationError);
      return false;
    }

    const delta = computePurchaseListItemsDelta(editBaseline, draftForSave, list.crop);
    const itemsDirty = !purchaseListDeltaIsEmpty(delta);
    const paramsDirty = listParamsDirty();
    if (!itemsDirty && !paramsDirty) {
      setSaveState("saved");
      return true;
    }

    try {
      saveInFlightRef.current = true;
      setSaveState("saving");
      const {
        fxRate: fxRaw,
        grainPrice: grainRaw,
        spacing: spacingRaw,
      } = useCurrencyStore.getState();
      let ifMatch = editBaselineUpdatedAt ?? list.updated_at ?? undefined;
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `save-${Date.now()}`;

      let updated: PurchaseListDetail = list;
      let remappedAfterSync: ListItem[] | null = null;

      if (itemsDirty) {
        const syncResult = await syncPurchaseListItems(
          list.id,
          {
            ...delta,
            cascade_recommendation_items:
              cascadeRecommendationItemsRef.current || undefined,
            skip_heavy_sync: true,
          },
          { ifMatch, idempotencyKey },
        );
        ifMatch = syncResult.updated_at;
        const remapped = remapDraftKeysFromSyncItems(
          draftItemsRef.current,
          syncResult.items,
        );
        remappedAfterSync = remapped;
        setDraftItems(remapped);
        setEditBaseline(remapped);
        setEditBaselineUpdatedAt(syncResult.updated_at);
        updated = { ...list, updated_at: syncResult.updated_at };
      }

      if (paramsDirty) {
        updated = await updatePurchaseList(
          list.id,
          {
            fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
            grain_price_brl: grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL,
            spacing_m: spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M,
          },
          { ifMatch },
        );
        applyListToCache(updated);
        const seeded = itemsFromList(updated);
        setDraftItems(seeded);
        setEditBaseline(seeded);
        setEditBaselineUpdatedAt(updated.updated_at ?? null);
      } else if (itemsDirty && list.cycle_id) {
        queryClient.setQueryData(
          queryKeys.cyclePurchaseList(list.cycle_id),
          (old: PurchaseListDetail | null | undefined) =>
            old ? { ...old, updated_at: updated.updated_at } : old,
        );
      }

      if ((itemsDirty || paramsDirty) && list.cycle_id && !opts?.forLeave) {
        const enrichGuardBaseline = remappedAfterSync;
        void enrichListFromServer(list.cycle_id).then((fresh) => {
          if (!fresh) return;
          if (
            enrichGuardBaseline &&
            !draftPayloadEquals(
              draftItemsRef.current,
              enrichGuardBaseline,
              list.crop,
            )
          ) {
            return;
          }
          const seeded = itemsFromList(fresh);
          setDraftItems(seeded);
          setEditBaseline(seeded);
          setEditBaselineUpdatedAt(fresh.updated_at ?? null);
        });
      }
      setSaveState("saved");
      setSavedAt(new Date());
      clearLocalDraft(editDraftKey);
      setRestoreItems(null);
      if (!opts?.silent) {
        toast.success("Lista de compra atualizada.");
        setEditing(false);
      }
      notifySaveWaiters(true);
      return true;
    } catch (e) {
      // NÃO engole o erro: marca "não salvo" (o backup local continua guardado).
      setSaveState("error");
      const code = apiErrorCode(e);
      if (code === "LIST_VERSION_CONFLICT") {
        toast.error(
          "A lista mudou em outro lugar ou em outra aba. Recarregamos os dados do servidor.",
          { duration: 8000 },
        );
        if (list.cycle_id) {
          try {
            const fresh = await getPurchaseListByCycle(list.cycle_id);
            if (fresh) {
              applyListToCache(fresh);
              const seeded = itemsFromList(fresh);
              setDraftItems(seeded);
              setEditBaseline(seeded);
              setEditBaselineUpdatedAt(fresh.updated_at ?? null);
            }
          } catch {
            // mantém draft local
          }
        }
        notifySaveWaiters(false);
        return false;
      }
      if (
        code === "LIST_ITEM_REMOVAL_BLOCKED" ||
        code === "LIST_ITEM_REMOVAL_NEEDS_CONFIRM"
      ) {
        toast.error(apiErrorMessage(e, "Não foi possível remover o produto da lista."));
        resetDraft();
        cascadeRecommendationItemsRef.current = false;
        notifySaveWaiters(false);
        return false;
      }
      if (apiHttpStatus(e) === 401) {
        toast.error(
          "Sessão expirada. Suas alterações continuam guardadas neste navegador — faça login e use Salvar.",
          { duration: 8000 },
        );
      } else if (!opts?.silent) {
        toast.error(apiErrorMessage(e, "Não foi possível salvar a lista."));
      }
      notifySaveWaiters(false);
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  };

  // Salva SÓ as metas por categoria. Envia apenas `category_targets`: sem
  // `items`/`plots` no payload, o backend não toca nos produtos nem nos talhões.
  const saveTargets = async (targets: Record<string, number>) => {
    if (!list) return;
    setSavingTargets(true);
    try {
      await updateMutation.mutateAsync({ category_targets: targets });
      toast.success("Metas atualizadas.");
      setTargetsOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar as metas."));
    } finally {
      setSavingTargets(false);
    }
  };

  // Visualização: estoque = galpão − reserva de outras safras.
  const viewItems = useMemo(
    () => itemsFromList(list),
    [itemsFromList, list],
  );

  // Autosave dos itens em edição: persiste sozinho após pausa na digitação,
  // mantendo o modo de edição aberto (o Salvar manual continua como está). O
  // efeito depende de `draftItems`, então o closure já tem sempre o valor atual.
  //
  // Só grava se o rascunho DIFERE do que está no servidor. Sem essa trava, abrir
  // a edição e esperar 2,5s já disparava um save do estado semeado — se esse
  // estado viesse de um cache velho, o servidor era sobrescrito com dados antigos.
  // Compara pelo PAYLOAD, não pelo estado bruto: itens recém-adicionados têm
  // chave local (`i-…`) enquanto os do servidor têm o id do banco, então comparar
  // `draftItems` com `viewItems` diretamente daria "sujo" para sempre — e o
  // autosave entraria em laço (salva → refetch → salva…).
  const fxRateStore = useCurrencyStore((state) => state.fxRate);
  const grainPriceStore = useCurrencyStore((state) => state.grainPrice);
  const spacingStore = useCurrencyStore((state) => state.spacing);

  const draftIsDirty = useMemo(() => {
    if (!editing) return false;
    const itemsChanged = !draftPayloadEquals(draftItems, editBaseline, list?.crop);
    if (itemsChanged) return true;
    const fx = fxRateStore ? Number(fxRateStore) : null;
    const grain = grainPriceStore ? Number(grainPriceStore) : DEFAULT_GRAIN_PRICE_BRL;
    const spacing = spacingStore ? Number(spacingStore) : DEFAULT_SPACING_M;
    const serverFx = list?.fx_rate_usd_brl != null ? Number(list.fx_rate_usd_brl) : null;
    const serverGrain =
      list?.grain_price_brl != null
        ? Number(list.grain_price_brl)
        : DEFAULT_GRAIN_PRICE_BRL;
    const serverSpacing =
      list?.spacing_m != null ? Number(list.spacing_m) : DEFAULT_SPACING_M;
    return fx !== serverFx || grain !== serverGrain || spacing !== serverSpacing;
  }, [
    editing,
    draftItems,
    editBaseline,
    viewItems,
    list?.crop,
    list?.fx_rate_usd_brl,
    list?.grain_price_brl,
    list?.spacing_m,
    fxRateStore,
    grainPriceStore,
    spacingStore,
  ]);
  const dirtyRef = useRef(false);
  const saveItemsRef = useRef(saveItems);
  dirtyRef.current = draftIsDirty;
  saveItemsRef.current = saveItems;
  useLeaveBusyGuard(
    {
      isBusy: () =>
        editing &&
        (leaveDialogOpen ||
          dirtyRef.current ||
          saveInFlightRef.current ||
          saveState === "saving"),
      flush: async (destination?: string) => {
        if (leaveDialogOpen) {
          if (destination) pendingNavRef.current = destination;
          return false;
        }
        pendingNavRef.current = destination ?? null;
        if (saveInFlightRef.current) {
          setLeaveDialogMode("saving");
          setLeaveDialogOpen(true);
          const ok = await new Promise<boolean>((resolve) => {
            saveWaitersRef.current.push(resolve);
          });
          if (!ok) {
            setLeaveValidationError(validateItems(draftItemsRef.current));
            setLeaveDialogMode("confirm");
            return false;
          }
          setLeaveDialogOpen(false);
          setLeaveDialogMode("confirm");
          pendingNavRef.current = null;
          return true;
        }
        if (!dirtyRef.current) {
          pendingNavRef.current = null;
          return true;
        }
        setLeaveValidationError(validateItems(draftItemsRef.current));
        setLeaveDialogMode("confirm");
        setLeaveDialogOpen(true);
        return false;
      },
      setLeaveUi: () => {},
    },
    Boolean(
      editing && (leaveDialogOpen || draftIsDirty || saveState === "saving"),
    ),
  );
  useEffect(() => {
    if (!PURCHASE_LIST_AUTOSAVE_ENABLED) return;
    if (!editing || !list || draftItems.length === 0 || !draftIsDirty) return;
    if (saveInFlightRef.current || saveState === "saving") return;
    const timer = setTimeout(() => {
      if (validateItems(draftItems) === null) {
        const delta = computePurchaseListItemsDelta(
          editBaseline,
          draftItemsRef.current,
          list.crop,
        );
        const appendOnly =
          delta.append.length > 0 &&
          delta.update.length === 0 &&
          delta.remove.length === 0;
        if (!appendOnly) {
          void saveItems({ silent: true });
        }
      }
    }, PURCHASE_LIST_AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftItems, editing, list?.id, draftIsDirty, saveState]);

  // Backup local contínuo (400ms) enquanto edita — guarda QUALQUER estado, mesmo
  // inválido ou incompleto, então nada se perde se o autosave do servidor falhar.
  useEffect(() => {
    if (!editing || !list) return;
    const id = setTimeout(
      () =>
        writeVersionedLocalDraft(
          editDraftKey,
          { items: draftItems },
          { listUpdatedAt: editBaselineUpdatedAt ?? list.updated_at ?? null },
        ),
      400,
    );
    return () => clearTimeout(id);
  }, [editDraftKey, draftItems, editing, list, editBaselineUpdatedAt]);

  // Trava: editando e ainda não confirmado como salvo → avisa antes de sair.
  useUnsavedChangesWarning(editing && draftIsDirty);

  const totalHa = list?.total_hectares ?? 0;
  const fxRate = useCurrencyStore((state) => state.fxRate);
  const fx = Number(fxRate) || 0;
  const grainPrice = useCurrencyStore((state) => state.grainPrice);
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;

  const kpis = useMemo(() => {
    const base = computePurchaseListMetrics(
      editing ? draftItems : viewItems,
      totalHa,
      fx,
      saca,
    );
    return applyManualTotalSpent(
      base,
      list?.manual_total_spent_brl,
      saca,
      totalHa,
    );
  }, [editing, draftItems, viewItems, totalHa, fx, saca, list?.manual_total_spent_brl]);
  const manualTotalLabel = usesManualListTotal(
    kpis,
    list?.manual_total_spent_brl,
  );
  const hasPendingBuy = (list?.items ?? []).some(
    (it) => (it.quantity_to_buy ?? 0) > 1e-9,
  );

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
        <PageHero
          sticky
          className="mb-7"
          icon={<Leaf className="size-6" />}
          eyebrow="Lista de compra"
          title="Nenhuma lista cadastrada"
          actions={
            canListCrud ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={newPurchaseListHref}>
                  <Plus className="h-4 w-4" />
                  Montar lista
                </Link>
              </Button>
            ) : undefined
          }
        />

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

  /** Link do herói: editando, vira botão desligado (âncora não desabilita). */
  const linkAction = (href: Route, icon: ReactNode, label: string) =>
    editing ? (
      <Button variant="outline" size="sm" className="gap-1.5" disabled>
        {icon}
        {label}
      </Button>
    ) : (
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href={href}>
          {icon}
          {label}
        </Link>
      </Button>
    );

  return (
    <div className="flex flex-col gap-5">
      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (!open && leaveDialogMode !== "saving") closeLeaveDialog();
        }}
      >
        <DialogContent
          showCloseButton={leaveDialogMode !== "saving"}
          className="gap-0 p-0 sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (leaveDialogMode === "saving") event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (leaveDialogMode === "saving") event.preventDefault();
          }}
        >
          {leaveDialogMode === "saving" ? (
            <DialogHeader className="items-center border-0 py-10 text-center">
              <Loader2 className="mb-2 size-10 animate-spin text-primary" aria-hidden />
              <DialogTitle>Salvando…</DialogTitle>
              <DialogDescription>
                Aguarde terminar antes de sair. Não feche esta aba.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Alterações não salvas</DialogTitle>
                <DialogDescription>
                  Você ainda está editando a lista. Escolha o que fazer antes de sair
                  desta tela.
                  {leaveValidationError ? (
                    <span className="mt-2 block font-medium text-warning-strong">
                      {leaveValidationError}
                    </span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button type="button" variant="outline" onClick={closeLeaveDialog}>
                  Continuar editando
                </Button>
                <Button type="button" variant="outline" onClick={discardEditsAndLeave}>
                  Descartar e sair
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveEditsAndLeave()}
                  disabled={Boolean(leaveValidationError)}
                >
                  Salvar e sair
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={peerTakeoverOpen} onOpenChange={setPeerTakeoverOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lista aberta em outra janela</DialogTitle>
            <DialogDescription>
              Esta lista já está em edição em outra aba deste navegador. Se editar nas
              duas ao mesmo tempo, uma aba pode sobrescrever a outra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPeerTakeoverOpen(false)}>
              Continuar só visualizando
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPeerTakeoverOpen(false);
                beginEditingSession();
              }}
            >
              Editar nesta aba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {purchaseLists.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Lista</span>
          <Select
            value={selectedListId}
            onValueChange={onSelectList}
            className="min-w-[220px]"
            disabled={editing || saveState === "saving"}
            options={purchaseLists.map((l) => ({
              value: l.id,
              label: `${l.name}${l.variety ? ` — ${l.variety}` : ""}${
                l.status === "draft" ? " (rascunho)" : ""
              }`,
            }))}
          />
        </div>
      ) : null}

      <PageHero
        variant="inverted"
        className="mb-7"
        icon={<Leaf className="size-6" />}
        eyebrow={`Lista de compra · ${list.name}${
          list.status === "draft" ? " · rascunho" : ""
        }`}
        title={`${CROP_LABELS[list.crop ?? "ANY"] ?? list.crop ?? "Multi-cultura"}${
          list.variety ? ` · ${list.variety}` : ""
        }`}
        actions={
          // Editando, os botões continuam à vista — desligados, para a barra do
          // herói não mudar de tamanho a cada entrada e saída da edição.
          (
            <>
              {canQuoteCrud && list.status !== "draft" ? (
                <FulfillWithoutQuoteButton
                  listId={list.id}
                  pending={hasPendingBuy}
                  variant="clay"
                  disabled={editing}
                />
              ) : null}
              {/* Sempre disponível: a lista muda com o tempo e o agrônomo precisa
                  poder salvar as alterações como template (antes só na criação). */}
              {!effectiveReadOnly && hasItems ? (
                <SavePurchaseListTemplateButton
                  items={viewItems}
                  crop={list.crop ?? "ANY"}
                  suggestedName={list.name}
                  iconOnly
                  disabled={editing}
                />
              ) : null}
              <IconActionButton
                label="Exportar"
                icon={<Share2 className="h-4 w-4" />}
                className={EXPORT_ACTION_CLASS}
                onClick={() => setExportOpen(true)}
                disabled={editing}
              />
            </>
          )
        }
        statsActions={
          <>
            {canQuoteCrud && quotesHref
              ? linkAction(quotesHref, <Store className="h-4 w-4" />, "Cotações")
              : null}
            {stockHref
              ? linkAction(stockHref, <Boxes className="h-4 w-4" />, "Estoque")
              : null}
          </>
        }
        stats={[
          ...(canViewPrices
            ? [
                {
                  label: manualTotalLabel
                    ? "Total gasto (informado)"
                    : "Valor total",
                  value: kpis.totalValue > 0 ? fmtBrl(kpis.totalValue) : "—",
                  wide: true,
                },
                {
                  label: "Volume de sacas",
                  value:
                    kpis.totalSacks > 0 ? `${fmtQty(kpis.totalSacks)} sc` : "—",
                },
                {
                  label: "Custo (sc/ha)",
                  value:
                    kpis.costSacksPerHa > 0
                      ? `${fmtQty(kpis.costSacksPerHa)} sc/ha`
                      : "—",
                },
              ]
            : []),
          { label: "Produtos", value: String(kpis.productsCount) },
          { label: "Hectares", value: `${fmtQty(totalHa)} ha` },
          { label: "Talhões", value: (list.plots ?? []).length },
        ]}
      >
        {/* Dólar, saca e espaçamento alimentam as contas da tabela — ficam no
            herói, numa linha abaixo das métricas. */}
        <PurchaseListParamsRow
          items={editing ? draftItems : viewItems}
          totalHa={totalHa}
          readOnly={!editing}
          variant="plain"
          inverted
        />
      </PageHero>

      {remotePeerEditing && !editing ? (
        <div className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          Esta lista está em edição em outra aba do navegador. Abra só uma janela para
          editar ou você pode sobrescrever alterações.
        </div>
      ) : null}
      {remotePeerEditing && editing ? (
        <div className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          Outra aba também está editando esta lista. Salve com cuidado para não
          sobrescrever alterações.
        </div>
      ) : null}

      {restoreItems && !editing && !effectiveReadOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <span className="flex min-w-0 flex-col gap-1">
            <span>
              Há alterações <strong>não salvas no servidor</strong> guardadas só neste
              navegador (localStorage). Isso <strong>não</strong> chama a API até você
              Salvar — mas pode explicar produtos que “aparecem do nada” se você
              recuperar um rascunho antigo.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="clay"
              className="gap-1.5"
              onClick={() => setRestoreDialogOpen(true)}
            >
              Ver alterações
            </Button>
            <Button size="sm" variant="outline" onClick={discardBackup}>
              Descartar
            </Button>
          </span>
        </div>
      ) : null}

      {restoreItems && list ? (
        <PurchaseListDraftRestoreDialog
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          serverItems={viewItems}
          backupItems={restoreItems}
          listCrop={list.crop}
          onConfirm={(draft) => {
            applyRestoredDraft(draft);
            setRestoreDialogOpen(false);
          }}
        />
      ) : null}

      {saveState === "error" && editing ? (
        <div className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          Não foi possível salvar agora — suas alterações estão{" "}
          <strong>guardadas neste navegador</strong>. Tente <strong>Salvar</strong> de
          novo em alguns segundos.
        </div>
      ) : null}

      {/* Metas e gastos por categoria: card sempre à vista, entre o herói e
          as tabelas — mesmo sem preço nem meta, para "Editar metas" estar à
          mão. Meta única (sc/ha) ganha a barra Real × Meta em cima; metas
          antigas por categoria seguem na tabela Realizado × Meta. */}
      {canViewPrices ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {!editing && !effectiveReadOnly ? (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTargetsOpen(true)}
                >
                  <Target className="h-4 w-4" />
                  Editar metas
                </Button>
              </div>
            ) : null}
            {hasSingleTotalTarget(list.category_targets ?? {}) ? (
              <CategoryMetaProgress
                items={editing ? draftItems : viewItems}
                totalHa={totalHa}
                targets={list.category_targets ?? {}}
              />
            ) : null}
          </div>
          <CategoryDistributionPanel
            breakdown={kpis.categoryBreakdown}
            targets={
              hasSingleTotalTarget(list.category_targets ?? {})
                ? undefined
                : (list.category_targets ?? {})
            }
          />
        </div>
      ) : null}

      {hasItems || editing ? (
        <div className="space-y-4">
          <PurchaseListItemsEditor
            hideParams
            tabsActions={
              editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SaveStatus state={saveState} savedAt={savedAt} dirty={draftIsDirty} />
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
                    disabled={updateMutation.isPending || saveState === "saving"}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              ) : !effectiveReadOnly ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => startEditing()}
                >
                  <Pencil className="h-4 w-4" />
                  Editar Lista de Compras
                </Button>
              ) : undefined
            }
            items={editing ? draftItems : viewItems}
            setItems={setDraftItems}
            readOnly={!editing}
            totalHa={totalHa}
            crop={list.crop as "SOYBEAN" | "CORN" | "ANY"}
            stockByProductId={stockByProductId}
            listId={list.id}
            onRemovalCascadeArmed={() => {
              cascadeRecommendationItemsRef.current = true;
            }}
            onItemsPersistedToServer={(next) => {
              setEditBaseline(next);
              setSaveState("saved");
              if (list.cycle_id) {
                void enrichListFromServer(list.cycle_id);
              }
            }}
            />
        </div>
      ) : (
        <EmptyState
          title={`A lista "${list.name}" ainda não tem produtos cadastrados.`}
          action={
            !effectiveReadOnly ? (
              <Button size="sm" className="gap-1.5" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Adicionar produtos
              </Button>
            ) : undefined
          }
        />
      )}

      <PurchaseListExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        list={list}
      />

      <PurchaseListTargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        initialTargets={list.category_targets ?? {}}
        totalHa={totalHa}
        onSave={saveTargets}
        saving={savingTargets}
      />
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
