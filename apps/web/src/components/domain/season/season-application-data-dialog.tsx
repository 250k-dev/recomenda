"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Recommendation } from "@recomenda/api";
import { patchRecommendation, type SameStageRecommendation } from "@recomenda/api/seasons";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useSameStageRecommendations } from "@recomenda/api-hooks/seasons";
import { useIsMobile } from "@recomenda/ui/hooks/use-mobile";
import { suggestPhenologicalStage } from "@recomenda/domain/recommendations/phenology";
import { nonSprayOperation } from "@recomenda/domain/recommendations/recipe-document";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import {
  ApplicationDataFields,
  applicationDraftFrom,
  applicationSummary,
  commonApplicationDraft,
  emptyApplicationData,
  recipeFieldsPayload,
  type ApplicationDataDraft,
  type ApplicationDraftKey,
} from "@/components/domain/application-data-fields";
import {
  DataStageRow,
  FormBlock,
  SameStageTargetPicker,
  allPendingSameStageIds,
  syncedSameStageRowIds,
  RecipeLivePreview,
  withRecipeDraft,
} from "@/components/domain/export/application-data-ui";
import { ExportFooter, ExportShell, FooterButton } from "@/components/domain/export/export-ui";
import { rowHasStoredRecipeFields, shortDate } from "@/components/domain/export/export-helpers";

/** Só etapa pendente e com calda recebe dados da aplicação. */
function editable(rec: Recommendation): boolean {
  return rec.status === "PENDING" && !nonSprayOperation(rec.items);
}

/**
 * "Dados da aplicação" do talhão: marca as etapas que levam a mesma
 * configuração, preenche e salva; depois outro grupo. Só os campos mexidos
 * são gravados — "Vários" intocado preserva o valor de cada etapa. À direita,
 * as receitas como vão sair, a cada tecla.
 *
 * Hook (entrega as partes da moldura): é o modal do botão do topo do talhão
 * e também a aba "Dados da aplicação" do Exportar do talhão.
 */
export function useSeasonApplicationTab({
  open,
  onClose,
  seasonId,
  data,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  seasonId: string;
  /** O mesmo payload do Exportar (ficha do talhão + etapas). */
  data: RecommendationShareData;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const recommendations = data.recommendations;
  const areaHa = data.spec?.plantedAreaHa ?? data.spec?.areaHa ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ApplicationDataDraft>(emptyApplicationData());
  const [touched, setTouched] = useState<Set<ApplicationDraftKey>>(new Set());
  const [replicateTargets, setReplicateTargets] = useState<Set<string>>(new Set());
  const [initialPendingTargets, setInitialPendingTargets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const selectedRecs = useMemo(
    () => recommendations.filter((rec) => selected.has(rec.id)),
    [recommendations, selected],
  );
  const common = useMemo(() => commonApplicationDraft(selectedRecs), [selectedRecs]);

  const resetForm = (ids: Set<string>) => {
    setSelected(ids);
    setDraft(commonApplicationDraft(recommendations.filter((rec) => ids.has(rec.id))).value);
    setTouched(new Set());
  };

  // Ao abrir: nada marcado — o usuário escolhe as etapas.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      resetForm(new Set());
      setReplicateTargets(new Set());
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    resetForm(next);
  };

  const single = selectedRecs.length === 1 ? selectedRecs[0] : null;
  const stageSuggestion = single
    ? suggestPhenologicalStage(data.spec?.crop, single.trigger_type, single.window_start_days, single.window_end_days)
        .stage
    : null;

  const editableIds = recommendations.filter(editable).map((rec) => rec.id);
  const selectedIds = useMemo(() => [...selected], [selected]);
  const sameStage = useSameStageRecommendations(selectedIds, open && canEdit);
  const others = useMemo(() => {
    const seen = new Set<string>();
    const list: SameStageRecommendation[] = [];
    for (const id of selectedIds) {
      for (const row of sameStage.byId[id] ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        list.push(row);
      }
    }
    return list;
  }, [selectedIds, sameStage.byId]);
  const othersPending = others.filter((row) => row.status === "PENDING").length;
  const pendingOtherIds = useMemo(
    () => others.filter((row) => row.status === "PENDING").map((row) => row.id),
    [others],
  );
  const syncedOtherIds = useMemo(
    () => syncedSameStageRowIds(others, selectedRecs),
    [others, selectedRecs],
  );
  const allAppliedToOthers =
    pendingOtherIds.length > 0 && pendingOtherIds.every((id) => syncedOtherIds.has(id));
  const sourceHasRecipe = useMemo(
    () => selectedRecs.some((rec) => rowHasStoredRecipeFields(rec)),
    [selectedRecs],
  );
  /** Pendentes desmarcados que já têm calda/tanque gravados (ou iguais à etapa aqui). */
  const removeTargetIds = useMemo(
    () =>
      others
        .filter((row) => {
          if (row.status !== "PENDING") return false;
          if (replicateTargets.has(row.id)) return false;
          if (rowHasStoredRecipeFields(row) || syncedOtherIds.has(row.id)) return true;
          // Etapa deste talhão já tem receita: desmarcado = tirar dos outros talhões ao salvar.
          return sourceHasRecipe && initialPendingTargets.has(row.id);
        })
        .map((row) => row.id),
    [others, replicateTargets, syncedOtherIds, sourceHasRecipe, initialPendingTargets],
  );
  const othersInitKey = `${selectedIds.join("|")}|${pendingOtherIds.join(",")}`;
  useEffect(() => {
    if (!open) return;
    const pending = allPendingSameStageIds(others);
    setReplicateTargets(pending);
    setInitialPendingTargets(pending);
    // Só reinicia a seleção quando mudam etapas marcadas ou a lista de talhões — não em cada refetch.
  }, [open, othersInitKey]);

  const keys = [...touched].filter((key) => key !== "phenologicalStage" || single);
  // Uma folha por etapa marcada, com o rascunho aplicado.
  const previewSheets = [
    { ...data, recommendations: selectedRecs.map((rec) => withRecipeDraft(rec, keys, draft)) },
  ];

  const clearRecipePayload = {
    spray_volume_l_ha: null,
    tank_capacity_l: null,
    application_time: null,
    nozzle: null,
    phenological_stage: null,
  };

  const save = async () => {
    const removing = removeTargetIds.length;
    if (selectedRecs.length === 0) return;
    if (keys.length === 0 && removing === 0) return;
    setSaving(true);
    let replicated = 0;
    try {
      if (keys.length > 0) {
        const payload = recipeFieldsPayload(keys, draft);
        for (const rec of selectedRecs) {
          const targetIds = [...replicateTargets];
          const result = await patchRecommendation(rec.id, {
            ...payload,
            ...(targetIds.length > 0
              ? { apply_to_same_stage: true, same_stage_target_ids: targetIds }
              : {}),
          });
          replicated += result?.replicated ?? 0;
        }
        setTouched(new Set());
      }
      if (removing > 0) {
        for (const id of removeTargetIds) {
          await patchRecommendation(id, clearRecipePayload);
        }
        setReplicateTargets(allPendingSameStageIds(others));
      }
      void queryClient.invalidateQueries({ queryKey: ["season-timeline"] });
      void queryClient.invalidateQueries({ queryKey: ["same-stage"] });
      const n = selectedRecs.length;
      const unchanged = replicateTargets.size > 0 ? others.length - othersPending : 0;
      const parts: string[] = [];
      if (keys.length > 0) {
        parts.push(
          `Salvo em ${n} ${n === 1 ? "etapa" : "etapas"}` +
            (replicated ? ` e em mais ${replicated} nos outros talhões` : "") +
            (unchanged ? ` (${unchanged} ${unchanged === 1 ? "registrada não mudou" : "registradas não mudaram"})` : ""),
        );
      }
      if (removing > 0) {
        parts.push(
          `Dados da aplicação removidos de ${removing} ${removing === 1 ? "talhão" : "talhões"}`,
        );
      }
      toast.success(parts.join(". ") + ".");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar os dados da aplicação."));
    } finally {
      setSaving(false);
    }
  };

  const list = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-[#7a786e] uppercase">Etapas</span>
        <span className="flex gap-2.5 text-[12.5px] font-semibold">
          <button type="button" className="text-[#2f6d3f] hover:underline" onClick={() => resetForm(new Set(editableIds))}>
            Pendentes
          </button>
          <button type="button" className="text-[#2f6d3f] hover:underline" onClick={() => resetForm(new Set())}>
            Nenhuma
          </button>
        </span>
      </div>
      {recommendations.map((rec, index) => {
        const operation = nonSprayOperation(rec.items);
        const pending = rec.status === "PENDING";
        const summary = applicationSummary(applicationDraftFrom(rec));
        return (
          <DataStageRow
            key={rec.id}
            on={selected.has(rec.id)}
            disabled={!editable(rec) || !canEdit}
            onToggle={() => toggle(rec.id)}
            name={`${index + 1}. ${rec.name}`}
            badge={pending ? "PENDENTE" : rec.status === "SKIPPED" ? "PULADA" : "APLICADA"}
            badgeTone={pending ? "pending" : rec.status === "SKIPPED" ? "skipped" : "done"}
            sub={
              operation
                ? `Operação: ${operation}`
                : pending
                  ? `Prevista ${shortDate(rec.predicted_date_current) ?? "—"}`
                  : "Registrada — não muda"
            }
            summary={operation ? null : (summary ?? "não preenchido")}
            summaryTone={summary ? "ok" : "empty"}
          />
        );
      })}
    </div>
  );

  // O formulário fica sempre à vista; sem etapa marcada, desabilitado.
  const none = selectedRecs.length === 0;
  const form = (
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">
            {none ? "Nenhuma etapa marcada" : single ? single.name : `${selectedRecs.length} etapas marcadas`}
          </p>
          <p className="text-xs text-[#6b6a62]">
            {none
              ? editableIds.length
                ? "Marque abaixo uma ou mais etapas pendentes para preencher."
                : "Não há etapas pendentes com calda neste talhão — as registradas mantêm os dados com que foram feitas."
              : `${areaHa ? `${areaHa.toLocaleString("pt-BR")} ha` : "Área não informada"}${single ? "" : " · só muda o campo que você editar"}`}
          </p>
        </div>
        <FormBlock title="Calda, tanques e operação">
          <ApplicationDataFields
            value={draft}
            onChange={(patch) => {
              setDraft((prev) => ({ ...prev, ...patch }));
              setTouched((prev) => new Set([...prev, ...(Object.keys(patch) as ApplicationDraftKey[])]));
            }}
            areaHa={areaHa}
            stageSuggestion={stageSuggestion}
            readOnly={!canEdit || none}
            mixed={common.mixed}
            hideStage={!single}
          />
          {Object.keys(common.mixed).length ? (
            <p className="mt-2 text-[11.5px] text-[#8a5a00]">
              “Vários” = valores diferentes entre as etapas marcadas. Só muda o campo que você editar.
            </p>
          ) : null}
        </FormBlock>
        {canEdit && !none ? (
          <SameStageTargetPicker
            rows={others}
            loading={sameStage.isLoading}
            selectedIds={replicateTargets}
            onSelectedIdsChange={setReplicateTargets}
            syncedRowIds={syncedOtherIds}
            allAppliedToOthers={allAppliedToOthers}
          />
        ) : null}
      </div>
    );

  const n = selectedRecs.length;
  const removingCount = removeTargetIds.length;
  const canSave = n > 0 && (keys.length > 0 || removingCount > 0);
  const saveLabel = saving
    ? "Salvando…"
    : removingCount > 0 && keys.length === 0
      ? removingCount === 1
        ? "Salvar · remover 1 talhão"
        : `Salvar · remover ${removingCount} talhões`
      : n <= 1
        ? "Salvar na etapa"
        : `Salvar nas ${n} etapas`;
  return {
    saving,
    mobilePreviewLabel: "Receitas",
    left: (
      <div className="flex flex-col gap-5">
        {form}
        {list}
      </div>
    ),
    right: (
      <RecipeLivePreview sheets={previewSheets} emptyText="Marque uma etapa para ver a receita como vai sair." />
    ),
    footer: (
      <ExportFooter
        summary={
          n === 0
            ? "Nenhuma etapa marcada"
            : removingCount > 0 && keys.length === 0
              ? `${removingCount} ${removingCount === 1 ? "talhão" : "talhões"} sem dados da aplicação`
              : keys.length
                ? `${keys.length} ${keys.length === 1 ? "campo alterado" : "campos alterados"}` +
                  (removingCount
                    ? ` · remover ${removingCount} ${removingCount === 1 ? "talhão" : "talhões"}`
                    : "")
                : allAppliedToOthers && othersPending > 0
                  ? "Aplicado em todos os talhões"
                  : "Nenhuma alteração"
        }
        sub={
          removingCount > 0
            ? "Use Salvar para confirmar a remoção nos talhões desmarcados."
            : allAppliedToOthers && keys.length === 0 && othersPending > 0
              ? "Desmarque talhões abaixo e salve para remover os dados da aplicação."
              : "Etapas já aplicadas não mudam."
        }
        warn={n === 0}
      >
        <FooterButton tone="ghost" disabled={saving} onClick={onClose}>
          Fechar
        </FooterButton>
        {canEdit ? (
          <FooterButton tone="primary" disabled={saving || !canSave} onClick={() => void save()}>
            {saveLabel}
          </FooterButton>
        ) : null}
      </ExportFooter>
    ),
  };
}

/** Modal do botão "Dados da aplicação" no topo do talhão. */
export function SeasonApplicationDataDialog({
  open,
  onOpenChange,
  seasonId,
  data,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  data: RecommendationShareData;
  canEdit: boolean;
}) {
  const mobile = useIsMobile();
  const [mView, setMView] = useState<"config" | "preview">("config");
  const tab = useSeasonApplicationTab({ open, onClose: () => onOpenChange(false), seasonId, data, canEdit });
  return (
    <ExportShell
      open={open}
      onOpenChange={(next) => !tab.saving && onOpenChange(next)}
      title="Dados da aplicação"
      subtitle={`${data.plotName ? `Talhão ${data.plotName} · ` : ""}vazão, tanque, horário, ponta e estádio — saem na receita de cada etapa.`}
      mobile={mobile}
      mobileView={mView}
      onMobileView={setMView}
      mobilePreviewLabel={tab.mobilePreviewLabel}
      left={tab.left}
      right={tab.right}
      footer={tab.footer}
    />
  );
}
