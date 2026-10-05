"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FileDown } from "lucide-react";
import {
  NOTEBOOK_PAGED_LAYOUT,
  NOTEBOOK_SECTIONS,
  buildSeasonNotebookHtml,
  notebookSectionAvailable,
  resolveNotesPages,
  resolvedNotebookSections,
  type NotebookSectionId,
  type NotebookSectionState,
  type SeasonNotebookData,
} from "@recomenda/domain/season-notebook/notebook-document";
import {
  readNotebookPreference,
  writeNotebookPreference,
  type NotebookPreference,
} from "@/components/domain/export/notebook-preference";
import {
  PinnedNotebookRow,
  SortableNotebookRow,
  type NotebookRowProps,
} from "@/components/domain/export/notebook-section-row";
import {
  PagedPreview,
  DEFAULT_PREVIEW_ZOOM,
  type PagedPreviewHandle,
  type PreviewZoom,
} from "@/components/domain/export/paged-preview";
import {
  ExportFooter,
  FooterButton,
  Pills,
  PreviewEmpty,
  PreviewToolbar,
  PriceSwitch,
  SkeletonList,
  Step,
  TriCheck,
  fmtPages,
} from "@/components/domain/export/export-ui";
import { printPaged, type PagedResult } from "@/lib/print/paged-document";

/** Por que a seção está indisponível — o toggle desligado precisa se explicar. */
const UNAVAILABLE_REASON: Partial<Record<NotebookSectionId, string>> = {
  "purchase-list": "Esta safra ainda não tem lista de compra com produtos.",
  stock: "O produtor não tem nada em estoque.",
  plots: "Nenhum talhão programado nesta safra.",
  "recommendation-model": "Nenhum modelo de recomendação aplicado nesta safra.",
  schedule: "Nenhum talhão com cronograma.",
  "field-sheet": "Nenhum talhão programado nesta safra.",
};

const NOTES_OPTIONS = [1, 2, 4, 6];

/**
 * Aba "Caderno de safra" do Exportar safra: liga/desliga e reordena as seções
 * (dnd-kit: ponteiro + teclado, funciona no toque) com a prévia paginada de
 * verdade ao lado — o número da folha de cada seção vem dela.
 *
 * Hook (e não componente) porque a aba entrega as três partes da moldura do
 * diálogo (esquerda, prévia e rodapé): o diálogo continua um só ao trocar de aba.
 */
export function useNotebookTab({
  data,
  open,
  active,
  unavailableReasons,
  isLoading = false,
  showPrices,
  canPrice,
  onTogglePrices,
  onDraggingChange,
  title,
}: {
  data: SeasonNotebookData | null | undefined;
  /** Diálogo aberto (zera as seções a cada abertura). */
  open: boolean;
  /** Aba do caderno visível (só então pagina). */
  active: boolean;
  /** Motivos mais específicos que os padrões (ex.: safra de arquivo). */
  unavailableReasons?: Partial<Record<NotebookSectionId, string>>;
  isLoading?: boolean;
  showPrices: boolean;
  canPrice: boolean;
  onTogglePrices: () => void;
  /**
   * Há um arrasto em curso. O Esc que cancela o arrasto é o mesmo que fecha o
   * Dialog do Radix — quem contém a aba precisa segurar o fechamento.
   */
  onDraggingChange?: (dragging: boolean) => void;
  title: string;
}) {
  const previewRef = useRef<PagedPreviewHandle>(null);
  const [pref, setPref] = useState<NotebookPreference>(() => readNotebookPreference());
  const [zoom, setZoom] = useState<PreviewZoom>(DEFAULT_PREVIEW_ZOOM);
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [paged, setPaged] = useState<PagedResult | null>(null);

  // A cada abertura do diálogo, as seções começam desligadas (a ordem
  // escolhida continua lembrada): o usuário liga o que quer no caderno.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPref((prev) => ({ ...prev, sections: prev.sections.map((s) => ({ ...s, enabled: false })) }));
    }
  }

  const update = (next: NotebookPreference) => {
    setPref(next);
    writeNotebookPreference(next);
  };

  const toggle = (id: NotebookSectionId) =>
    update({
      ...pref,
      sections: pref.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });

  // A capa fica fora do SortableContext: é sempre a 1ª folha.
  const [pinned, ...sortable] = pref.sections;
  const sortableIds = sortable.map((s) => s.id);

  const sensors = useSensors(
    // 6px de folga: no celular, marcar o checkbox não vira arrasto.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    onDraggingChange?.(false);
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const from = sortableIds.indexOf(dragged.id as NotebookSectionId);
    const to = sortableIds.indexOf(over.id as NotebookSectionId);
    if (from < 0 || to < 0) return;
    update({ ...pref, sections: [pinned, ...arrayMove(sortable, from, to)] });
  };

  const included = useMemo(
    () => (data ? resolvedNotebookSections(data, pref.sections) : []),
    [data, pref.sections],
  );
  const priced = canPrice && showPrices;
  const notesPages = resolveNotesPages(pref.notesPages);

  // Só pagina com a aba aberta: o caderno é o documento mais pesado do app.
  const html = useMemo(
    () =>
      active && data && included.length
        ? buildSeasonNotebookHtml(data, {
            sections: pref.sections,
            showPrices: priced,
            detailedSchedule: pref.detailedSchedule,
            notesPages,
          })
        : null,
    [active, data, included.length, pref.sections, pref.detailedSchedule, priced, notesPages],
  );
  const total = html && paged ? paged.total : 0;

  const scrollToSection = useCallback(
    (id: NotebookSectionId) => previewRef.current?.scrollToSection(id),
    [],
  );

  const rowProps = (section: NotebookSectionState): NotebookRowProps => {
    const available = data ? notebookSectionAvailable(section.id, data) : false;
    return {
      id: section.id,
      enabled: section.enabled,
      available,
      reason:
        unavailableReasons?.[section.id] ??
        UNAVAILABLE_REASON[section.id] ??
        NOTEBOOK_SECTIONS[section.id].description,
      onToggle: () => toggle(section.id),
      onSelect: () => scrollToSection(section.id),
      control:
        section.id === "notes" && section.enabled && available ? (
          <Pills
            tone="soft"
            items={NOTES_OPTIONS.map((n) => ({ id: String(n), label: `${n}` }))}
            value={String(notesPages)}
            onChange={(id) => update({ ...pref, notesPages: Number(id) })}
          />
        ) : undefined,
    };
  };

  const download = () => {
    if (!html) return;
    if (!previewRef.current?.print()) printPaged(html, NOTEBOOK_PAGED_LAYOUT);
  };

  const hasSchedule = included.includes("schedule");
  const scheduleCount = data?.schedule.length ?? 0;

  const left =
    isLoading || !data ? (
      <SkeletonList rows={7} />
    ) : (
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-xl border border-[#cfdccf] bg-white">
          <PriceSwitch on={priced} onToggle={onTogglePrices} canPrice={canPrice} />
        </div>
        <Step n={1} title="Seções do caderno">
          <p className="-mt-1 text-xs text-[#6b6a62]">Arraste para mudar a ordem. A capa é sempre a 1ª folha.</p>
          {/* Duas listas: com a capa fora da arrastável, `restrictToParentElement`
              confina o arrasto ao trecho reordenável. */}
          <div className="flex flex-col gap-2 select-none">
            <ul>
              <PinnedNotebookRow {...rowProps(pinned)} />
            </ul>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragStart={() => onDraggingChange?.(true)}
              onDragEnd={onDragEnd}
              onDragCancel={() => onDraggingChange?.(false)}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {sortable.map((section) => (
                    <SortableNotebookRow key={section.id} {...rowProps(section)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        </Step>
        {hasSchedule ? (
          <button
            type="button"
            onClick={() => update({ ...pref, detailedSchedule: !pref.detailedSchedule })}
            className="flex items-start gap-2.5 rounded-xl border border-[#e2e0d6] bg-white px-3 py-2.5 text-left"
          >
            <span className="mt-0.5">
              <TriCheck state={pref.detailedSchedule ? "on" : "off"} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">Incluir detalhamento por etapa</span>
              <span className="block text-xs text-[#6b6a62]">
                Uma folha por talhão com doses, quantidades e registro MAPA. +{fmtPages(scheduleCount)}.
              </span>
            </span>
          </button>
        ) : null}
      </div>
    );

  const right = (
    <>
      <PreviewToolbar
        title={
          <span>
            Prévia do caderno
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
        layout={NOTEBOOK_PAGED_LAYOUT}
        zoom={zoom}
        onPaged={setPaged}
        onEffectiveZoom={setEffectiveZoom}
        empty={
          isLoading ? (
            <div className="aspect-210/297 w-[min(520px,80%)] animate-pulse rounded-sm bg-white/70" />
          ) : (
            <PreviewEmpty title="Caderno vazio" text="Ligue ao menos uma seção." />
          )
        }
      />
    </>
  );

  const footer = (
    <ExportFooter
      summary={
        isLoading
          ? "Carregando…"
          : included.length
            ? `${total ? fmtPages(total) : "…"} · ${title}`
            : "Nenhuma seção ligada"
      }
      sub={`${priced ? "Com preços" : "Sem preços"}${pref.detailedSchedule && hasSchedule ? " · com detalhamento" : ""}`}
      warn={!isLoading && included.length === 0}
    >
      <FooterButton tone="primary" disabled={isLoading || !html} onClick={download}>
        <FileDown className="size-4" /> Gerar caderno (PDF){total ? ` · ${fmtPages(total)}` : ""}
      </FooterButton>
    </ExportFooter>
  );

  return {
    left,
    right,
    footer,
    mobilePreviewLabel: total ? `Prévia · ${fmtPages(total)}` : "Prévia",
  };
}
