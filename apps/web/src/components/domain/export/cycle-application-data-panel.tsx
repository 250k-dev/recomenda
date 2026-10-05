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
  PlotPicker,
  type PlotOption,
  RecipeLivePreview,
  withRecipeDraft,
} from "@/components/domain/export/application-data-ui";
import { ExportFooter, FooterButton, SkeletonList } from "@/components/domain/export/export-ui";
import { stageKey } from "@/components/domain/export/export-helpers";

type StageEntry = { rec: Recommendation; data: RecommendationShareData; plotId: string };

/** Um talhão da safra no "Onde aplicar". */
export type ApplicationPlotItem = { id: string; label: string; data: RecommendationShareData };

const sprayPending = (rec: Recommendation) => rec.status === "PENDING" && !nonSprayOperation(rec.items);

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

export function groupStages(plots: ApplicationPlotItem[]): StageGroup[] {
  const byKey = new Map<string, StageGroup>();
  for (const { id: plotId, data } of plots) {
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
      group.entries.push({ rec, data, plotId });
      if (sprayPending(rec)) group.pending.push({ rec, data, plotId });
      group.firstOrder = Math.min(group.firstOrder, rec.order_index);
    }
  }
  return [...byKey.values()].sort((a, b) => a.firstOrder - b.firstOrder || a.name.localeCompare(b.name));
}

/**
 * Aba "Dados da aplicação" do Exportar safra. Primeiro "onde aplicar"
 * (fazendas e talhões — pulverizadores diferentes por fazenda), depois as
 * etapas pelo nome, só as que existem nesses talhões. Grava nas etapas
 * PENDENTES dos talhões marcados. A prévia mostra uma receita por etapa (de um
 * talhão de exemplo, escolhível): com 200 talhões, 200 folhas iguais não
 * ajudam a conferir e travam a tela. Hook: entrega as partes da moldura.
 */
export function useCycleApplicationTab({
  open,
  items,
  isLoading = false,
  onSeeRecipes,
  onClose,
}: {
  /** Diálogo aberto: a cada abertura, nada marcado. */
  open: boolean;
  items: ApplicationPlotItem[];
  isLoading?: boolean;
  /** "Ver receitas →" do toast: vai para a aba Exportar com essas etapas nesses talhões. */
  onSeeRecipes: (stageKeys: string[], plotIds: string[]) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canEdit = useCan("RECOMMENDATION_EDIT_STRUCTURE");
  const [plots, setPlots] = useState<Set<string>>(new Set());
  const scoped = useMemo(() => items.filter((item) => plots.has(item.id)), [items, plots]);
  const groups = useMemo(() => groupStages(scoped), [scoped]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPlot, setPreviewPlot] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApplicationDataDraft>(emptyApplicationData());
  const [touched, setTouched] = useState<Set<ApplicationDraftKey>>(new Set());

  // A cada abertura do diálogo: nenhum talhão nem etapa marcados.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPlots(new Set());
      setSelected(new Set());
      setPreviewPlot(null);
      setDraft(emptyApplicationData());
      setTouched(new Set());
    }
  }
  const [saving, setSaving] = useState(false);

  const selectedGroups = groups.filter((g) => selected.has(g.key));
  const targets = selectedGroups.flatMap((g) => g.pending);
  const common = commonApplicationDraft(targets.map((t) => t.rec));
  const keys = [...touched].filter((key) => key !== "phenologicalStage");

  const resetForm = (next: Set<string>, scope: StageGroup[] = groups) => {
    setSelected(next);
    setDraft(
      commonApplicationDraft(scope.filter((g) => next.has(g.key)).flatMap((g) => g.pending.map((t) => t.rec)))
        .value,
    );
    setTouched(new Set());
  };
  // Trocar os talhões recalcula o "comum" do formulário no recorte novo.
  const changePlots = (next: Set<string>) => {
    setPlots(next);
    resetForm(selected, groupStages(items.filter((item) => next.has(item.id))));
  };

  const plotOptions: PlotOption[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    farmName: item.data.spec?.farmName ?? "Sem fazenda",
    areaHa: item.data.spec?.plantedAreaHa ?? item.data.spec?.areaHa ?? null,
    pending: item.data.recommendations.filter(sprayPending).length,
  }));
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    resetForm(next);
  };

  const noPending = groups.every((g) => g.pending.length === 0);

  // Prévia: uma receita por etapa marcada, do talhão de exemplo (ou, onde
  // ele não tem a etapa pendente, do primeiro que tem).
  const previewCandidates = items.filter((item) => targets.some((t) => t.plotId === item.id));
  const examplePlot =
    previewCandidates.find((item) => item.id === previewPlot)?.id ?? previewCandidates[0]?.id ?? null;
  const examples = selectedGroups
    .map((g) => g.pending.find((t) => t.plotId === examplePlot) ?? g.pending[0])
    .filter((t): t is StageEntry => Boolean(t));
  const previewSheets = items.map((item) => ({
    ...item.data,
    recommendations: examples
      .filter((t) => t.plotId === item.id)
      .map((t) => withRecipeDraft(t.rec, keys, draft))
      .sort((a, b) => a.order_index - b.order_index),
  }));

  const save = async () => {
    if (targets.length === 0 || keys.length === 0) return;
    const payload = recipeFieldsPayload(keys, draft);
    const savedKeys = selectedGroups.map((g) => g.key);
    const savedPlots = [...plots];
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
        { action: { label: "Ver receitas →", onClick: () => onSeeRecipes(savedKeys, savedPlots) } },
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
      {plots.size === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[#d9d6ca] px-3 py-4 text-center text-[12.5px] text-[#6b6a62]">
          Marque acima os talhões para ver as etapas deles.
        </p>
      ) : noPending ? (
        <div className="flex gap-2 rounded-[10px] bg-[#e3efe4] p-3 text-[12.5px] text-[#24562f]">
          <Check className="mt-0.5 size-4 flex-none" />
          <span>
            <b>Tudo registrado.</b> Não há etapas pendentes nesses talhões — as aplicadas mantêm os dados com
            que foram feitas.
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

  // O formulário fica sempre à vista; sem etapa marcada, desabilitado.
  const noTargets = targets.length === 0;
  const form = (
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">
            {noTargets
              ? "Nenhuma etapa marcada"
              : selectedGroups.length === 1
                ? selectedGroups[0].name
                : `${selectedGroups.length} etapas marcadas`}
          </p>
          <p className="text-xs text-[#6b6a62]">
            {noTargets
              ? "Marque os talhões e, abaixo, as etapas para preencher."
              : `${targets.length} ${targets.length === 1 ? "aplicação pendente" : "aplicações pendentes"} · cada talhão usa a área dele`}
          </p>
        </div>
        <FormBlock title="Calda, tanque e operação">
          <ApplicationDataFields
            value={draft}
            onChange={(patch) => {
              setDraft((prev) => ({ ...prev, ...patch }));
              setTouched((prev) => new Set([...prev, ...(Object.keys(patch) as ApplicationDraftKey[])]));
            }}
            readOnly={!canEdit || noTargets}
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
  ) : items.length === 0 ? (
    <p className="text-sm text-[#6b6a62]">Nenhum talhão na safra.</p>
  ) : (
    // Onde aplicar → formulário → etapas: a coluna é estreita (mesma proporção
    // das outras abas) e o que se edita fica sempre à vista.
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#7a786e] uppercase">Onde aplicar</span>
          <span className="flex gap-2.5 text-[12.5px] font-semibold">
            <button
              type="button"
              className="text-[#2f6d3f] hover:underline"
              onClick={() => changePlots(new Set(items.map((item) => item.id)))}
            >
              Todos
            </button>
            <button type="button" className="text-[#2f6d3f] hover:underline" onClick={() => changePlots(new Set())}>
              Nenhum
            </button>
          </span>
        </div>
        <PlotPicker plots={plotOptions} selected={plots} onChange={changePlots} />
      </div>
      {form}
      {list}
    </div>
  );

  const right = (
    <RecipeLivePreview
      sheets={previewSheets}
      emptyText="Marque os talhões e uma etapa pendente para ver a receita como vai sair."
      extra={
        previewCandidates.length > 1 ? (
          <select
            aria-label="Talhão de exemplo da prévia"
            value={examplePlot ?? ""}
            onChange={(event) => setPreviewPlot(event.target.value)}
            className="h-8 max-w-44 truncate rounded-lg border border-[#d9d6ca] bg-white px-2 text-xs"
          >
            {previewCandidates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null
      }
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
