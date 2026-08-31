"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, LayoutTemplate, Leaf, ListOrdered, Pencil, Plus, Send, Share2 } from "lucide-react";
import { PageHero } from "@/components/domain/page-hero";
import { TimelineCardsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { Button } from "@recomenda/ui/primitives/button";
import {
  useCreateRecommendation,
  useCycle,
  useCyclePurchaseList,
  useMe,
  useProducer,
  useReorderRecommendations,
  useSeason,
  useSeasonTimeline,
} from "@recomenda/api-hooks";
import { CROP_LABELS } from "@recomenda/utils";
import { useCan } from "@recomenda/api-hooks/use-can";
import { usePurchaseListCatalogProducts } from "@/components/domain/timing/timing-stages-editor";
import type { Recommendation } from "@recomenda/api";
import {
  RecommendationStageFields,
  type RecommendationStageDraft,
} from "@/components/domain/recommendation-stage-fields";
import { todayLocalYmd } from "@recomenda/domain/timing/window-days";
import { extractError } from "@/components/domain/season/_shared";
import { RecommendationCard } from "@/components/domain/season/recommendation-card";
import { RecommendationExportDialog } from "@/components/domain/season/recommendation-export-dialog";
import { PlantingDateRegisterPopover } from "@/components/domain/season/planting-date-register-popover";
import { SeasonMixOrderDialog } from "@/components/domain/season/season-mix-order-dialog";
import { EditSeasonCropDialog } from "@/components/domain/season/edit-season-crop-dialog";
import { ApplySeasonTemplateDialog } from "@/components/domain/season/apply-season-template-dialog";
import { fmtDate } from "@recomenda/domain/recommendations/format";
import type { FormulationKey } from "@recomenda/domain/recommendations/formulation-mix-order";
import { routes } from "@recomenda/config";

/**
 * Card da âncora de plantio — primeiro item visual do cronograma (não é uma
 * recommendation; ao salvar, o servidor recalcula as datas das etapas PENDING).
 */
function PlantingDateBlock({
  seasonId,
  plantingDate: plantingDateProp,
  canManage,
}: {
  seasonId: string;
  plantingDate?: string | null;
  canManage: boolean;
}) {
  // Lê direto do cache da safra (atualizado no PATCH) — não depende só da prop
  // do page, que pode ficar stale se o layout/página não re-renderizar a tempo.
  const { data: season } = useSeason(seasonId);
  const raw = season?.planting_date ?? plantingDateProp;
  const plantingDate = raw ? String(raw).slice(0, 10) : null;
  const hasDate = Boolean(plantingDate);

  return (
    <li
      className={
        hasDate
          ? "rounded-xl border border-border bg-card shadow-sm"
          : "rounded-xl border-2 border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/15"
      }
    >
      <div className="flex w-full flex-wrap items-center gap-3 px-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-sm font-bold tabular-nums text-muted-foreground">
          <CalendarDays className="size-4 text-primary-strong" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-strong">Plantio</p>
            <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Âncora do cronograma
            </span>
          </div>
          {hasDate ? (
            <p className="mt-1 text-sm tabular-nums text-foreground">
              Data registrada:{" "}
              <span className="font-semibold">{fmtDate(plantingDate!)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Sem data registrada — as etapas usam esta data para calcular o DAP.
            </p>
          )}
        </div>
        {canManage ? (
          <PlantingDateRegisterPopover
            seasonId={seasonId}
            currentPlantingDate={plantingDate}
            mode={hasDate ? "edit" : "register"}
            trigger={
              <Button
                size="sm"
                variant={hasDate ? "outline" : "default"}
                className="h-8 gap-1.5 shrink-0"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {hasDate ? "Alterar data" : "Adicionar data"}
              </Button>
            }
          />
        ) : null}
      </div>
    </li>
  );
}

function AddStagePanel({
  seasonId,
  onClose,
  onCreated,
}: {
  seasonId: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [draft, setDraft] = useState<RecommendationStageDraft>({
    name: "",
    trigger_type: "POST_PLANTING",
    recommended_date: todayLocalYmd(),
    notes: "",
  });
  const createMut = useCreateRecommendation(seasonId);

  const handleSubmit = () => {
    const trimmed = draft.name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da etapa.");
      return;
    }
    createMut.mutate(
      {
        name: trimmed,
        trigger_type: draft.trigger_type,
        predicted_date_current: draft.recommended_date || undefined,
        notes: draft.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Etapa adicionada.");
          setDraft({
            name: "",
            trigger_type: "POST_PLANTING",
            recommended_date: todayLocalYmd(),
            notes: "",
          });
          onCreated?.();
          onClose();
        },
        onError: (error: unknown) => {
          toast.error(extractError(error));
        },
      },
    );
  };

  return (
    <div className="p-4 border rounded-xl border-border bg-surface-2">
      <p className="mb-3 text-sm font-semibold text-foreground">Nova etapa</p>
      <RecommendationStageFields
        draft={draft}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
      />
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createMut.isPending}
          className="h-8 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {createMut.isPending ? "Adicionando…" : "Adicionar etapa"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Cronograma de recomendações da safra do talhão — a tela padrão de
 * `/safras/[id]` (hero de progresso + etapas ordenáveis).
 */
export function SeasonRecommendationsView({
  seasonId,
  title,
  plotName,
  plantingDate: plantingDateProp,
  statusLabel,
  seasonStatus,
  producerId,
  crop,
  farmId,
  openRecommendationId,
  onPublish,
  isPublishing,
}: {
  seasonId: string;
  title: string;
  plotName?: string;
  plantingDate?: string | null;
  statusLabel?: string;
  seasonStatus?: string;
  producerId?: string;
  crop?: string;
  farmId?: string;
  /** Deep-link: abre e rola até a etapa correspondente. */
  openRecommendationId?: string | null;
  onPublish?: () => void;
  isPublishing?: boolean;
}) {
  const { data: seasonLive } = useSeason(seasonId);
  const plantingDate = (() => {
    const raw = seasonLive?.planting_date ?? plantingDateProp;
    return raw ? String(raw).slice(0, 10) : null;
  })();
  const mixFormulationOrder = (seasonLive as { mix_formulation_order?: string[] | null } | undefined)
    ?.mix_formulation_order as FormulationKey[] | null | undefined;
  const { data, isLoading } = useSeasonTimeline(seasonId);
  // Catálogo (global + local) e IDs que já estão na lista de compra desta safra,
  // para o editor de produtos e o alerta "fora da programação".
  const {
    catalogProducts,
    inProgramProductIds,
    purchaseLists,
    isLoading: catalogLoading,
  } = usePurchaseListCatalogProducts(producerId, crop, farmId);
  // Dose planejada na lista de compra, por produto — pré-preenche a dose ao
  // adicionar o produto numa etapa (o agrônomo não digita de novo).
  const listDoseByProductId = useMemo(() => {
    const map = new Map<string, { dose: number; unit: string }>();
    for (const list of purchaseLists) {
      for (const item of list.items) {
        if (map.has(item.local_product_id)) continue;
        if (Number(item.dose_per_hectare) > 0) {
          map.set(item.local_product_id, {
            dose: Number(item.dose_per_hectare),
            unit: item.dose_unit,
          });
        }
      }
    }
    return map;
  }, [purchaseLists]);
  // Só marca item como "fora da programação" depois que a lista carregou —
  // senão todos os itens piscariam em vermelho enquanto a lista não chega.
  const listReady = !catalogLoading;
  const [addingStage, setAddingStage] = useState(false);
  // Botão de "Adicionar etapa" repetido no fim da lista (aparece quando há
  // muitas etapas) para o agrônomo não precisar rolar até o topo.
  const [addingStageBottom, setAddingStageBottom] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mixOrderOpen, setMixOrderOpen] = useState(false);
  const [cropEditOpen, setCropEditOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const reorderMut = useReorderRecommendations(seasonId);
  const meData = useMe().data as { name?: string } | undefined;
  const producerQuery = useProducer(producerId ?? "");
  // Hook antes de qualquer return condicional (regras dos Hooks) — senão a
  // transição loading→carregado dispara "rendered more hooks than previous".
  const canEditStructurePerm = useCan("RECOMMENDATION_EDIT_STRUCTURE");
  // PATCH /seasons exige SEASON_CRUD — botão de plantio usa essa permissão.
  const canSeasonCrud = useCan("SEASON_CRUD");
  // Sem PRICE_VIEW o documento nunca sai com valores (nem a opção aparece).
  const canViewPrices = useCan("PRICE_VIEW");

  // Ficha técnica do PDF: fazenda, áreas, variedades e ciclo vêm da safra
  // (`CycleDetail.seasons` já traz tudo agregado); o espaçamento, da lista.
  const cycleId = seasonLive?.cycle_id ?? "";
  const { data: cycle } = useCycle(cycleId);
  const { data: cyclePurchaseList } = useCyclePurchaseList(cycleId);

  const exportSpec = useMemo(() => {
    const row = cycle?.seasons.find((s) => s.id === seasonId);
    const farm = cycle?.farms.find((f) => f.id === row?.farm_id);
    const varieties =
      row?.varieties?.length
        ? row.varieties.map((v) => ({
            variety: v.variety,
            plantedAreaHa: v.planted_area_ha,
            thousandPlantsPerHa: v.thousand_plants_per_ha ?? null,
          }))
        : seasonLive?.varieties?.map((v) => ({
            variety: v.variety,
            plantedAreaHa: v.planted_area_ha,
            thousandPlantsPerHa: v.thousand_plants_per_ha ?? null,
          })) ?? [];
    return {
      farmName: row?.farm_name ?? farm?.name ?? null,
      farmLocation: farm?.location ?? null,
      cycleName: cycle?.name ?? null,
      cropLabel: CROP_LABELS[crop ?? row?.crop ?? ""] ?? null,
      areaHa: row?.plot_area_ha ?? null,
      plantedAreaHa:
        row?.planted_area_ha ??
        (seasonLive?.planted_area_ha != null
          ? Number(seasonLive.planted_area_ha)
          : null),
      varieties,
      spacingM: cyclePurchaseList?.spacing_m ?? null,
      cycleDays: row?.cycle_days ?? null,
      desiccationDate: row?.desiccation_date ?? seasonLive?.desiccation_date ?? null,
    };
  }, [crop, cycle, cyclePurchaseList, seasonId, seasonLive]);

  // Preço unitário por produto (R$) — base do custo/ha do documento.
  const unitPriceByProduct = useMemo(() => {
    if (!canViewPrices) return undefined;
    const map: Record<string, number> = {};
    for (const item of cyclePurchaseList?.items ?? []) {
      const price = Number(item.unit_price_brl);
      if (price > 0 && map[item.local_product_id] == null) {
        map[item.local_product_id] = price;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [canViewPrices, cyclePurchaseList]);

  const recommendations = useMemo(() => {
    return (
      Array.isArray(data)
        ? data
        : ((data as { data?: unknown[] } | undefined)?.data ?? [])
    ) as Recommendation[];
  }, [data]);

  // Aplicação registrada trava a troca de modelo: não se passa produto por cima
  // do que já foi para o campo. Mesma regra do aplicar em massa, que esconde
  // esses talhões da seleção. Definido antes dos returns condicionais porque os
  // dois botões "Aplicar modelo" vivem em ramos diferentes do render.
  const hasAppliedStage = recommendations.some(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  );
  const applyTemplateTitle = hasAppliedStage
    ? "Este talhão já tem aplicação registrada — o modelo não pode ser trocado."
    : undefined;

  // Deep-link: rola até a etapa alvo após o timeline carregar.
  useEffect(() => {
    if (!openRecommendationId || isLoading) return;
    const el = document.getElementById(`rec-${openRecommendationId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openRecommendationId, isLoading, recommendations]);

  if (isLoading) return <TimelineCardsSkeleton count={5} />;

  // Rascunho também: o agrônomo precisa deixar etapas/produtos na ordem certa
  // antes de publicar — não só depois que o produtor já vê o cronograma.
  const canManageStages =
    (seasonStatus === "DRAFT" ||
      seasonStatus === "PUBLISHED" ||
      seasonStatus === "IN_PROGRESS") &&
    canEditStructurePerm;
  // Plantio pode (e deve) ser registrado também em rascunho — não depende de publicar.
  const canManagePlanting =
    canSeasonCrud && seasonStatus !== "ARCHIVED";

  const moveStage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= recommendations.length) return;
    const reordered = [...recommendations];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    reorderMut.mutate(
      reordered.map((rec) => rec.id),
      {
        onError: () => toast.error("Não foi possível reordenar as etapas."),
      },
    );
  };

  if (!recommendations.length) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold font-display text-text-strong">
              Etapas do cronograma
            </h2>
            {canSeasonCrud && seasonStatus !== "ARCHIVED" && seasonStatus !== "HARVESTED" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCropEditOpen(true)}
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
                Editar cultivo
              </Button>
            ) : null}
            {canManageStages ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setMixOrderOpen(true)}
              >
                <ListOrdered className="w-4 h-4 text-muted-foreground" />
                Ordem de mistura
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageStages ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTemplateOpen(true)}
                  disabled={hasAppliedStage}
                  title={applyTemplateTitle}
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Aplicar modelo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAddingStage(true)}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar etapa
                </Button>
              </>
            ) : producerId ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={routes.produtores.detalhe(producerId, {
                    hash: "timing-templates",
                  })}
                >
                  Configurar modelo de timing
                </Link>
              </Button>
            ) : null}
            {seasonStatus === "DRAFT" && onPublish ? (
              <Button
                size="sm"
                className="gap-2"
                onClick={onPublish}
                disabled={isPublishing}
              >
                <Send className="w-4 h-4" />
                {isPublishing ? "Publicando…" : "Publicar safra"}
              </Button>
            ) : null}
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          <PlantingDateBlock
            seasonId={seasonId}
            plantingDate={plantingDate}
            canManage={canManagePlanting}
          />
        </ul>
        <EmptyState
          variant="inline"
          title="Nenhuma recomendação encontrada para esta safra."
          description={
            canManageStages
              ? "Adicione etapas manualmente ou aplique um modelo de timing neste talhão."
              : "O cronograma é gerado ao programar o talhão com um modelo de timing."
          }
        />
        {addingStage && canManageStages ? (
          <AddStagePanel
            seasonId={seasonId}
            onClose={() => setAddingStage(false)}
          />
        ) : null}
        <SeasonMixOrderDialog
          open={mixOrderOpen}
          onOpenChange={setMixOrderOpen}
          seasonId={seasonId}
          currentOrder={mixFormulationOrder}
        />
        <EditSeasonCropDialog
          open={cropEditOpen}
          onOpenChange={setCropEditOpen}
          seasonId={seasonId}
          cycleId={seasonLive?.cycle_id}
          crop={crop ?? seasonLive?.crop}
          fallbackVariety={seasonLive?.variety}
          initialVarieties={seasonLive?.varieties?.map((v) => ({
            variety: v.variety,
            planted_area_ha: v.planted_area_ha,
            thousand_plants_per_ha: v.thousand_plants_per_ha ?? null,
          }))}
        />
        {producerId ? (
          <ApplySeasonTemplateDialog
            open={templateOpen}
            onOpenChange={setTemplateOpen}
            seasonId={seasonId}
            producerId={producerId}
            crop={crop ?? seasonLive?.crop}
            hasPendingStages={false}
          />
        ) : null}
      </div>
    );
  }

  const done = recommendations.filter(
    (r) => r.status === "APPLIED_ON_TIME" || r.status === "APPLIED_LATE",
  ).length;
  const total = recommendations.length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const shareData = {
    title,
    plotName,
    plantingDate,
    statusLabel,
    producerName: producerQuery.data?.name ?? null,
    agronomistName: meData?.name ?? null,
    done,
    total,
    recommendations,
    spec: exportSpec,
    unitPriceByProduct,
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        className="mb-7"
        icon={<Leaf className="size-6" />}
        eyebrow="Safra em execução"
        title={title}
        stats={[
          ...(plotName ? [{ label: "Talhão", value: plotName }] : []),
          {
            label: "Plantio",
            value: plantingDate ? fmtDate(plantingDate) : "Não registrado",
            tone: plantingDate ? "default" : "danger",
          },
          ...(statusLabel ? [{ label: "Status", value: statusLabel }] : []),
          {
            label: "Aplicações",
            value: total > 0 ? `${done}/${total}` : "—",
            sub: total > 0 ? `${progressPct}%` : undefined,
            subClassName: "font-semibold text-primary-strong",
          },
        ]}
      >
        <div className="mt-4 rounded-xl border border-border bg-rail px-4 py-3.5 sm:mt-5">
          <div className="flex items-center justify-between gap-3 mb-2 text-sm">
            <span className="font-medium text-text-strong">
              Progresso das aplicações
            </span>
            <span className="font-semibold tabular-nums text-primary-strong">
              {done}/{total} aplicadas
              <span className="ml-1 text-muted-foreground">
                ({progressPct}%)
              </span>
            </span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </PageHero>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold font-display text-text-strong">
            Etapas do cronograma
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 print:hidden"
            onClick={() => setExportOpen(true)}
          >
            <Share2 className="w-4 h-4 text-muted-foreground" />
            Exportar
          </Button>
          {canManageStages ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 print:hidden"
              onClick={() => setMixOrderOpen(true)}
            >
              <ListOrdered className="w-4 h-4 text-muted-foreground" />
              Ordem de mistura
            </Button>
          ) : null}
          {canSeasonCrud && seasonStatus !== "ARCHIVED" && seasonStatus !== "HARVESTED" ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 print:hidden"
              onClick={() => setCropEditOpen(true)}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
              Editar cultivo
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canManageStages ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 print:hidden"
                onClick={() => setTemplateOpen(true)}
                disabled={hasAppliedStage}
                title={applyTemplateTitle}
              >
                <LayoutTemplate className="w-4 h-4" />
                Aplicar modelo
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Adicionar etapa"
                onClick={() => setAddingStage((v) => !v)}
              >
                <Plus className="w-4 h-4" />
                Adicionar etapa
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {addingStage ? (
        <AddStagePanel
          seasonId={seasonId}
          onClose={() => setAddingStage(false)}
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        <PlantingDateBlock
          seasonId={seasonId}
          plantingDate={plantingDate}
          canManage={canManagePlanting}
        />
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            index={i}
            seasonId={seasonId}
            defaultOpen={openRecommendationId === rec.id}
            canMoveUp={canManageStages && i > 0}
            canMoveDown={canManageStages && i < recommendations.length - 1}
            onMoveUp={() => moveStage(i, "up")}
            onMoveDown={() => moveStage(i, "down")}
            isReordering={reorderMut.isPending}
            canReorder={canManageStages}
            canEditStructure={canManageStages}
            catalogProducts={catalogProducts}
            inProgramProductIds={inProgramProductIds}
            listDoseByProductId={listDoseByProductId}
            listReady={listReady}
          />
        ))}
      </ul>

      {/* Etapas costumam passar de 4 — repete o "adicionar" embaixo da última,
          como um card fantasma com + centralizado, pra não obrigar o agrônomo a
          rolar de volta ao topo. */}
      {canManageStages && recommendations.length >= 4 ? (
        addingStageBottom ? (
          <AddStagePanel
            seasonId={seasonId}
            onClose={() => setAddingStageBottom(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingStageBottom(true)}
            className="flex flex-col items-center justify-center w-full gap-2 py-8 transition-colors border-2 border-dashed rounded-xl border-border bg-card/30 text-muted-foreground hover:border-primary/50 hover:bg-primary-soft/30 hover:text-primary-strong"
          >
            <span className="flex items-center justify-center border-2 border-current border-dashed rounded-full h-11 w-11">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-sm font-medium">Adicionar etapa</span>
          </button>
        )
      ) : null}

      <RecommendationExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={shareData}
      />
      <SeasonMixOrderDialog
        open={mixOrderOpen}
        onOpenChange={setMixOrderOpen}
        seasonId={seasonId}
        currentOrder={mixFormulationOrder}
      />
      <EditSeasonCropDialog
        open={cropEditOpen}
        onOpenChange={setCropEditOpen}
        seasonId={seasonId}
        cycleId={seasonLive?.cycle_id}
        crop={crop ?? seasonLive?.crop}
        fallbackVariety={seasonLive?.variety}
        initialVarieties={seasonLive?.varieties?.map((v) => ({
          variety: v.variety,
          planted_area_ha: v.planted_area_ha,
          thousand_plants_per_ha: v.thousand_plants_per_ha ?? null,
        }))}
      />
      {producerId ? (
        <ApplySeasonTemplateDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          seasonId={seasonId}
          producerId={producerId}
          crop={crop ?? seasonLive?.crop}
          hasPendingStages={recommendations.some((r) => r.status === "PENDING")}
        />
      ) : null}
    </div>
  );
}
