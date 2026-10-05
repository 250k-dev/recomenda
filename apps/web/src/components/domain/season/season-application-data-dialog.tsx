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
import { cn } from "@recomenda/utils";
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
  RecipeLivePreview,
  withRecipeDraft,
} from "@/components/domain/export/application-data-ui";
import { ExportFooter, ExportShell, FooterButton, TriCheck } from "@/components/domain/export/export-ui";
import { shortDate } from "@/components/domain/export/export-helpers";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

/** Só etapa pendente e com calda recebe dados da aplicação. */
function editable(rec: Recommendation): boolean {
  return rec.status === "PENDING" && !nonSprayOperation(rec.items);
}

/**
 * "Dados da aplicação" do talhão: marca as etapas que levam a mesma
 * configuração, preenche e salva; depois outro grupo. Só os campos mexidos
 * são gravados — "Vários" intocado preserva o valor de cada etapa. À direita,
 * a receita como vai sair, a cada tecla.
 */
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
  /** O mesmo payload do Exportar (ficha do talhão + etapas). */
  data: RecommendationShareData;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const mobile = useIsMobile();
  const recommendations = data.recommendations;
  const areaHa = data.spec?.plantedAreaHa ?? data.spec?.areaHa ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ApplicationDataDraft>(emptyApplicationData());
  const [touched, setTouched] = useState<Set<ApplicationDraftKey>>(new Set());
  const [replicate, setReplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mView, setMView] = useState<"config" | "preview">("config");

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
      setMView("config");
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

  const form =
    selectedRecs.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[#d9d6ca] px-4 py-10 text-center text-[13px] text-[#6b6a62]">
        {editableIds.length
          ? "Marque abaixo uma ou mais etapas pendentes para preencher."
          : "Não há etapas pendentes com calda neste talhão — as registradas mantêm os dados com que foram feitas."}
      </div>
    ) : (
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">{single ? single.name : `${selectedRecs.length} etapas marcadas`}</p>
          <p className="text-xs text-[#6b6a62]">
            {areaHa ? `${areaHa.toLocaleString("pt-BR")} ha` : "Área não informada"}
            {single ? "" : " · só muda o campo que você editar"}
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
            readOnly={!canEdit}
            mixed={common.mixed}
            hideStage={!single}
          />
          {Object.keys(common.mixed).length ? (
            <p className="mt-2 text-[11.5px] text-[#8a5a00]">
              “Vários” = valores diferentes entre as etapas marcadas. Só muda o campo que você editar.
            </p>
          ) : null}
        </FormBlock>
        {canEdit ? (
          <div className="rounded-xl border border-[#e2e0d6] bg-white">
            <button
              type="button"
              onClick={() => setReplicate((v) => !v)}
              className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
            >
              <span className="mt-0.5">
                <TriCheck state={replicate ? "on" : "off"} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold">Aplicar também nos outros talhões</span>
                <span className="block text-xs text-[#6b6a62]">
                  Mesma etapa, ainda pendente, nos outros talhões da safra.
                </span>
              </span>
            </button>
            <div className="flex flex-wrap gap-1.5 border-t border-[#efede5] px-3.5 py-2.5">
              {sameStage.isLoading ? (
                <span className="text-xs text-[#7a786e]">Procurando nos outros talhões…</span>
              ) : others.length === 0 ? (
                <span className="rounded-full bg-[#f6f4ee] px-2 py-0.5 text-[11.5px] text-[#7a786e]">
                  Nenhum outro talhão tem essa etapa.
                </span>
              ) : (
                others.map((row) => {
                  const pending = row.status === "PENDING";
                  return (
                    <span
                      key={row.id}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11.5px]",
                        !pending
                          ? "bg-[#f6f4ee] text-[#a3a094]"
                          : replicate
                            ? "bg-[#e3efe4] text-[#24562f]"
                            : "bg-[#efede5] text-[#55534b]",
                      )}
                    >
                      {row.plot_name} · {row.name} — {pending ? "recebe" : APPLIED.has(row.status) ? "registrada, não muda" : "pulada, não muda"}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    );

  const n = selectedRecs.length;
  return (
    <ExportShell
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title="Dados da aplicação"
      subtitle={`${data.plotName ? `Talhão ${data.plotName} · ` : ""}vazão, tanque, horário, ponta e estádio — saem na receita de cada etapa.`}
      mobile={mobile}
      mobileView={mView}
      onMobileView={setMView}
      left={
        <div className="flex flex-col gap-5">
          {form}
          {list}
        </div>
      }
      right={
        <RecipeLivePreview
          sheets={previewSheets}
          emptyText="Marque uma etapa para ver a receita como vai sair."
        />
      }
      footer={
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
          <FooterButton tone="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Fechar
          </FooterButton>
          {canEdit ? (
            <FooterButton tone="primary" disabled={saving || n === 0 || keys.length === 0} onClick={() => void save()}>
              {saving ? "Salvando…" : n <= 1 ? "Salvar na etapa" : `Salvar nas ${n} etapas`}
            </FooterButton>
          ) : null}
        </ExportFooter>
      }
    />
  );
}
