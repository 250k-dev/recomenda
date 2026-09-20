"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@recomenda/utils";
import {
  NOTEBOOK_SECTIONS,
  type NotebookSectionId,
} from "@recomenda/domain/season-notebook/notebook-document";

export interface NotebookRowProps {
  id: NotebookSectionId;
  enabled: boolean;
  available: boolean;
  reason: string;
  onToggle: () => void;
  /** Controle próprio da seção, na mesma linha (ex.: nº de folhas pautadas). */
  control?: React.ReactNode;
}

/** Miolo da linha — igual na lista, na capa fixa e no overlay de arrasto. */
function RowBody({
  id,
  enabled,
  available,
  reason,
  onToggle,
  control,
  handle,
  inverted = false,
}: NotebookRowProps & { handle: React.ReactNode; inverted?: boolean }) {
  const meta = NOTEBOOK_SECTIONS[id];
  return (
    <>
      <label
        className={cn(
          // grow+basis (e não flex-1): abaixo de 10rem o rótulo para de
          // encolher e o controle quebra para a linha de baixo, em vez de
          // espremer o texto em seis linhas numa tela de 390px.
          "flex min-w-0 grow basis-40 items-start gap-2.5 py-0.5",
          available ? "cursor-pointer" : "cursor-not-allowed",
        )}
      >
        <input
          type="checkbox"
          // No verde, `accent-primary` desenharia verde sobre verde.
          className={cn("mt-0.5 size-4", inverted ? "accent-white" : "accent-primary")}
          checked={enabled && available}
          disabled={!available}
          onChange={onToggle}
        />
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm font-semibold",
              inverted ? "text-primary-foreground" : "text-text-strong",
            )}
          >
            {meta.label}
            {meta.pinned ? (
              <span
                className={cn(
                  "ml-2 text-xs font-normal",
                  inverted ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                sempre a 1ª folha
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "mt-0.5 block text-[13px]",
              inverted ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {available ? meta.description : reason}
          </span>
        </span>
      </label>
      {control ? (
        // No estreito vira uma linha própria, depois do punho; a partir de
        // `sm` volta para o lugar dele, antes do punho.
        <div className="order-last w-full sm:order-none sm:w-auto">{control}</div>
      ) : null}
      {handle}
    </>
  );
}

/**
 * `bg-card` é OPACO de propósito. Com o tinte translúcido de antes
 * (`bg-primary/5`), a linha levantada deixava o texto da linha de baixo
 * atravessar durante o arrasto. O estado "entra no caderno" fica por conta da
 * borda verde e do checkbox.
 */
const rowClass = (enabled: boolean, available: boolean, inverted = false) =>
  cn(
    "flex flex-wrap items-center gap-2 rounded-xl border px-2 py-2.5",
    inverted
      ? // Mesmo verde da miniatura da capa na prévia: a folha de rosto se
        // reconhece nos dois lugares.
        "border-primary bg-primary"
      : "bg-card",
    !inverted && (enabled && available ? "border-primary/40" : "border-border"),
    !available && "opacity-70",
  );

/** Punho: o alvo de arrasto. 40px, como os demais controles de toque do app. */
function Handle({
  disabled = false,
  inverted = false,
  ...props
}: React.ComponentProps<"button"> & {
  disabled?: boolean;
  inverted?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      // touch-none é exigência do dnd-kit no ativador: sem isso o navegador
      // assume o gesto como rolagem e o arrasto nunca começa no celular.
      // select-none: o dnd-kit só bloqueia a seleção DEPOIS de o arrasto
      // ativar; nos 6px até lá o navegador já começava a pintar o texto do
      // diálogo de azul/verde.
      className={cn(
        "flex size-10 shrink-0 touch-none items-center justify-center rounded-lg select-none",
        disabled
          ? inverted
            ? "text-primary-foreground/35"
            : "text-muted-foreground/30"
          : "cursor-grab text-muted-foreground hover:bg-hover hover:text-text-strong focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none active:cursor-grabbing",
      )}
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

/** Linha arrastável. */
export function SortableNotebookRow(props: NotebookRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        rowClass(props.enabled, props.available),
        // Levanta no próprio lugar. Um DragOverlay (position: fixed) seria mais
        // vistoso, mas o DialogContent tem `transform`, o que o torna bloco de
        // contenção: o overlay descolava ~50px do cursor. O transform daqui é
        // delta puro, imune a isso.
        isDragging && "relative z-10 cursor-grabbing shadow-xl ring-2 ring-primary/40",
      )}
    >
      <RowBody
        {...props}
        handle={
          <Handle
            ref={setActivatorNodeRef}
            aria-label={`Reordenar ${NOTEBOOK_SECTIONS[props.id].label}`}
            {...attributes}
            {...listeners}
          />
        }
      />
    </li>
  );
}

/** Linha fixa (a capa): mesma caixa, punho apagado e inerte. */
export function PinnedNotebookRow(props: NotebookRowProps) {
  // Desligada, a capa não sai no PDF — então também não fica verde.
  const inverted = props.enabled && props.available;
  return (
    <li className={rowClass(props.enabled, props.available, inverted)}>
      <RowBody
        {...props}
        inverted={inverted}
        handle={<Handle disabled inverted={inverted} aria-hidden tabIndex={-1} />}
      />
    </li>
  );
}
