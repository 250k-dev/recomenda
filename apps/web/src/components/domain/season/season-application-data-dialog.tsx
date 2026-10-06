"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Recommendation } from "@recomenda/api";
import { patchRecommendation } from "@recomenda/api/seasons";
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
  SameStageDisclosure,
  RecipeLivePreview,
  withRecipeDraft,
} from "@/components/domain/export/application-data-ui";
import { ExportFooter, ExportShell, FooterButton } from "@/components/domain/export/export-ui";
import { shortDate } from "@/components/domain/export/export-helpers";

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
  const [replicate, setReplicate] = useState(false);
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
      setReplicate(false);
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
  const others = selectedIds.flatMap((id) => sameStage.byId[id] ?? []);
  const othersPending = others.filter((row) => row.status === "PENDING").length;

  const keys = [...touched].filter((key) => key !== "phenologicalStage" || single);
  // Uma folha por etapa marcada, com o rascunho aplicado.
  const previewSheets = [
    { ...data, recommendations: selectedRecs.map((rec) => withRecipeDraft(rec, keys, draft)) },
  ];

  const save = async () => {
    if (selectedRecs.length === 0 || keys.length === 0) return;
    const payload = recipeFieldsPayload(keys, draft);
    setSaving(true);
    let replicated = 0;
    try {
      for (const rec of selectedRecs) {
        const result = await patchRecommendation(rec.id, {
          ...payload,
          ...(replicate ? { apply_to_same_stage: true } : {}),
        });
        replicated += result?.replicated ?? 0;
      }
      void queryClient.invalidateQueries({
        queryKey: replicate ? ["season-timeline"] : ["season-timeline", seasonId],
      });
      void queryClient.invalidateQueries({ queryKey: ["same-stage"] });
      const n = selectedRecs.length;
      const unchanged = replicate ? others.length - othersPending : 0;
      toast.success(
        `Salvo em ${n} ${n === 1 ? "etapa" : "etapas"}` +
          (replicated ? ` e em mais ${replicated} nos outros talhões` : "") +
          "." +
          (unchanged ? ` ${unchanged} ${unchanged === 1 ? "registrada não mudou" : "registradas não mudaram"}.` : ""),
      );
      setTouched(new Set());
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
          <SameStageDisclosure
            rows={others}
            loading={sameStage.isLoading}
            replicate={replicate}
            onToggleReplicate={() => setReplicate((v) => !v)}
          />
        ) : null}
      </div>
    );

  const n = selectedRecs.length;
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
            : keys.length
              ? `${keys.length} ${keys.length === 1 ? "campo alterado" : "campos alterados"}`
              : "Nenhuma alteração"
        }
        sub="Etapas já aplicadas não mudam."
        warn={n === 0}
      >
        <FooterButton tone="ghost" disabled={saving} onClick={onClose}>
          Fechar
        </FooterButton>
        {canEdit ? (
          <FooterButton tone="primary" disabled={saving || n === 0 || keys.length === 0} onClick={() => void save()}>
            {saving ? "Salvando…" : n <= 1 ? "Salvar na etapa" : `Salvar nas ${n} etapas`}
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
