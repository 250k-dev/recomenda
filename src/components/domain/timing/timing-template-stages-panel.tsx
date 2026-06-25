"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TimingStagesEditor,
  type TimingStageField,
} from "@/components/domain/timing/timing-stages-editor";
import {
  getMixTemplate,
  updateTimingStage,
  type TimingStage,
  type TimingTemplate,
} from "@/lib/api/templates";
import {
  useCreateTimingStage,
  useDeleteTimingStage,
  useLocalCatalog,
  useReorderTimingStages,
  queryKeys,
} from "@/lib/api/hooks";
import {
  mapMixItemsToStageProducts,
  syncStageProducts,
} from "@/lib/timing/sync-stage-products";
import { recommendedYmdToWindow, todayLocalYmd, windowToRecommendedYmd } from "@/lib/timing/window-days";

type TimingTemplateStagesPanelProps = {
  template: TimingTemplate & { stages: TimingStage[] };
  producerId?: string;
};

export function TimingTemplateStagesPanel({
  template,
  producerId,
}: TimingTemplateStagesPanelProps) {
  const templateId = template.id;
  const createStage = useCreateTimingStage(templateId);
  const deleteStage = useDeleteTimingStage(templateId);
  const reorder = useReorderTimingStages(templateId);
  const queryClient = useQueryClient();
  const { data: catalogData } = useLocalCatalog();
  // Memoizado para manter a referência estável (senão `[]` muda a cada render e
  // o useEffect de hidratação entra em loop quando o modelo tem 0 etapas).
  const catalogProducts = useMemo(() => catalogData?.data ?? [], [catalogData?.data]);

  const sortedStages = useMemo(
    () => [...(template.stages ?? [])].sort((a, b) => a.order_index - b.order_index),
    [template.stages],
  );

  const mixIds = useMemo(
    () =>
      [
        ...new Set(
          sortedStages
            .map((stage) => stage.default_mix_template_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    [sortedStages],
  );

  const mixQueries = useQueries({
    queries: mixIds.map((mixId) => ({
      queryKey: queryKeys.mixTemplate(mixId),
      queryFn: () => getMixTemplate(mixId),
    })),
  });

  const mixesById = useMemo(() => {
    const map = new Map<string, NonNullable<(typeof mixQueries)[number]["data"]>>();
    for (const query of mixQueries) {
      if (query.data) map.set(query.data.id, query.data);
    }
    return map;
  }, [mixQueries]);

  const mixesLoading = mixIds.length > 0 && mixQueries.some((query) => query.isLoading);

  const stageSignature = useMemo(
    () =>
      sortedStages
        .map((stage) => `${stage.id}:${stage.default_mix_template_id ?? ""}`)
        .join("|"),
    [sortedStages],
  );

  const [editorStages, setEditorStages] = useState<TimingStageField[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hydratedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (mixesLoading || isDirty) return;

    // Hidrata uma única vez por assinatura de etapas. Não depender de
    // `editorStages.length` evita loop quando deps instáveis (ex.: mixesById de
    // useQueries) mudam a cada render e as etapas estão vazias.
    if (hydratedSignatureRef.current === stageSignature) {
      return;
    }

    hydratedSignatureRef.current = stageSignature;
    setEditorStages(
      sortedStages.map((stage) => {
        const mixId = stage.default_mix_template_id;
        const mix = mixId ? mixesById.get(mixId) : undefined;
        return {
          key: stage.id,
          name: stage.name,
          trigger_type: stage.trigger_type,
          recommended_date: windowToRecommendedYmd(
            stage.window_start_days,
            stage.window_end_days,
          ),
          notes: stage.notes ?? "",
          products: mix?.items
            ? mapMixItemsToStageProducts(mix.items, catalogProducts)
            : [],
        };
      }),
    );
  }, [
    catalogProducts,
    isDirty,
    mixesById,
    mixesLoading,
    sortedStages,
    stageSignature,
  ]);

  const invalidateTemplateData = useCallback(
    async (mixId?: string | null) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(templateId) });
      if (mixId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(mixId) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplates });
    },
    [queryClient, templateId],
  );

  const saveAll = useCallback(async () => {
    if (editorStages.length === 0) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);
    try {
      for (const editorStage of editorStages) {
        const stage = sortedStages.find((item) => item.id === editorStage.key);
        if (!stage) continue;

        const { window_start_days, window_end_days } = recommendedYmdToWindow(
          editorStage.recommended_date,
        );
        const trimmedNotes = editorStage.notes.trim();

        await updateTimingStage(stage.id, {
          name: editorStage.name.trim() || stage.name,
          trigger_type: editorStage.trigger_type,
          window_start_days,
          window_end_days,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        });

        await syncStageProducts({
          stageId: stage.id,
          stageName: editorStage.name.trim() || stage.name,
          templateName: template.name,
          crop: template.crop,
          currentMixId: stage.default_mix_template_id,
          products: editorStage.products,
        });
      }

      hydratedSignatureRef.current = null;
      await invalidateTemplateData();
      setIsDirty(false);
      toast.success("Modelo salvo.");
    } catch {
      toast.error("Não foi possível salvar o modelo.");
    } finally {
      setIsSaving(false);
    }
  }, [editorStages, invalidateTemplateData, sortedStages, template.crop, template.name]);

  const ensureSavedBeforeStructureChange = useCallback(async () => {
    if (!isDirty) return;
    await saveAll();
  }, [isDirty, saveAll]);

  const handleStageChange = useCallback(
    (key: string, patch: Partial<TimingStageField>) => {
      setEditorStages((prev) =>
        prev.map((stage) => (stage.key === key ? { ...stage, ...patch } : stage)),
      );
      setIsDirty(true);
    },
    [],
  );

  const handleAddStage = useCallback(
    async (presetName?: string) => {
      await ensureSavedBeforeStructureChange();

      const nextOrderIndex =
        sortedStages.length > 0
          ? Math.max(...sortedStages.map((stage) => stage.order_index)) + 1
          : 0;

      createStage.mutate(
        {
          order_index: nextOrderIndex,
          name: presetName ?? "",
          trigger_type: "POST_PLANTING",
          ...recommendedYmdToWindow(todayLocalYmd()),
          default_mix_template_id: null,
        },
        {
          onSuccess: () =>
            toast.success(presetName ? `"${presetName}" adicionado.` : "Etapa adicionada."),
          onError: () => toast.error("Não foi possível adicionar a etapa."),
        },
      );
    },
    [createStage, ensureSavedBeforeStructureChange, sortedStages],
  );

  const handleRemoveStage = useCallback(
    async (key: string) => {
      await ensureSavedBeforeStructureChange();

      deleteStage.mutate(key, {
        onSuccess: () => toast.success("Etapa removida."),
        onError: () => toast.error("Não foi possível remover a etapa."),
      });
    },
    [deleteStage, ensureSavedBeforeStructureChange],
  );

  const moveStage = useCallback(
    async (key: string, direction: "up" | "down") => {
      await ensureSavedBeforeStructureChange();

      const index = sortedStages.findIndex((stage) => stage.id === key);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sortedStages.length) return;
      const reordered = [...sortedStages];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      reorder.mutate(reordered.map((stage) => stage.id));
    },
    [ensureSavedBeforeStructureChange, reorder, sortedStages],
  );

  if (mixesLoading && editorStages.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Carregando produtos das etapas…
      </div>
    );
  }

  return (
    <TimingStagesEditor
      stages={editorStages}
      minStages={0}
      showProducts
      producerId={producerId ?? template.producer_id ?? undefined}
      crop={template.crop}
      isAdding={createStage.isPending}
      showSaveButton
      isSaving={isSaving}
      saveDisabled={!isDirty}
      onSave={() => void saveAll()}
      onChange={handleStageChange}
      onAdd={(presetName) => void handleAddStage(presetName)}
      onRemove={(key) => void handleRemoveStage(key)}
      onMoveUp={(key) => void moveStage(key, "up")}
      onMoveDown={(key) => void moveStage(key, "down")}
    />
  );
}
