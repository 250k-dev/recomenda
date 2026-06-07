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
  type TimingStage,
  type TimingTemplate,
} from "@/lib/api/templates";
import {
  useCreateTimingStage,
  useDeleteTimingStage,
  useLocalCatalog,
  useReorderTimingStages,
  useUpdateTimingStage,
  queryKeys,
} from "@/lib/api/hooks";
import {
  mapMixItemsToStageProducts,
  syncStageProducts,
} from "@/lib/timing/sync-stage-products";

const FIELD_DEBOUNCE_MS = 450;
const PRODUCT_DEBOUNCE_MS = 700;

type TimingTemplateStagesPanelProps = {
  template: TimingTemplate & { stages: TimingStage[] };
};

export function TimingTemplateStagesPanel({ template }: TimingTemplateStagesPanelProps) {
  const templateId = template.id;
  const createStage = useCreateTimingStage(templateId);
  const updateStage = useUpdateTimingStage(templateId);
  const deleteStage = useDeleteTimingStage(templateId);
  const reorder = useReorderTimingStages(templateId);
  const queryClient = useQueryClient();
  const { data: catalogData } = useLocalCatalog();
  const catalogProducts = catalogData?.data ?? [];

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
  const editorStagesRef = useRef(editorStages);
  useEffect(() => {
    editorStagesRef.current = editorStages;
  }, [editorStages]);
  const hydratedSignatureRef = useRef<string | null>(null);
  const fieldDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const productDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const syncingProductsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (mixesLoading) return;

    if (hydratedSignatureRef.current === stageSignature && editorStages.length > 0) {
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
          window_start_days: String(stage.window_start_days),
          window_end_days: String(stage.window_end_days),
          products: mix?.items
            ? mapMixItemsToStageProducts(mix.items, catalogProducts)
            : [],
        };
      }),
    );
  }, [catalogProducts, editorStages.length, mixesById, mixesLoading, sortedStages, stageSignature]);

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

  const scheduleFieldUpdate = useCallback(
    (stageId: string, patch: Partial<TimingStageField>) => {
      const existing = fieldDebounceTimers.current.get(stageId);
      if (existing) clearTimeout(existing);

      fieldDebounceTimers.current.set(
        stageId,
        setTimeout(() => {
          fieldDebounceTimers.current.delete(stageId);
          const payload: Record<string, unknown> = { id: stageId };
          if (patch.name !== undefined) payload.name = patch.name;
          if (patch.trigger_type !== undefined) payload.trigger_type = patch.trigger_type;
          if (patch.window_start_days !== undefined) {
            payload.window_start_days = Number(patch.window_start_days) || 0;
          }
          if (patch.window_end_days !== undefined) {
            payload.window_end_days = Number(patch.window_end_days) || 0;
          }
          updateStage.mutate(payload as Parameters<typeof updateStage.mutate>[0], {
            onError: () => toast.error("Não foi possível salvar a etapa."),
          });
        }, FIELD_DEBOUNCE_MS),
      );
    },
    [updateStage],
  );

  const scheduleProductSync = useCallback(
    (stageId: string, products: TimingStageField["products"]) => {
      const existing = productDebounceTimers.current.get(stageId);
      if (existing) clearTimeout(existing);

      productDebounceTimers.current.set(
        stageId,
        setTimeout(() => {
          productDebounceTimers.current.delete(stageId);
          if (syncingProductsRef.current.has(stageId)) return;

          const stage = sortedStages.find((item) => item.id === stageId);
          const editorStage = editorStagesRef.current.find((item) => item.key === stageId);
          if (!stage || !editorStage) return;

          syncingProductsRef.current.add(stageId);
          void syncStageProducts({
            stageId,
            stageName: editorStage.name.trim() || stage.name,
            templateName: template.name,
            crop: template.crop,
            currentMixId: stage.default_mix_template_id,
            products,
          })
            .then(async (mixId) => {
              await invalidateTemplateData(mixId ?? stage.default_mix_template_id);
            })
            .catch(() => {
              toast.error("Não foi possível salvar os produtos da etapa.");
            })
            .finally(() => {
              syncingProductsRef.current.delete(stageId);
            });
        }, PRODUCT_DEBOUNCE_MS),
      );
    },
    [invalidateTemplateData, sortedStages, template.crop, template.name],
  );

  const handleStageChange = useCallback(
    (key: string, patch: Partial<TimingStageField>) => {
      setEditorStages((prev) =>
        prev.map((stage) => (stage.key === key ? { ...stage, ...patch } : stage)),
      );

      if (patch.products !== undefined) {
        scheduleProductSync(key, patch.products);
        return;
      }

      if (patch.trigger_type !== undefined) {
        updateStage.mutate(
          { id: key, trigger_type: patch.trigger_type },
          { onError: () => toast.error("Não foi possível salvar a etapa.") },
        );
        return;
      }

      scheduleFieldUpdate(key, patch);
    },
    [scheduleFieldUpdate, scheduleProductSync, updateStage],
  );

  const handleAddStage = useCallback(
    (presetName?: string) => {
      const nextOrderIndex =
        sortedStages.length > 0
          ? Math.max(...sortedStages.map((stage) => stage.order_index)) + 1
          : 0;

      createStage.mutate(
        {
          order_index: nextOrderIndex,
          name: presetName ?? "",
          trigger_type: "DAYS_AFTER_PLANTING",
          window_start_days: 0,
          window_end_days: 7,
          default_mix_template_id: null,
        },
        {
          onSuccess: () =>
            toast.success(presetName ? `"${presetName}" adicionado.` : "Etapa adicionada."),
          onError: () => toast.error("Não foi possível adicionar a etapa."),
        },
      );
    },
    [createStage, sortedStages],
  );

  const handleRemoveStage = useCallback(
    (key: string) => {
      deleteStage.mutate(key, {
        onSuccess: () => toast.success("Etapa removida."),
        onError: () => toast.error("Não foi possível remover a etapa."),
      });
    },
    [deleteStage],
  );

  const moveStage = useCallback(
    (key: string, direction: "up" | "down") => {
      const index = sortedStages.findIndex((stage) => stage.id === key);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sortedStages.length) return;
      const reordered = [...sortedStages];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      reorder.mutate(reordered.map((stage) => stage.id));
    },
    [reorder, sortedStages],
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
      isAdding={createStage.isPending}
      onChange={handleStageChange}
      onAdd={handleAddStage}
      onRemove={handleRemoveStage}
      onMoveUp={(key) => moveStage(key, "up")}
      onMoveDown={(key) => moveStage(key, "down")}
    />
  );
}
