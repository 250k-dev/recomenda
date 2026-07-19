"use client";

import { routes } from "@recomenda/config";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Eye, FileDown, Leaf, Pencil, Plus, Store, Target, X, Check, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { PageHero } from "@/components/domain/page-hero";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/domain/season/_shared";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useCurrencyStore,
  DEFAULT_GRAIN_PRICE_BRL,
  DEFAULT_SPACING_M,
} from "@/stores/currency";
import {
  computePurchaseListMetrics,
  detailItemToListItem,
} from "@recomenda/domain/purchase-list/breakdown";
import {
  readLocalDraft,
  clearLocalDraft,
  useLocalDraft,
} from "@/lib/use-local-draft";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import { CategoryDistributionPanel } from "@/components/domain/category-distribution-panel";
import {
  CategoryMetaProgress,
  hasSingleTotalTarget,
} from "@/components/domain/category-meta-progress";
import {
  useFarmAggregatedShoppingList,
  useUpdatePurchaseList,
} from "@/lib/api/hooks";
import { useProducerStock } from "@/lib/api/hooks/producers";
import type { ListItem } from "@recomenda/domain/purchase-list/list-item";
import {
  listItemToPayload,
  validateListItems,
} from "@recomenda/domain/purchase-list/list-item";
import type { PurchaseListDetail, PurchaseListItemInput } from "@recomenda/api";
import { CROP_LABELS } from "@recomenda/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ShareQuoteSheet } from "@/components/domain/share-quote-sheet";
import { QuoteComparisonSection } from "@/components/domain/quote-comparison-section";
import { PurchaseListExportDialog } from "@/components/domain/purchase-list-export-dialog";
import { useCan } from "@/lib/auth/use-can";
import { PurchaseListTargetsDialog } from "@/components/domain/purchase-list-targets-dialog";
import { SavePurchaseListTemplateButton } from "@/components/domain/save-purchase-list-template-dialog";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Indicador do estado do autosave durante a edição da lista. */
function SaveStatus({
  state,
  savedAt,
}: {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
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
  /** Quando embutido na safra (sem abas), abre o plano de custo agregado. */
  onOpenCostPlan?: () => void;
  /** Quando informado, mostra o botão Estoque na mesma linha dos outros. */
  stockHref?: Route;
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
  onOpenCostPlan,
  stockHref,
}: FarmPurchaseListTabProps) {
  const canListCrud = useCan("LIST_CRUD");
  const canQuoteCrud = useCan("QUOTE_CRUD");
  const effectiveReadOnly = readOnly || !canListCrud;
  const { data: producerStock } = useProducerStock(producerId ?? "");
  const stockByProductId = useMemo(
    () =>
      Object.fromEntries(
        (producerStock ?? []).map((s) => [s.local_product_id, s.quantity]),
      ),
    [producerStock],
  );
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<ListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const quotesSectionRef = useRef<HTMLDivElement>(null);

  // Rede de segurança do autosave: além de gravar no servidor, guarda os itens em
  // edição no navegador (localStorage). O servidor pode falhar calado (servidor
  // free "acordando", ou item incompleto que bloqueia o autosave); o backup local
  // não. Some quando um save de verdade dá certo.
  const editDraftKey = `pl-edit:${list?.id ?? "none"}`;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restoreItems, setRestoreItems] = useState<ListItem[] | null>(null);

  const toggleQuotesComparison = useCallback(() => {
    setShowComparison((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          quotesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  }, []);

  const updateMutation = useUpdatePurchaseList(list?.id ?? "", { farmId });

  const resetDraft = useCallback(() => {
    if (!list) {
      setDraftItems([]);
      return;
    }
    setDraftItems((list.items ?? []).map(detailItemToListItem));
  }, [list]);

  // Reseta o estado local quando a lista selecionada muda — padrão recomendado
  // pelo React (https://react.dev/learn/you-might-not-need-an-effect) em vez de
  // setState dentro de useEffect.
  // Inicia como `undefined` (não `list?.id`) para o bloco abaixo rodar também no
  // primeiro render — inclusive quando a lista já vem do cache.
  const [trackedListId, setTrackedListId] = useState<string | undefined>(undefined);
  if (list?.id !== trackedListId) {
    setTrackedListId(list?.id);
    setError(null);
    setShowComparison(false);
    setEditing(false);
    setDraftItems(list ? (list.items ?? []).map(detailItemToListItem) : []);
    setSaveState("idle");
    setSavedAt(null);
    // Havia trabalho não salvo guardado localmente? (o último autosave pode ter
    // falhado calado — servidor frio ou item incompleto.) Só oferece restaurar
    // quando o backup DIFERE do que está salvo no servidor — evita falso alarme.
    const backup = list
      ? readLocalDraft<{ items: ListItem[] }>(`pl-edit:${list.id}`)
      : null;
    const serverItems = list
      ? (list.items ?? []).map(detailItemToListItem)
      : [];
    const hasUnsaved =
      !!backup?.items &&
      backup.items.length > 0 &&
      JSON.stringify(backup.items) !== JSON.stringify(serverItems);
    setRestoreItems(hasUnsaved ? backup!.items : null);
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

  const startEditing = () => {
    if (!list) return;
    setDraftItems((list.items ?? []).map(detailItemToListItem));
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    resetDraft();
    setEditing(false);
    // Cancelar = descartar as alterações, inclusive o backup local.
    clearLocalDraft(editDraftKey);
    setRestoreItems(null);
    setSaveState("idle");
  };

  // Restaura alterações não salvas guardadas no navegador (abre em modo edição).
  const restoreBackup = () => {
    if (!restoreItems) return;
    setDraftItems(restoreItems);
    setError(null);
    setSaveState("idle");
    setEditing(true);
  };
  const discardBackup = () => {
    clearLocalDraft(editDraftKey);
    setRestoreItems(null);
  };

  const saveItems = async (opts?: { silent?: boolean }) => {
    if (!list) return;
    setError(null);
    const validationError = validateItems(draftItems);
    if (validationError) {
      // Autosave não grita validação no meio da digitação; o Salvar manual sim.
      if (!opts?.silent) setError(validationError);
      return;
    }

    try {
      setSaveState("saving");
      const {
        fxRate: fxRaw,
        grainPrice: grainRaw,
        spacing: spacingRaw,
      } = useCurrencyStore.getState();
      // NÃO envia `plots`: esta tela edita ITENS. Os talhões da lista vêm da
      // cobertura da safra (ou do retrato gravado na criação) e não devem ser
      // reescritos aqui — mandar uma lista vazia (cache velho) apagava os
      // talhões no servidor e zerava a área, quebrando o cálculo dos defensivos.
      await updateMutation.mutateAsync({
        items: listItemsToPayload(draftItems, list.crop),
        fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
        grain_price_brl: grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL,
        spacing_m: spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M,
      });
      // Salvou de verdade no servidor: pode descartar o backup local.
      setSaveState("saved");
      setSavedAt(new Date());
      clearLocalDraft(editDraftKey);
      setRestoreItems(null);
      if (!opts?.silent) {
        toast.success("Lista de compra atualizada.");
        setEditing(false);
      }
    } catch (e) {
      // NÃO engole o erro: marca "não salvo" (o backup local continua guardado).
      setSaveState("error");
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar a lista.");
      }
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
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar as metas.",
      );
    } finally {
      setSavingTargets(false);
    }
  };

  // Itens como estão no servidor (fonte da verdade da visualização).
  const viewItems = useMemo(
    () => (list?.items ?? []).map(detailItemToListItem),
    [list?.items],
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
  const draftIsDirty = useMemo(
    () =>
      JSON.stringify(listItemsToPayload(draftItems, list?.crop)) !==
      JSON.stringify(listItemsToPayload(viewItems, list?.crop)),
    [draftItems, viewItems, list?.crop],
  );
  useEffect(() => {
    if (!editing || !list || draftItems.length === 0 || !draftIsDirty) return;
    const timer = setTimeout(() => {
      if (validateItems(draftItems) === null) {
        void saveItems({ silent: true });
      }
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftItems, editing, list?.id, draftIsDirty]);

  // Backup local contínuo (400ms) enquanto edita — guarda QUALQUER estado, mesmo
  // inválido ou incompleto, então nada se perde se o autosave do servidor falhar.
  useLocalDraft(editDraftKey, { items: draftItems }, editing && Boolean(list));

  // Trava: editando e ainda não confirmado como salvo → avisa antes de sair.
  useUnsavedChangesWarning(editing && saveState !== "saved");

  const totalHa = list?.total_hectares ?? 0;
  const fxRate = useCurrencyStore((state) => state.fxRate);
  const fx = Number(fxRate) || 0;
  const grainPrice = useCurrencyStore((state) => state.grainPrice);
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;

  const kpis = useMemo(() => {
    return computePurchaseListMetrics(
      editing ? draftItems : viewItems,
      totalHa,
      fx,
      saca,
    );
  }, [editing, draftItems, viewItems, totalHa, fx, saca]);

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

  return (
    <div className="flex flex-col gap-5">
      {purchaseLists.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Lista</span>
          <Select
            value={selectedListId}
            onValueChange={onSelectList}
            className="min-w-[220px]"
            disabled={editing}
            options={purchaseLists.map((l) => ({
              value: l.id,
              label: `${l.name}${l.variety ? ` — ${l.variety}` : ""}`,
            }))}
          />
        </div>
      ) : null}

      <PageHero
        className="mb-7"
        icon={<Leaf className="size-6" />}
        eyebrow={`Lista de compra · ${list.name}`}
        title={`${CROP_LABELS[list.crop ?? "ANY"] ?? list.crop ?? "Multi-cultura"}${
          list.variety ? ` · ${list.variety}` : ""
        }`}
        actions={
          editing ? (
            <>
              <SaveStatus state={saveState} savedAt={savedAt} />
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
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <>
              {!effectiveReadOnly ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                  Editar lista
                </Button>
              ) : null}
              {!effectiveReadOnly ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTargetsOpen(true)}
                >
                  <Target className="h-4 w-4" />
                  Editar metas
                </Button>
              ) : null}
              {/* Sempre disponível: a lista muda com o tempo e o agrônomo precisa
                  poder salvar as alterações como template (antes só na criação). */}
              {!effectiveReadOnly && hasItems ? (
                <SavePurchaseListTemplateButton
                  items={viewItems}
                  crop={list.crop ?? "ANY"}
                  suggestedName={list.name}
                  size="sm"
                />
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setExportOpen(true)}
              >
                <FileDown className="h-4 w-4" />
                Exportar
              </Button>
              {canQuoteCrud ? (
                <ShareQuoteSheet listId={list.id} listName={list.name} />
              ) : null}
              {canQuoteCrud ? (
              <Button
                variant={showComparison ? "clay" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={toggleQuotesComparison}
              >
                <Store className="h-4 w-4" />
                Cotações das lojas
              </Button>
              ) : null}
              {/* Sem barra de abas, este é o caminho para o plano de custo da
                  safra. Embutido usa o callback (troca de view sem recarregar);
                  no modo avulso, o link direto para o plano do talhão. */}
              {onOpenCostPlan ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onOpenCostPlan}
                >
                  <Eye className="h-4 w-4" />
                  Ver plano de custo
                </Button>
              ) : list.season_id ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={routes.safras.planoDeCusto(list.season_id)}>
                    <Eye className="h-4 w-4" />
                    Ver plano de custo
                  </Link>
                </Button>
              ) : null}
              {stockHref ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={stockHref}>
                    <Boxes className="h-4 w-4" />
                    Estoque
                  </Link>
                </Button>
              ) : null}
            </>
          )
        }
        stats={[
          {
            label: "Valor total",
            value: kpis.totalValue > 0 ? fmtBrl(kpis.totalValue) : "—",
          },
          {
            label: "Volume de sacas",
            value: kpis.totalSacks > 0 ? `${fmtQty(kpis.totalSacks)} sc` : "—",
          },
          {
            label: "Custo (sc/ha)",
            value: kpis.costSacksPerHa > 0 ? `${fmtQty(kpis.costSacksPerHa)} sc/ha` : "—",
          },
          { label: "Produtos", value: String(kpis.productsCount) },
          { label: "Hectares", value: `${fmtQty(totalHa)} ha` },
          { label: "Talhões", value: (list.plots ?? []).length },
        ]}
      />

      {restoreItems && !editing && !effectiveReadOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <span className="flex items-center gap-2">
            Há alterações desta lista <strong>não salvas</strong> guardadas neste
            navegador (o último salvamento pode ter falhado). Quer recuperá-las?
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="clay" className="gap-1.5" onClick={restoreBackup}>
              Recuperar
            </Button>
            <Button size="sm" variant="outline" onClick={discardBackup}>
              Descartar
            </Button>
          </span>
        </div>
      ) : null}

      {saveState === "error" && editing ? (
        <div className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          Não foi possível salvar no servidor agora — suas alterações estão{" "}
          <strong>guardadas neste navegador</strong>. Tente <strong>Salvar</strong>{" "}
          de novo em alguns segundos (o servidor pode estar reativando).
        </div>
      ) : null}

      {hasItems || editing ? (
        <div className="space-y-4">
          {editing ? (
            <p className="text-sm text-muted-foreground">
              Adicione, edite ou remova produtos. As quantidades são calculadas por dose/ha ×{" "}
              {fmtQty(totalHa)} ha × nº de aplicações.
            </p>
          ) : null}
          {/* Meta única (sc/ha): barra Real × Meta; a distribuição por categoria
              continua abaixo, sem coluna de meta. Metas antigas por categoria
              seguem na tabela Realizado × Meta de sempre. */}
          {hasSingleTotalTarget(list.category_targets ?? {}) ? (
            <CategoryMetaProgress
              items={editing ? draftItems : viewItems}
              totalHa={totalHa}
              targets={list.category_targets ?? {}}
            />
          ) : null}
          {kpis.categoryBreakdown.length > 0 ||
          Object.values(list.category_targets ?? {}).some((v) => (v ?? 0) > 0) ? (
            <CategoryDistributionPanel
              breakdown={kpis.categoryBreakdown}
              targets={
                hasSingleTotalTarget(list.category_targets ?? {})
                  ? undefined
                  : (list.category_targets ?? {})
              }
            />
          ) : null}
          <PurchaseListItemsEditor
            items={editing ? draftItems : viewItems}
            setItems={setDraftItems}
            readOnly={!editing}
            totalHa={totalHa}
            crop={list.crop as "SOYBEAN" | "CORN" | "ANY"}
            stockByProductId={stockByProductId}
          />
          {error ? (
            <div className="max-w-xl">
              <FieldError message={error} />
            </div>
          ) : null}
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

      {!editing && showComparison ? (
        <div ref={quotesSectionRef} className="scroll-mt-24 space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary-strong" />
            <h3 className="font-display text-base font-semibold text-text-strong">
              Cotações das lojas
            </h3>
            <span className="text-xs text-muted-foreground">
              · preços por loja (somente você vê esta comparação)
            </span>
          </div>
          <QuoteComparisonSection listId={list.id} listName={list.name} />
        </div>
      ) : null}

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
