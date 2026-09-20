"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
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
import { Button } from "@recomenda/ui/primitives/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import {
  MAX_NOTES_PAGES,
  NOTEBOOK_SECTIONS,
  resolveNotesPages,
  notebookSectionAvailable,
  printSeasonNotebook,
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
import { NotebookPreviewList } from "@/components/domain/export/notebook-page-preview";
import {
  PinnedNotebookRow,
  SortableNotebookRow,
  type NotebookRowProps,
} from "@/components/domain/export/notebook-section-row";

/** Por que a seção está indisponível — o toggle desligado precisa se explicar. */
const UNAVAILABLE_REASON: Partial<Record<NotebookSectionId, string>> = {
  "purchase-list": "Esta safra ainda não tem lista de compra com produtos.",
  stock: "O produtor não tem nada em estoque.",
  plots: "Nenhum talhão programado nesta safra.",
  schedule: "Nenhum talhão com cronograma.",
};

/**
 * Montagem do Caderno de Safra: liga/desliga, reordena arrastando e gera o PDF.
 *
 * A reordenação usa dnd-kit (sensores de ponteiro + teclado) em vez do
 * drag-and-drop nativo do HTML5, que não dispara em touchscreen — e o agrônomo
 * costuma estar no celular. O sensor de teclado dá Espaço/setas/Esc de graça,
 * com anúncio para leitor de tela, sem código nosso.
 */
export function SeasonNotebookPanel({
  data,
  unavailableReasons,
  isLoading = false,
  showPrices,
  canChoosePrices,
  onBeforePrint,
  onDraggingChange,
}: {
  data: SeasonNotebookData;
  /** Motivos mais específicos que os padrões (ex.: safra de arquivo). */
  unavailableReasons?: Partial<Record<NotebookSectionId, string>>;
  isLoading?: boolean;
  /** Vem do mesmo checkbox "incluir preços" do diálogo de exportação. */
  showPrices: boolean;
  canChoosePrices: boolean;
  /** Fecha o diálogo antes de abrir a janela de impressão. */
  onBeforePrint?: () => void;
  /**
   * Há um arrasto em curso. Quem contém o painel precisa saber: o Esc que
   * cancela o arrasto é o mesmo que fecha um Dialog do Radix, e sem isso
   * cancelar a reordenação derrubava o diálogo inteiro.
   */
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const [pref, setPref] = useState<NotebookPreference>(() =>
    readNotebookPreference(),
  );
  // Ordem provisória enquanto o dedo/cursor está no ar, para a prévia andar
  // junto. A lista em si não usa: o dnd-kit já desloca os itens dela sozinho.
  const [dragOrder, setDragOrder] = useState<NotebookSectionState[] | null>(null);

  const update = (next: NotebookPreference) => {
    setPref(next);
    writeNotebookPreference(next);
  };

  const toggle = (id: NotebookSectionId) =>
    update({
      ...pref,
      sections: pref.sections.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    });

  // ---- reordenação -----------------------------------------------------
  // A capa fica fora do SortableContext: ela é sempre a 1ª folha, então nem
  // arrasta nem serve de alvo. `sortable` cuida só do resto da lista.
  const [pinned, ...sortable] = pref.sections;
  const sortableIds = sortable.map((s) => s.id);

  const sensors = useSensors(
    // 6px de folga antes de virar arrasto: sem isso, marcar o checkbox no
    // celular (onde o dedo sempre desliza um pouco) arrastaria a seção.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Ordem que resultaria de soltar agora sobre `over`. */
  const orderFor = (activeId: unknown, overId: unknown) => {
    const from = sortableIds.indexOf(activeId as NotebookSectionId);
    const to = sortableIds.indexOf(overId as NotebookSectionId);
    if (from < 0 || to < 0) return null;
    return [pinned, ...arrayMove(sortable, from, to)];
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    setDragOrder(over ? orderFor(active.id, over.id) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    onDraggingChange?.(false);
    setDragOrder(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = orderFor(active.id, over.id);
    if (next) update({ ...pref, sections: next });
  };

  const cancelDrag = () => {
    onDraggingChange?.(false);
    setDragOrder(null);
  };

  /** Quantas folhas pautadas — direto na linha, não numa caixa à parte. */
  const notesControl = (
    <NativeSelect
      size="sm"
      aria-label="Folhas de anotação"
      className="shrink-0"
      value={resolveNotesPages(pref.notesPages)}
      onChange={(e) =>
        update({ ...pref, notesPages: resolveNotesPages(Number(e.target.value)) })
      }
    >
      {Array.from({ length: MAX_NOTES_PAGES }, (_, i) => i + 1).map((n) => (
        <NativeSelectOption key={n} value={n}>
          {n === 1 ? "1 folha" : `${n} folhas`}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  const rowProps = (section: NotebookSectionState): NotebookRowProps => {
    const available = notebookSectionAvailable(section.id, data);
    return {
      id: section.id,
      enabled: section.enabled,
      available,
      reason:
        unavailableReasons?.[section.id] ??
        UNAVAILABLE_REASON[section.id] ??
        NOTEBOOK_SECTIONS[section.id].description,
      onToggle: () => toggle(section.id),
      control:
        section.id === "notes" && section.enabled && available
          ? notesControl
          : undefined,
    };
  };

  // ---- o que entra no PDF ---------------------------------------------
  const included = useMemo(
    () =>
      resolvedNotebookSections(data, dragOrder ?? pref.sections),
    [data, dragOrder, pref.sections],
  );
  const hasSchedule = included.includes("schedule");

  /** Folhas que cada seção gera — o que a prévia empilha. */
  const sheetsOf = (id: NotebookSectionId): number => {
    if (id === "notes") return resolveNotesPages(pref.notesPages);
    if (id === "schedule" && pref.detailedSchedule) {
      return 1 + data.schedule.length;
    }
    return 1;
  };
  const totalSheets = included.reduce((sum, id) => sum + sheetsOf(id), 0);

  const handlePrint = () => {
    onBeforePrint?.();
    window.setTimeout(
      () =>
        printSeasonNotebook(data, {
          sections: pref.sections,
          showPrices: canChoosePrices && showPrices,
          detailedSchedule: pref.detailedSchedule,
          notesPages: pref.notesPages,
        }),
      250,
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_224px]">
        <section className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-strong">
              Seções do caderno
            </h3>
            <span className="text-xs text-muted-foreground">
              arraste para reordenar
            </span>
          </div>

          {/* Duas listas de propósito. A capa fora da lista arrastável faz
              `restrictToParentElement` confinar o arrasto só ao trecho
              reordenável — numa lista só, o item subia por cima da capa, que
              não se desloca por não estar no SortableContext. */}
          <div className="flex flex-col gap-2 select-none">
            <ul>
              <PinnedNotebookRow {...rowProps(pinned)} />
            </ul>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragStart={() => onDraggingChange?.(true)}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={cancelDrag}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {sortable.map((section) => (
                    <SortableNotebookRow key={section.id} {...rowProps(section)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>

          {hasSchedule ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={pref.detailedSchedule}
                onChange={(e) =>
                  update({ ...pref, detailedSchedule: e.target.checked })
                }
              />
              <span className="text-sm">
                <span className="font-semibold text-text-strong">
                  Incluir detalhamento por etapa
                </span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                  Uma folha por talhão com doses, quantidades e registro MAPA.
                  Engorda o caderno em {data.schedule.length}{" "}
                  {data.schedule.length === 1 ? "folha" : "folhas"}.
                </span>
              </span>
            </label>
          ) : null}

        </section>

        {/* Fora do celular: numa tela de 390px os cards ficam pequenos demais
            para dizer algo e roubam o espaço da lista, que é o que se opera. */}
        <aside className="hidden rounded-xl border border-border bg-surface-2 p-4 md:block">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-text-strong">Prévia</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalSheets} {totalSheets === 1 ? "folha" : "folhas"} na ordem
              acima
            </p>
          </div>
          {included.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nenhuma seção ligada.
            </p>
          ) : (
            <NotebookPreviewList
              items={included.map((id) => ({
                id,
                sheets: sheetsOf(id),
                label: NOTEBOOK_SECTIONS[id].label,
              }))}
            />
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="gap-2"
          size="lg"
          onClick={handlePrint}
          disabled={isLoading || included.length === 0}
        >
          <FileDown className="size-4" />
          Gerar caderno (PDF)
        </Button>
        {isLoading ? (
          <span className="text-[13px] text-muted-foreground">
            Carregando dados da safra...
          </span>
        ) : included.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            Ligue ao menos uma seção.
          </span>
        ) : null}
      </div>
    </div>
  );
}
