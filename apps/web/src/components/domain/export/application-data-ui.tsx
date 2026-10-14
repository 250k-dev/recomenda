"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Recommendation } from "@recomenda/api";
import type { SameStageRecommendation } from "@recomenda/api/seasons";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import { buildApplicationRecipesHtml } from "@recomenda/domain/recommendations/recipe-document";
import { cn } from "@recomenda/utils";
import {
  applicationRecipeFingerprint,
  hasApplicationRecipeData,
  stageKey,
} from "@/components/domain/export/export-helpers";
import {
  recipeFieldsPayload,
  type ApplicationDataDraft,
  type ApplicationDraftKey,
} from "@/components/domain/application-data-fields";
import { DEFAULT_PREVIEW_ZOOM, PagedPreview, type PreviewZoom } from "@/components/domain/export/paged-preview";
import { PreviewEmpty, PreviewToolbar, TriCheck, triOf } from "@/components/domain/export/export-ui";

/**
 * Peças do "Dados da aplicação" (talhão e aba da safra): linha de etapa,
 * bloco do formulário e a prévia viva da receita.
 */

/** A etapa como ficaria salva: só os campos mexidos mudam. */
export function withRecipeDraft(
  rec: Recommendation,
  keys: ApplicationDraftKey[],
  draft: ApplicationDataDraft,
): Recommendation {
  return { ...rec, ...recipeFieldsPayload(keys, draft) } as Recommendation;
}

const BADGE_TONE = {
  pending: "bg-[#e1eff6] text-[#2b6a86]",
  done: "bg-[#e3efe4] text-[#2f6d3f]",
  skipped: "bg-[#fde4d6] text-[#b8541f]",
} as const;

export function DataStageRow({
  on,
  disabled,
  onToggle,
  name,
  badge,
  badgeTone,
  sub,
  summary,
  summaryTone = "ok",
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  name: string;
  badge: string;
  badgeTone: keyof typeof BADGE_TONE;
  sub: string;
  summary?: string | null;
  summaryTone?: "ok" | "empty" | "mixed";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
        on ? "border-[#9fb89f] bg-[#f3f6f1]" : "border-[#e2e0d6] bg-white",
        disabled ? "cursor-default opacity-60" : "hover:border-[#9fb89f]",
      )}
    >
      <span className="mt-0.5">
        <TriCheck state={on ? "on" : "off"} disabled={disabled} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap",
              BADGE_TONE[badgeTone],
            )}
          >
            {badge}
          </span>
        </span>
        <span className="block truncate text-[11.5px] text-[#7a786e]">{sub}</span>
        {summary ? (
          <span
            className={cn(
              "block truncate text-[11.5px] font-medium",
              summaryTone === "ok" && "text-[#2f6d3f]",
              summaryTone === "empty" && "text-[#a3a094]",
              summaryTone === "mixed" && "text-[#8a5a00]",
            )}
          >
            {summary}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export type PlotOption = {
  id: string;
  label: string;
  farmName: string;
  areaHa: number | null;
  /** Etapas pendentes com calda neste talhão. */
  pending: number;
};

/**
 * "Onde aplicar": fazendas e talhões da safra. Marcar a fazenda marca os
 * talhões dela. Os dados salvos valem só para os talhões marcados — fazendas
 * diferentes costumam ter pulverizadores diferentes.
 */
export function PlotPicker({
  plots,
  selected,
  onChange,
}: {
  plots: PlotOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const farms = useMemo(() => {
    const map = new Map<string, PlotOption[]>();
    for (const plot of plots) map.set(plot.farmName, [...(map.get(plot.farmName) ?? []), plot]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [plots]);
  const setIds = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e0d6] bg-white">
      {farms.map(([farmName, farmPlots]) => {
        const ids = farmPlots.map((p) => p.id);
        const tri = triOf(ids.map((id) => selected.has(id)));
        return (
          <div key={farmName} className="border-b border-[#efede5] last:border-b-0">
            <button
              type="button"
              onClick={() => setIds(ids, tri !== "on")}
              className="flex w-full items-center gap-2.5 bg-[#f6f4ee] px-3 py-2 text-left"
            >
              <TriCheck state={tri} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{farmName}</span>
              <span className="text-xs text-[#6b6a62] tabular-nums">
                {ids.filter((id) => selected.has(id)).length}/{ids.length}
              </span>
            </button>
            <div className="max-h-56 overflow-y-auto">
              {farmPlots.map((plot) => {
                const on = selected.has(plot.id);
                return (
                  <button
                    key={plot.id}
                    type="button"
                    onClick={() => setIds([plot.id], !on)}
                    className="flex w-full items-center gap-2.5 border-t border-[#f1f0ea] py-1.5 pr-3 pl-7 text-left"
                  >
                    <TriCheck state={on ? "on" : "off"} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{plot.label}</span>
                    {plot.areaHa ? (
                      <span className="text-[11.5px] text-[#7a786e] tabular-nums">
                        {plot.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha
                      </span>
                    ) : null}
                    <span className={cn("w-20 text-right text-[11.5px]", plot.pending ? "text-[#2b6a86]" : "text-[#a3a094]")}>
                      {plot.pending ? `${plot.pending} ${plot.pending === 1 ? "pendente" : "pendentes"}` : "tudo registrado"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Todos os talhões pendentes da lista (mesma etapa em outros plots). */
export function allPendingSameStageIds(rows: SameStageRecommendation[]): Set<string> {
  return new Set(rows.filter((row) => row.status === "PENDING").map((row) => row.id));
}

/** Talhões pendentes cuja receita já bate com a etapa marcada no talhão atual. */
export function syncedSameStageRowIds(
  rows: SameStageRecommendation[],
  sources: Recommendation[],
): Set<string> {
  const sourceByStage = new Map<string, Recommendation>();
  for (const rec of sources) sourceByStage.set(stageKey(rec.name), rec);
  const synced = new Set<string>();
  for (const row of rows) {
    if (row.status !== "PENDING") continue;
    const source = sourceByStage.get(stageKey(row.name));
    if (!source || !hasApplicationRecipeData(source)) continue;
    if (applicationRecipeFingerprint(source) === applicationRecipeFingerprint(row)) synced.add(row.id);
  }
  return synced;
}

/**
 * "Aplicar também nos outros talhões": checkbox em cada talhão pendente e
 * "todos" no topo (liga/desliga todos). Etapas já registradas só aparecem
 * como leitura.
 */
export function SameStageTargetPicker({
  rows,
  loading,
  selectedIds,
  onSelectedIdsChange,
  title = "Aplicar também nos outros talhões",
  syncedRowIds,
  allAppliedToOthers = false,
  defaultExpanded = false,
}: {
  rows: SameStageRecommendation[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  title?: string;
  defaultExpanded?: boolean;
  syncedRowIds?: Set<string>;
  /** Todos os pendentes já têm os mesmos dados da etapa marcada aqui. */
  allAppliedToOthers?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  useEffect(() => {
    if (defaultExpanded && rows.length > 0) setOpen(true);
  }, [defaultExpanded, rows.length]);
  useEffect(() => {
    if (allAppliedToOthers && rows.length > 0) setOpen(true);
  }, [allAppliedToOthers, rows.length]);
  const pendingRows = rows.filter((row) => row.status === "PENDING");
  const pendingIds = pendingRows.map((row) => row.id);
  const locked = rows.length - pendingRows.length;
  const selectedPending = pendingIds.filter((id) => selectedIds.has(id)).length;
  const masterTri = triOf(pendingIds.map((id) => selectedIds.has(id)));

  const byStage = useMemo(() => {
    const map = new Map<string, SameStageRecommendation[]>();
    for (const row of rows) map.set(row.name, [...(map.get(row.name) ?? []), row]);
    return [...map.entries()];
  }, [rows]);

  const toggleAll = () => {
    if (pendingIds.length === 0) return;
    const allOn = pendingIds.every((id) => selectedIds.has(id));
    onSelectedIdsChange(allOn ? new Set() : new Set(pendingIds));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  };

  const summary = loading
    ? "Procurando nos outros talhões…"
    : rows.length === 0
      ? "Nenhum outro talhão tem essa etapa."
      : allAppliedToOthers && selectedPending === pendingRows.length && pendingRows.length > 0
        ? `Aplicado em todos os ${pendingRows.length} ${pendingRows.length === 1 ? "talhão" : "talhões"}`
        : [
            pendingRows.length
              ? `${selectedPending} de ${pendingRows.length} ${pendingRows.length === 1 ? "talhão" : "talhões"} selecionado${selectedPending === 1 ? "" : "s"}`
              : "nenhum pendente",
            locked ? `${locked} ${locked === 1 ? "registrada não muda" : "registradas não mudam"}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

  return (
    <div className="rounded-xl border border-[#e2e0d6] bg-white">
      <div className="flex items-start gap-1 px-2 py-2">
        <button
          type="button"
          aria-label="Selecionar todos os talhões pendentes"
          onClick={toggleAll}
          disabled={loading || pendingIds.length === 0}
          className="flex size-8 shrink-0 items-start justify-center rounded-md pt-2 hover:bg-black/5 disabled:opacity-50"
        >
          <TriCheck state={masterTri} disabled={pendingIds.length === 0} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={loading || rows.length === 0}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 py-1.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{title}</span>
            <span className="block truncate text-xs text-[#6b6a62]">{summary}</span>
          </span>
          {rows.length ? (
            <ChevronDown className={cn("mt-1 size-4 shrink-0 text-[#7a786e] transition-transform", open && "rotate-180")} />
          ) : null}
        </button>
      </div>
      {open && rows.length ? (
        <div className="max-h-64 overflow-y-auto border-t border-[#efede5]">
          {byStage.map(([stage, stageRows]) => (
            <div key={stage}>
              <p className="sticky top-0 bg-[#f6f4ee] px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-[#55534b] uppercase">
                {stage}
                <span className="ml-1.5 font-medium normal-case text-[#7a786e]">
                  · {stageRows.length} {stageRows.length === 1 ? "talhão" : "talhões"}
                </span>
              </p>
              {stageRows.map((row) => {
                const isPending = row.status === "PENDING";
                const on = selectedIds.has(row.id);
                const synced = Boolean(syncedRowIds?.has(row.id));
                const badgeLabel = !isPending
                  ? row.status === "SKIPPED"
                    ? "pulada"
                    : "registrada"
                  : synced && on
                    ? "aplicado"
                    : isPending && on
                      ? "recebe"
                      : "fora";
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 border-t border-[#f1f0ea] px-3.5 py-1.5 text-[12.5px]"
                  >
                    {isPending ? (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => toggleOne(row.id)}
                      >
                        <TriCheck state={on ? "on" : "off"} />
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            synced && on && allAppliedToOthers && "text-[#7a786e]",
                          )}
                        >
                          {row.plot_name}
                          <span className="text-[#a3a094]"> · {row.farm_name}</span>
                        </span>
                      </button>
                    ) : (
                      <span className={cn("min-w-0 flex-1 truncate pl-7 text-[#a3a094]")}>
                        {row.plot_name}
                        <span> · {row.farm_name}</span>
                      </span>
                    )}
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        !isPending
                          ? "bg-[#f1f0ea] text-[#a3a094]"
                          : synced && on
                            ? "bg-[#dce8dd] text-[#3d6848]"
                            : on
                              ? "bg-[#e3efe4] text-[#2f6d3f]"
                              : "bg-[#efede5] text-[#55534b]",
                      )}
                    >
                      {badgeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
      {allAppliedToOthers && pendingRows.length > 0 && selectedPending === pendingRows.length ? (
        <p className="border-t border-[#efede5] px-3.5 py-2 text-[11.5px] text-[#6b6a62]">
          Desmarque talhões e use Salvar no rodapé para remover os dados da aplicação.
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use {@link SameStageTargetPicker} com `selectedIds`. */
export function SameStageDisclosure(props: {
  rows: SameStageRecommendation[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
}) {
  return <SameStageTargetPicker {...props} />;
}

export function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e2e0d6] bg-white p-3.5">
      <p className="mb-2.5 text-[11px] font-bold tracking-wider text-[#7a786e] uppercase">{title}</p>
      {children}
    </div>
  );
}

/**
 * Coluna direita: as receitas das etapas marcadas, como vão sair, a cada
 * tecla. `sheets` = um bloco por talhão, só com as etapas marcadas dele.
 */
export function RecipeLivePreview({
  sheets,
  emptyText,
  extra,
}: {
  sheets: RecommendationShareData[];
  emptyText: string;
  /** Controle extra na barra (ex.: seletor do talhão de exemplo). */
  extra?: ReactNode;
}) {
  const [zoom, setZoom] = useState<PreviewZoom>(DEFAULT_PREVIEW_ZOOM);
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [total, setTotal] = useState(0);
  const filled = sheets.filter((sheet) => sheet.recommendations.length > 0);
  const html = useMemo(
    () => (filled.length ? buildApplicationRecipesHtml(filled, "Receitas de aplicação") : null),
    [filled],
  );
  return (
    <>
      <PreviewToolbar
        title={
          <span>
            {filled.length === 1 && filled[0].recommendations.length === 1 ? "Prévia da receita" : "Prévia das receitas"}
            {html && total ? (
              <span className="ml-1.5 font-normal text-[#6b6a62]">
                · {total} {total === 1 ? "folha" : "folhas"}
              </span>
            ) : null}
          </span>
        }
        zoom={zoom}
        effectiveZoom={effectiveZoom}
        onZoom={setZoom}
        extra={extra}
      />
      <PagedPreview
        html={html}
        zoom={zoom}
        onPaged={(result) => setTotal(result.total)}
        onEffectiveZoom={setEffectiveZoom}
        empty={<PreviewEmpty title="Sem prévia" text={emptyText} />}
      />
    </>
  );
}
