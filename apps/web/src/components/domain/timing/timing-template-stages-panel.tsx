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
} from "@recomenda/api/templates";
import {
  useCreateTimingStage,
  useDeleteTimingStage,
  useLocalCatalog,
  useReorderTimingStages,
  queryKeys,
} from "@recomenda/api-hooks";
import {
  isStageProductPersistable,
  mapMixItemsToStageProducts,
  planStageProducts,
} from "@recomenda/domain/timing/sync-stage-products";
import { applyStageProductsPlan } from "@/components/domain/timing/apply-stage-products-plan";
import { recommendedYmdToWindow, todayLocalYmd, windowToRecommendedYmd } from "@recomenda/domain/timing/window-days";
import {
  readLocalDraft,
  clearLocalDraft,
  useLocalDraft,
} from "@recomenda/api-hooks/use-local-draft";
import { useUnsavedChangesWarning } from "@recomenda/api-hooks/use-unsaved-changes-warning";
import type { StageProductDraft } from "@recomenda/domain/timing/types";

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

  // Rascunho local (localStorage): guarda o que está sendo editado no navegador,
  // "por baixo dos panos", para nada se perder ao recarregar/fechar. NÃO é o
  // salvamento no servidor — esse só acontece no botão Salvar (e antes de
  // mudanças estruturais). Some quando o modelo é salvo de verdade.
  const draftKey = `timing-tmpl-draft:${templateId}`;

  // Restaura o rascunho local uma vez por modelo — ajuste de estado durante o
  // render (padrão recomendado pelo React), não em efeito. Tem prioridade sobre
  // o servidor: se havia edição não salva (reload/queda), ela volta silenciosa.
  const [draftRestoredFor, setDraftRestoredFor] = useState<string | null>(null);
  if (draftRestoredFor !== templateId) {
    setDraftRestoredFor(templateId);
    const draft = readLocalDraft<TimingStageField[]>(draftKey);
    if (draft && draft.length > 0) {
      // isDirty=true faz o efeito de hidratação retornar cedo — o servidor não
      // sobrescreve o rascunho restaurado até o próximo Salvar.
      setEditorStages(draft);
      setIsDirty(true);
    }
  }

  useEffect(() => {
    if (mixesLoading) return;

    // Enquanto edita (sujo), não re-hidrata do servidor — evita apagar/reordenar
    // linhas no meio da digitação (era a causa do "some o produto/categoria").
    if (isDirty) return;

    // Hidrata uma única vez por assinatura de etapas. Não depender de
    // `editorStages.length` evita loop quando deps instáveis (ex.: mixesById de
    // useQueries) mudam a cada render e as etapas estão vazias.
    if (hydratedSignatureRef.current === stageSignature) {
      return;
    }

    hydratedSignatureRef.current = stageSignature;
    setEditorStages((prev) => {
      const prevByKey = new Map(prev.map((s) => [s.key, s]));
      return sortedStages.map((stage) => {
        const mixId = stage.default_mix_template_id;
        const mix = mixId ? mixesById.get(mixId) : undefined;
        const hydratedProducts = mix?.items
          ? mapMixItemsToStageProducts(mix.items, catalogProducts)
          : [];
        // Preserva linhas ainda EM ABERTO (sem produto ou sem dose) que o usuário
        // está preenchendo — a re-hidratação não pode apagá-las ("some a linha").
        // Mescla por `key`: as em aberto sobrescrevem a versão do servidor de
        // mesma key (evita a CHAVE DUPLICADA quando a dose de um item salvo é
        // limpa) e as novas (key própria) são anexadas ao fim.
        const inProgress = (prevByKey.get(stage.id)?.products ?? []).filter(
          (p) => !isStageProductPersistable(p),
        );
        const byKey = new Map<string, StageProductDraft>();
        for (const p of hydratedProducts) byKey.set(p.key, p);
        for (const p of inProgress) byKey.set(p.key, p);
        return {
          key: stage.id,
          name: stage.name,
          trigger_type: stage.trigger_type,
          recommended_date: windowToRecommendedYmd(
            stage.window_start_days,
            stage.window_end_days,
          ),
          notes: stage.notes ?? "",
          products: [...byKey.values()],
        };
      });
    });
  }, [
    catalogProducts,
    isDirty,
    mixesById,
    mixesLoading,
    sortedStages,
    stageSignature,
  ]);

  // Escreve o rascunho local (debounce) enquanto há edição não salva.
  useLocalDraft(draftKey, editorStages, isDirty);
  // Rede de segurança: avisa antes de fechar/recarregar com edição não salva.
  useUnsavedChangesWarning(isDirty);

  const saveAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (editorStages.length === 0) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);
    try {
      const touchedMixIds = new Set<string>();
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

        // Decidir (puro, em domain) e executar (transporte) são passos separados
        // desde o B7 — antes `syncStageProducts` fazia os dois de dentro de
        // `domain`, disparando rede de um pacote que a doc define como puro.
        const plan = planStageProducts({
          stageName: editorStage.name.trim() || stage.name,
          templateName: template.name,
          crop: template.crop,
          currentMixId: stage.default_mix_template_id,
          products: editorStage.products,
        });
        const mixId = await applyStageProductsPlan(stage.id, plan);
        if (mixId) touchedMixIds.add(mixId);
      }

      // NÃO nula `hydratedSignatureRef`: o estado local (editorStages) já é o
      // conjunto salvo e correto. Nulá-lo forçava uma re-hidratação a partir do
      // cache do mix AINDA STALE (o `getMixTemplate` não tinha refetchado), que
      // apagava os itens recém-salvos da tela até dar F5. Mantemos o que está na
      // tela e só invalidamos os caches para as próximas leituras/mudança de
      // estrutura — que re-hidratam já com dado fresco (com gate de loading).
      clearLocalDraft(draftKey);
      setIsDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.timingTemplate(templateId) });
      for (const mixId of touchedMixIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplate(mixId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.mixTemplates });
      if (!opts?.silent) toast.success("Modelo salvo.");
    } catch {
      toast.error("Não foi possível salvar o modelo.");
    } finally {
      setIsSaving(false);
    }
  }, [draftKey, editorStages, queryClient, sortedStages, templateId, template.crop, template.name]);

  // Persiste as edições pendentes antes de uma mudança estrutural (add/remover/
  // mover etapa), sem toast próprio — quem avisa é a ação estrutural.
  const ensureSavedBeforeStructureChange = useCallback(async () => {
    if (!isDirty) return;
    await saveAll({ silent: true });
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
