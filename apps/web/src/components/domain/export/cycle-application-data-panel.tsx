"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Recommendation } from "@recomenda/api";
import { patchRecommendation } from "@recomenda/api/seasons";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCan } from "@recomenda/api-hooks/use-can";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import { nonSprayOperation } from "@recomenda/domain/recommendations/recipe-document";
import {
  ApplicationDataFields,
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
import { ExportFooter, FooterButton, SkeletonList } from "@/components/domain/export/export-ui";
import { stageKey } from "@/components/domain/export/export-helpers";

type StageEntry = { rec: Recommendation; data: RecommendationShareData };

type StageGroup = {
  key: string;
  name: string;
  /** A etapa em cada talhão que a tem. */
  entries: StageEntry[];
  /** Só as pendentes com calda recebem os dados — registradas já foram a campo. */
  pending: StageEntry[];
  operation: string | null;
  firstOrder: number;
};

export function groupStages(datas: RecommendationShareData[]): StageGroup[] {
  const byKey = new Map<string, StageGroup>();
  for (const data of datas) {
    for (const rec of data.recommendations) {
      const key = stageKey(rec.name);
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          name: rec.name,
          entries: [],
          pending: [],
          operation: nonSprayOperation(rec.items),
          firstOrder: rec.order_index,
        };
        byKey.set(key, group);
      }
      group.entries.push({ rec, data });
      if (rec.status === "PENDING" && !nonSprayOperation(rec.items)) group.pending.push({ rec, data });
      group.firstOrder = Math.min(group.firstOrder, rec.order_index);
    }
  }
  return [...byKey.values()].sort((a, b) => a.firstOrder - b.firstOrder || a.name.localeCompare(b.name));
}

/**
 * Aba "Dados da aplicação" do Exportar safra: as etapas agrupadas pelo nome
 * em todos os talhões. Marca um grupo, preenche e grava nas etapas PENDENTES
 * em todos os talhões; a tabela mostra como fica a calda de cada um e a
 * prévia, a receita do primeiro. Hook: entrega as partes da moldura.
 */
export function useCycleApplicationTab({
  items,
  isLoading = false,
  onSeeRecipes,
  onClose,
}: {
  items: RecommendationShareData[];
  isLoading?: boolean;
  /** "Ver receitas →" do toast: vai para a aba Exportar com essas etapas. */
  onSeeRecipes: (stageKeys: string[]) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canEdit = useCan("RECOMMENDATION_EDIT_STRUCTURE");
  const groups = useMemo(() => groupStages(items), [items]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ApplicationDataDraft>(emptyApplicationData());
  const [touched, setTouched] = useState<Set<ApplicationDraftKey>>(new Set());
  const [saving, setSaving] = useState(false);

  const selectedGroups = groups.filter((g) => selected.has(g.key));
  const targets = selectedGroups.flatMap((g) => g.pending);
  const common = commonApplicationDraft(targets.map((t) => t.rec));
  const keys = [...touched].filter((key) => key !== "phenologicalStage");

  const resetForm = (next: Set<string>) => {
    setSelected(next);
    setDraft(
      commonApplicationDraft(groups.filter((g) => next.has(g.key)).flatMap((g) => g.pending.map((t) => t.rec)))
        .value,
    );
    setTouched(new Set());
  };
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    resetForm(next);
  };

  const noPending = groups.every((g) => g.pending.length === 0);

  // Todas as receitas que o salvar vai mudar: talhão a talhão, na ordem das
  // etapas, com o rascunho aplicado.
  const previewSheets = items.map((data) => ({
    ...data,
    recommendations: targets
      .filter((target) => target.data === data)
      .map((target) => withRecipeDraft(target.rec, keys, draft))
      .sort((a, b) => a.order_index - b.order_index),
  }));

  const save = async () => {
    if (targets.length === 0 || keys.length === 0) return;
    const payload = recipeFieldsPayload(keys, draft);
    const savedKeys = selectedGroups.map((g) => g.key);
    const unchanged = selectedGroups.reduce(
      (sum, g) => sum + g.entries.filter((e) => e.rec.status !== "PENDING").length,
      0,
    );
    setSaving(true);
    try {
      for (const { rec } of targets) await patchRecommendation(rec.id, payload);
      // As receitas do Exportar saem com os dados novos.
      void queryClient.invalidateQueries({ queryKey: ["season-timeline"] });
      const n = targets.length;
      toast.success(
        `Salvo em ${n} ${n === 1 ? "etapa pendente" : "etapas pendentes"}.` +
          (unchanged ? ` ${unchanged} ${unchanged === 1 ? "registrada não mudou" : "registradas não mudaram"}.` : ""),
        { action: { label: "Ver receitas →", onClick: () => onSeeRecipes(savedKeys) } },
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
        <span className="text-[11px] font-bold tracking-wider text-[#7a786e] uppercase">Etapas da safra</span>
        <span className="flex gap-2.5 text-[12.5px] font-semibold">
          <button
            type="button"
            className="text-[#2f6d3f] hover:underline"
            onClick={() => resetForm(new Set(groups.filter((g) => g.pending.length).map((g) => g.key)))}
          >
            Pendentes
          </button>
          <button type="button" className="text-[#2f6d3f] hover:underline" onClick={() => resetForm(new Set())}>
            Nenhuma
          </button>
        </span>
      </div>
      {noPending ? (
        <div className="flex gap-2 rounded-[10px] bg-[#e3efe4] p-3 text-[12.5px] text-[#24562f]">
          <Check className="mt-0.5 size-4 flex-none" />
          <span>
            <b>Tudo registrado.</b> Não há etapas pendentes nesta safra — as aplicadas mantêm os dados com que
            foram feitas.
          </span>
        </div>
      ) : null}
      {groups.map((group) => {
        const plots = group.entries.length;
        const pend = group.pending.length;
        const { value, mixed } = commonApplicationDraft(group.pending.map((t) => t.rec));
        const summary = Object.keys(mixed).length ? "Valores diferentes entre talhões" : applicationSummary(value);
        return (
          <DataStageRow
            key={group.key}
            on={selected.has(group.key)}
            disabled={!pend || !canEdit}
            onToggle={() => toggle(group.key)}
            name={group.name}
            badge={pend ? `${pend} ${pend === 1 ? "PENDENTE" : "PENDENTES"}` : "REGISTRADA"}
            badgeTone={pend ? "pending" : "done"}
            sub={
              group.operation
                ? `Operação: ${group.operation} — sem calda`
                : `${plots} ${plots === 1 ? "talhão" : "talhões"} · ${pend ? `${pend} de ${plots} pendentes` : "todas registradas"}`
            }
            summary={group.operation || !pend ? null : (summary ?? "não preenchido")}
            summaryTone={Object.keys(mixed).length ? "mixed" : summary ? "ok" : "empty"}
          />
        );
      })}
    </div>
  );

  const form =
    selectedGroups.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[#d9d6ca] px-4 py-10 text-center text-[13px] text-[#6b6a62]">
        Marque abaixo as etapas que levam a mesma configuração. Vale para todos os talhões da safra — etapas
        já registradas não mudam.
      </div>
    ) : (
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">
            {selectedGroups.length === 1 ? selectedGroups[0].name : `${selectedGroups.length} etapas marcadas`}
          </p>
          <p className="text-xs text-[#6b6a62]">
            {targets.length} {targets.length === 1 ? "aplicação pendente" : "aplicações pendentes"} · cada talhão usa a
            área dele
          </p>
        </div>
        <FormBlock title="Calda, tanque e operação">
          <ApplicationDataFields
            value={draft}
            onChange={(patch) => {
              setDraft((prev) => ({ ...prev, ...patch }));
              setTouched((prev) => new Set([...prev, ...(Object.keys(patch) as ApplicationDraftKey[])]));
            }}
            readOnly={!canEdit}
            mixed={common.mixed}
            hideStage
          />
          {Object.keys(common.mixed).length ? (
            <p className="mt-2 text-[11.5px] text-[#8a5a00]">
              “Vários” = valores diferentes entre os talhões. Só muda o campo que você editar.
            </p>
          ) : null}
        </FormBlock>
      </div>
    );

  const left = isLoading ? (
    <SkeletonList rows={6} />
  ) : groups.length === 0 ? (
    <p className="text-sm text-[#6b6a62]">Nenhuma etapa na safra.</p>
  ) : (
    // Formulário em cima, lista embaixo: a coluna é estreita (mesma proporção
    // das outras abas) e o que se edita fica sempre à vista.
    <div className="flex flex-col gap-5">
      {form}
      {list}
    </div>
  );

  const right = (
    <RecipeLivePreview
      sheets={previewSheets}
      emptyText="Marque uma etapa pendente para ver a receita como vai sair."
    />
  );

  const footer = (
    <ExportFooter
      summary={
        isLoading
          ? "Carregando…"
          : targets.length
            ? keys.length
              ? `${keys.length} ${keys.length === 1 ? "campo alterado" : "campos alterados"}`
              : "Nenhuma alteração"
            : "Nenhuma etapa marcada"
      }
      sub="Etapas já aplicadas não mudam."
      warn={!isLoading && targets.length === 0}
    >
      <FooterButton tone="ghost" disabled={saving} onClick={onClose}>
        Fechar
      </FooterButton>
      {canEdit ? (
        <FooterButton
          tone="primary"
          disabled={saving || targets.length === 0 || keys.length === 0}
          onClick={() => void save()}
        >
          {saving
            ? "Salvando…"
            : selectedGroups.length <= 1
              ? "Salvar na etapa"
              : `Salvar nas ${selectedGroups.length} etapas`}
        </FooterButton>
      ) : null}
    </ExportFooter>
  );

  return { left, right, footer, saving, mobilePreviewLabel: "Receita" };
}
