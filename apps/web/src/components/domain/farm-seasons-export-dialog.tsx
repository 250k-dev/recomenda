"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { useIsMobile } from "@recomenda/ui/hooks/use-mobile";
import {
  buildMultiWhatsappMessage,
  type RecommendationShareData,
} from "@recomenda/domain/recommendations/share-message";
import type { DocumentCover } from "@recomenda/domain/recommendations/print-document";
import { countApplicationRecipes } from "@recomenda/domain/recommendations/recipe-document";
import { buildExportHtml } from "@recomenda/domain/recommendations/export-document";
import { displayRecStatus } from "@recomenda/domain/recommendations/format";
import type {
  NotebookSectionId,
  SeasonNotebookData,
} from "@recomenda/domain/season-notebook/notebook-document";
import { cn } from "@recomenda/utils";
import {
  readPricePreference,
  writePricePreference,
} from "@/components/domain/export/price-preference";
import { useNotebookTab } from "@/components/domain/export/season-notebook-panel";
import { useCycleApplicationTab } from "@/components/domain/export/cycle-application-data-panel";
import {
  PagedPreview,
  DEFAULT_PREVIEW_ZOOM,
  type PagedPreviewHandle,
  type PreviewZoom,
} from "@/components/domain/export/paged-preview";
import {
  ExportFooter,
  ExportShell,
  FooterButton,
  PartCard,
  Pills,
  PreviewEmpty,
  PreviewToolbar,
  PriceSwitch,
  SkeletonList,
  StatusBadge,
  Step,
  TriCheck,
  WhatsappButton,
  fmtPages,
  triOf,
} from "@/components/domain/export/export-ui";
import {
  copyText,
  openWhatsapp,
  pagesByPart,
  partsSummary,
  stageKey,
  stageWhen,
} from "@/components/domain/export/export-helpers";
import { printPaged, type PagedResult } from "@/lib/print/paged-document";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

export interface FarmExportItem {
  id: string;
  label: string;
  data: RecommendationShareData;
}

type Tab = "export" | "application" | "notebook";
type Mode = "stage" | "plot" | "full";

const MODE_HELP: Record<Mode, string> = {
  stage: "Marque a etapa uma vez e ela entra em todos os talhões que a têm — ideal para a aplicação da semana.",
  plot: "Escolha talhão a talhão e, dentro de cada um, as etapas.",
  full: "Todos os talhões e todas as etapas da safra.",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function FarmSeasonsExportDialog({
  open,
  onOpenChange,
  farmName,
  contextLabel = "FAZENDA",
  isLoading = false,
  items,
  cover,
  notebook,
  notebookUnavailable,
  applicationData = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName?: string | null;
  contextLabel?: string;
  isLoading?: boolean;
  items: FarmExportItem[];
  /** Capa do documento (números da safra/fazenda + consolidado). */
  cover?: DocumentCover | null;
  /** Dados do Caderno de Safra. Ausente → a aba não aparece. */
  notebook?: SeasonNotebookData | null;
  /** Sobrescreve o motivo padrão de uma seção indisponível do caderno. */
  notebookUnavailable?: Partial<Record<NotebookSectionId, string>>;
  /** Aba "Dados da aplicação": configura as etapas da safra em todos os talhões. */
  applicationData?: boolean;
}) {
  const mobile = useIsMobile();
  const previewRef = useRef<PagedPreviewHandle>(null);
  const [tab, setTab] = useState<Tab>("export");
  const [mode, setMode] = useState<Mode>("stage");
  const [treeOpen, setTreeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Nada vem marcado: o usuário escolhe o que entra (e a prévia nasce dele).
  const [incReport, setIncReport] = useState(false);
  const [incRecipes, setIncRecipes] = useState(false);
  const [showPrices, setShowPrices] = useState(() => readPricePreference());
  const [zoom, setZoom] = useState<PreviewZoom>(DEFAULT_PREVIEW_ZOOM);
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [mView, setMView] = useState<"config" | "preview">("config");
  const [paged, setPaged] = useState<PagedResult | null>(null);
  const [partPages, setPartPages] = useState({ report: 0, recipes: 0 });
  const [notebookDragging, setNotebookDragging] = useState(false);

  // Preço: só quando o payload traz (quem exporta tem PRICE_VIEW). A lista de
  // compra conta: no caderno ela pode trazer preço mesmo sem o cronograma.
  const canPrice =
    items.some((item) => item.data.unitPriceByProduct) ||
    (notebook?.purchaseList?.items ?? []).some((item) => Number(item.unit_price_brl) > 0);
  const priced = canPrice && showPrices;
  const togglePrices = () =>
    setShowPrices((value) => {
      writePricePreference(!value);
      return !value;
    });

  const allRecs = useMemo(() => items.flatMap((i) => i.data.recommendations), [items]);
  const allIds = useMemo(() => allRecs.map((r) => r.id), [allRecs]);
  const allKey = allIds.join("|");

  // Ao abrir (ou quando os talhões chegam): nada marcado, aba Exportar.
  const [resetKey, setResetKey] = useState("");
  const nextResetKey = open ? allKey : "";
  if (nextResetKey !== resetKey) {
    setResetKey(nextResetKey);
    if (open) {
      setTab("export");
      setMode("stage");
      setTreeOpen(false);
      setSelected(new Set());
      setIncReport(false);
      setIncRecipes(false);
      setMView("config");
      setPaged(null);
    }
  }

  /** Etapas da safra pelo nome (a mesma etapa em vários talhões). */
  const stageGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; ids: string[]; pending: number; order: number }>();
    for (const item of items) {
      for (const rec of item.data.recommendations) {
        const key = stageKey(rec.name);
        const group = map.get(key) ?? { key, name: rec.name.trim(), ids: [], pending: 0, order: rec.order_index };
        group.ids.push(rec.id);
        if (rec.status === "PENDING") group.pending += 1;
        group.order = Math.min(group.order, rec.order_index);
        map.set(key, group);
      }
    }
    return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
  }, [items]);

  /** Talhões agrupados pela fazenda (safra multi-fazenda). */
  const farmGroups = useMemo(() => {
    const map = new Map<string, FarmExportItem[]>();
    for (const item of items) {
      const name = item.data.spec?.farmName ?? "Sem fazenda";
      map.set(name, [...(map.get(name) ?? []), item]);
    }
    return [...map.entries()]
      .map(([name, groupItems]) => ({ name, items: groupItems }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items]);

  const selectedItems = useMemo(
    () =>
      items
        .map((item) => {
          if (item.data.recommendations.every((rec) => selected.has(rec.id))) return item;
          const recommendations = item.data.recommendations.filter((rec) => selected.has(rec.id));
          const done = recommendations.filter((rec) => APPLIED.has(rec.status)).length;
          return { ...item, data: { ...item.data, recommendations, done, total: recommendations.length } };
        })
        .filter((item) => item.data.recommendations.length > 0),
    [items, selected],
  );
  const datas = useMemo(() => selectedItems.map((i) => i.data), [selectedItems]);
  const nSel = datas.reduce((sum, d) => sum + d.recommendations.length, 0);
  const tSel = datas.length;
  const hasParts = incReport || incRecipes;
  const recipeCount = countApplicationRecipes(datas);
  const title = `Recomendações - ${farmName ?? ""}`;

  const html = useMemo(
    () =>
      tab === "export" && nSel > 0 && hasParts && (incReport || recipeCount > 0)
        ? buildExportHtml(datas, title, { report: incReport, recipes: incRecipes, showPrices: priced, cover })
        : null,
    [tab, nSel, hasParts, incReport, incRecipes, recipeCount, datas, title, priced, cover],
  );
  const total = html && paged ? paged.total : 0;
  const message = nSel ? buildMultiWhatsappMessage(farmName, datas, contextLabel) : "";

  const onPaged = (result: PagedResult) => {
    setPaged(result);
    const counts = pagesByPart(result);
    setPartPages((prev) => ({
      report: incReport ? counts.report : prev.report,
      recipes: incRecipes ? counts.recipes : prev.recipes,
    }));
  };

  const setIds = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const triFor = (ids: string[]) => triOf(ids.map((id) => selected.has(id)));
  const toggleIds = (ids: string[]) => setIds(ids, triFor(ids) !== "on");

  const download = () => {
    if (!html) return;
    if (!previewRef.current?.print()) printPaged(html);
  };

  // ---------------------------------------------------------- outras abas
  const applicationTab = useCycleApplicationTab({
    items: items.map((i) => i.data),
    isLoading,
    onClose: () => onOpenChange(false),
    onSeeRecipes: (keys) => {
      const ids = allRecs.filter((rec) => keys.includes(stageKey(rec.name))).map((rec) => rec.id);
      setSelected(new Set(ids));
      setTab("export");
      setMode("stage");
      setIncRecipes(true);
    },
  });
  const notebookTab = useNotebookTab({
    data: notebook,
    open,
    active: open && tab === "notebook",
    unavailableReasons: notebookUnavailable,
    isLoading,
    showPrices,
    canPrice,
    onTogglePrices: togglePrices,
    onDraggingChange: setNotebookDragging,
    title: notebook?.cycleName ?? farmName ?? "Safra",
  });

  // ---------------------------------------------------------- aba Exportar
  const stageGrid = (
    <div className="grid gap-2 sm:grid-cols-2">
      {stageGroups.map((group) => {
        const tri = triFor(group.ids);
        const plots = group.ids.length;
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => toggleIds(group.ids)}
            className={cn(
              "flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
              tri === "off" ? "border-[#e2e0d6] bg-white" : "border-[#b9cdb9] bg-[#f3f6f1]",
            )}
          >
            <span className="mt-0.5">
              <TriCheck state={tri} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{group.name}</span>
              <span className="block text-[11.5px] text-[#7a786e]">
                {plural(plots, "talhão", "talhões")} ·{" "}
                {group.pending ? plural(group.pending, "pendente", "pendentes") : "registrada"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const tree = (
    <div className="overflow-hidden rounded-xl border border-[#e2e0d6] bg-white">
      {farmGroups.map((farm) => {
        const farmIds = farm.items.flatMap((i) => i.data.recommendations.map((r) => r.id));
        return (
          <div key={farm.name}>
            <button
              type="button"
              onClick={() => toggleIds(farmIds)}
              className="flex w-full items-center gap-2.5 bg-[#f6f4ee] px-3 py-2 text-left"
            >
              <TriCheck state={triFor(farmIds)} />
              <span className="flex-1 text-[12.5px] font-semibold">{farm.name}</span>
              <span className="text-xs text-[#6b6a62]">{plural(farm.items.length, "talhão", "talhões")}</span>
            </button>
            {farm.items.map((item) => {
              const ids = item.data.recommendations.map((r) => r.id);
              const on = ids.filter((id) => selected.has(id)).length;
              const isOpen = expanded.has(item.id);
              const area = item.data.spec?.plantedAreaHa ?? item.data.spec?.areaHa;
              return (
                <div key={item.id} className="border-t border-[#efede5]">
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <button type="button" aria-label={`Marcar ${item.label}`} onClick={() => toggleIds(ids)}>
                      <TriCheck state={triFor(ids)} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="truncate text-[13px] font-semibold">{item.label}</span>
                      {area ? (
                        <span className="text-xs text-[#7a786e]">{area.toLocaleString("pt-BR")} ha</span>
                      ) : null}
                      <span className="ml-auto text-xs text-[#6b6a62] tabular-nums">
                        {on}/{ids.length}
                      </span>
                      <ChevronDown className={cn("size-4 text-[#7a786e] transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="pb-1.5">
                      {item.data.recommendations.map((rec, index) => (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => toggleIds([rec.id])}
                          className="flex w-full items-center gap-2.5 py-1.5 pr-3 pl-9 text-left"
                        >
                          <TriCheck state={selected.has(rec.id) ? "on" : "off"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px]">
                              {index + 1}. {rec.name}
                            </span>
                            <span className="block text-[11px] text-[#7a786e]">{stageWhen(rec)}</span>
                          </span>
                          <StatusBadge status={displayRecStatus(rec)} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const fullList = (
    <div className="overflow-hidden rounded-xl border border-[#e2e0d6] bg-white">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2.5 border-b border-[#f1f0ea] px-3 py-2 last:border-b-0">
          <TriCheck state="on" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {item.label}
            {item.data.spec?.farmName ? (
              <span className="font-normal text-[#7a786e]"> · {item.data.spec.farmName}</span>
            ) : null}
          </span>
          <span className="text-xs text-[#6b6a62] tabular-nums">
            {item.data.done}/{item.data.total} registradas
          </span>
        </div>
      ))}
    </div>
  );

  const plotsWithSelection = items.filter((i) => i.data.recommendations.some((r) => selected.has(r.id))).length;

  const exportLeft = isLoading ? (
    <SkeletonList rows={6} />
  ) : items.length === 0 ? (
    <p className="text-sm text-[#6b6a62]">Nenhum talhão com cronograma para exportar.</p>
  ) : (
    <div className="flex flex-col gap-6">
      <Step n={1} title="O que vai no PDF">
        <div className="flex flex-col gap-2">
          <PartCard
            title="Resumo e cronograma"
            tag="Para o produtor"
            tagTone="producer"
            desc="Capa da safra e as etapas de cada talhão."
            pages={partPages.report ? fmtPages(partPages.report) : undefined}
            on={incReport}
            onToggle={() => setIncReport((v) => !v)}
          >
            <PriceSwitch on={priced} onToggle={togglePrices} canPrice={canPrice} disabled={!incReport} />
          </PartCard>
          <PartCard
            title="Receitas de aplicação"
            tag="Para o operador"
            tagTone="operator"
            desc="Uma folha por etapa, para quem aplica. Sem preço."
            pages={partPages.recipes ? fmtPages(partPages.recipes) : undefined}
            on={incRecipes}
            onToggle={() => setIncRecipes((v) => !v)}
          />
        </div>
      </Step>

      <Step
        n={2}
        title="O que exportar"
        links={
          mode === "full"
            ? undefined
            : [
                { label: "Todas", onClick: () => setSelected(new Set(allIds)) },
                {
                  label: "Pendentes",
                  onClick: () => setSelected(new Set(allRecs.filter((r) => r.status === "PENDING").map((r) => r.id))),
                },
                { label: "Nenhuma", onClick: () => setSelected(new Set()) },
              ]
        }
      >
        <div className="flex flex-col gap-1.5">
          <Pills
            tone="soft"
            items={[
              { id: "stage", label: "Por etapa" },
              { id: "plot", label: "Por talhão" },
              { id: "full", label: "Safra completa" },
            ]}
            value={mode}
            onChange={(id) => {
              setMode(id as Mode);
              if (id === "full") setSelected(new Set(allIds));
            }}
          />
          <p className="text-xs text-[#6b6a62]">{MODE_HELP[mode]}</p>
        </div>
        {mode === "stage" ? (
          <>
            {stageGrid}
            <button
              type="button"
              onClick={() => setTreeOpen((v) => !v)}
              className="flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-[#2f6d3f]"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", treeOpen && "rotate-180")} />
              {treeOpen
                ? "Ocultar ajuste por talhão"
                : `Ajustar talhão a talhão (${plotsWithSelection} de ${items.length} talhões)`}
            </button>
            {treeOpen ? tree : null}
          </>
        ) : mode === "plot" ? (
          tree
        ) : (
          fullList
        )}
      </Step>
    </div>
  );

  const exportRight = (
    <>
      <PreviewToolbar
        title={
          <span>
            Prévia do PDF
            {total ? <span className="ml-1.5 font-normal text-[#6b6a62]">· {fmtPages(total)}</span> : null}
          </span>
        }
        zoom={zoom}
        effectiveZoom={effectiveZoom}
        onZoom={setZoom}
      />
      <PagedPreview
        ref={previewRef}
        html={html}
        zoom={zoom}
        onPaged={onPaged}
        onEffectiveZoom={setEffectiveZoom}
        empty={
          isLoading ? (
            <div className="aspect-210/297 w-[min(520px,80%)] animate-pulse rounded-sm bg-white/70" />
          ) : (
            <PreviewEmpty
              title="Nada para mostrar"
              text={
                !nSel
                  ? "Marque ao menos uma etapa para ver as folhas do PDF."
                  : !hasParts
                    ? "Marque o resumo, as receitas ou os dois."
                    : "As etapas marcadas foram puladas — não geram receita."
              }
            />
          )
        }
      />
    </>
  );

  const exportFooter = (
    <ExportFooter
      summary={
        isLoading
          ? "Carregando…"
          : nSel
            ? `${plural(nSel, "etapa", "etapas")} em ${plural(tSel, "talhão", "talhões")}`
            : "Nenhuma etapa marcada"
      }
      sub={
        nSel
          ? `${partsSummary(incReport, incRecipes, recipeCount)}${incReport && canPrice ? (priced ? " · com preços" : " · sem preços") : ""}`
          : "Os botões liberam quando houver seleção."
      }
      warn={!isLoading && (!nSel || !hasParts)}
    >
      <WhatsappButton
        message={message}
        disabled={!nSel}
        onCopy={() => void copyText(message)}
        onSend={() => openWhatsapp(message)}
      />
      <FooterButton tone="primary" disabled={!html || !nSel} onClick={download}>
        <Download className="size-4" /> Baixar PDF{total ? ` · ${fmtPages(total)}` : ""}
      </FooterButton>
    </ExportFooter>
  );

  const tabs = [
    { id: "export", label: "Exportar" },
    ...(applicationData ? [{ id: "application", label: "Dados da aplicação" }] : []),
    ...(notebook ? [{ id: "notebook", label: "Caderno de safra" }] : []),
  ];

  const slots =
    tab === "application"
      ? applicationTab
      : tab === "notebook"
        ? notebookTab
        : {
            left: exportLeft,
            right: exportRight,
            footer: exportFooter,
            mobilePreviewLabel: total ? `Prévia · ${fmtPages(total)}` : "Prévia",
          };

  return (
    <ExportShell
      open={open}
      onOpenChange={(next) => !(tab === "application" && applicationTab.saving) && onOpenChange(next)}
      // Esc reordenando pelo teclado cancela o arrasto; sem isto fechava o diálogo junto.
      onEscapeKeyDown={(event) => {
        if (notebookDragging) event.preventDefault();
      }}
      title="Exportar safra"
      contentKey={tab}
      subtitle={
        tab === "notebook"
          ? "Monte o caderno para imprimir e encadernar: escolha as seções e a ordem."
          : tab === "application"
            ? "Vazão, tanque, horário e ponta de cada etapa, para todos os talhões de uma vez — saem nas receitas."
            : [farmName, plural(items.length, "talhão", "talhões")].filter(Boolean).join(" · ")
      }
      tabs={tabs.length > 1 ? tabs : undefined}
      tab={tab}
      onTab={(id) => {
        setTab(id as Tab);
        setMView("config");
      }}
      left={slots.left}
      right={slots.right}
      footer={slots.footer}
      mobile={mobile}
      mobileView={mView}
      onMobileView={setMView}
      mobilePreviewLabel={slots.mobilePreviewLabel}
    />
  );
}
