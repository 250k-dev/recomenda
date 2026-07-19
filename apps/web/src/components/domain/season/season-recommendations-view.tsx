"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Leaf, Plus, Send, Share2 } from "lucide-react";
import { PageHero } from "@/components/domain/page-hero";
import { TimelineCardsSkeleton } from "@/components/domain/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import {
  useCreateRecommendation,
  useMe,
  useProducer,
  useReorderRecommendations,
  useSeasonTimeline,
} from "@recomenda/api-hooks";
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
import { fmtDate } from "@recomenda/domain/recommendations/format";
import { routes } from "@recomenda/config";

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
  plantingDate,
  statusLabel,
  seasonStatus,
  producerId,
  crop,
  farmId,
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
  onPublish?: () => void;
  isPublishing?: boolean;
}) {
  const { data, isLoading } = useSeasonTimeline(seasonId);
  // Catálogo (global + local) e IDs que já estão na lista de compra desta safra,
  // para o editor de produtos e o alerta "fora da programação".
  const {
    catalogProducts,
    listProductIds,
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
  const reorderMut = useReorderRecommendations(seasonId);
  const meData = useMe().data as { name?: string } | undefined;
  const producerQuery = useProducer(producerId ?? "");
  // Hook antes de qualquer return condicional (regras dos Hooks) — senão a
  // transição loading→carregado dispara "rendered more hooks than previous".
  const canEditStructurePerm = useCan("RECOMMENDATION_EDIT_STRUCTURE");

  if (isLoading) return <TimelineCardsSkeleton count={5} />;

  const recommendations = (
    Array.isArray(data)
      ? data
      : ((data as { data?: unknown[] } | undefined)?.data ?? [])
  ) as Recommendation[];

  const canManageStages =
    (seasonStatus === "PUBLISHED" || seasonStatus === "IN_PROGRESS") &&
    canEditStructurePerm;

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
    const emptyAction =
      seasonStatus === "DRAFT" && onPublish ? (
        <Button
          size="sm"
          className="gap-2"
          onClick={onPublish}
          disabled={isPublishing}
        >
          <Send className="w-4 h-4" />
          {isPublishing ? "Publicando…" : "Publicar safra"}
        </Button>
      ) : canManageStages ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setAddingStage(true)}
        >
          <Plus className="w-4 h-4" />
          Adicionar etapa
        </Button>
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
      ) : undefined;

    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          variant="inline"
          title="Nenhuma recomendação encontrada para esta safra."
          description={
            seasonStatus === "DRAFT"
              ? "Publique a safra para gerar o cronograma de aplicações a partir do modelo de timing."
              : canManageStages
                ? "Adicione etapas manualmente ou configure o modelo de timing do produtor."
                : "O cronograma é gerado ao publicar a safra com um modelo de timing que tenha etapas configuradas."
          }
          action={emptyAction}
        />
        {addingStage && canManageStages ? (
          <AddStagePanel
            seasonId={seasonId}
            onClose={() => setAddingStage(false)}
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
          ...(plantingDate
            ? [{ label: "Plantio", value: fmtDate(plantingDate) }]
            : []),
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
        <div className="flex items-center gap-2">
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
        </div>
        <div className="flex items-center gap-2">
          {canManageStages ? (
            <Button
              variant="outline"
              size="sm"
              aria-label="Adicionar etapa"
              onClick={() => setAddingStage((v) => !v)}
            >
              <Plus className="w-4 h-4" />
              Adicionar etapa
            </Button>
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
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            index={i}
            seasonId={seasonId}
            canMoveUp={canManageStages && i > 0}
            canMoveDown={canManageStages && i < recommendations.length - 1}
            onMoveUp={() => moveStage(i, "up")}
            onMoveDown={() => moveStage(i, "down")}
            isReordering={reorderMut.isPending}
            canReorder={canManageStages}
            canEditStructure={canManageStages}
            catalogProducts={catalogProducts}
            listProductIds={listProductIds}
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
    </div>
  );
}
