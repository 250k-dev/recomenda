"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@recomenda/utils";
import type { NotebookSectionId } from "@recomenda/domain/season-notebook/notebook-document";

/**
 * Miniatura esquemática de uma folha do caderno — só título e formas, para o
 * agrônomo ver a ordem das seções antes de gerar o PDF. Não é um render do
 * documento: se virar um, passa a ter duas fontes de verdade para o layout.
 */

/** Linha de tabela: um rótulo à esquerda e um valor curto à direita. */
function Rows({ count, withValue = true }: { count: number; withValue?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px]">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="h-[3px] rounded-full bg-foreground/15"
            style={{ width: `${52 + ((i * 13) % 34)}%` }}
          />
          {withValue ? (
            <div className="ml-auto h-[3px] w-[16%] rounded-full bg-foreground/10" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Filete verde + barra de título, o topo de toda folha de miolo. */
function SheetHead() {
  return (
    <>
      <div className="flex items-center gap-1">
        <div className="size-[7px] rounded-full bg-primary" />
        <div className="h-[4px] w-[38%] rounded-full bg-primary/70" />
      </div>
      <div className="mt-[3px] h-px w-full bg-primary" />
      <div className="mt-[6px] h-[6px] w-[62%] rounded-full bg-foreground/35" />
    </>
  );
}

function SheetContent({ id }: { id: NotebookSectionId }) {
  if (id === "cover") {
    return (
      <div className="flex h-full flex-col justify-between bg-primary p-[7px]">
        <div className="flex items-center gap-1">
          <div className="size-[7px] rounded-full bg-white/90" />
          <div className="h-[4px] w-[42%] rounded-full bg-white/90" />
        </div>
        <div>
          <div className="h-[3px] w-[34%] rounded-full bg-white/55" />
          <div className="mt-[4px] h-[9px] w-[76%] rounded-sm bg-white" />
          <div className="mt-[5px] h-[3px] w-[18%] rounded-full bg-white/50" />
          <div className="mt-[6px] h-[4px] w-[52%] rounded-full bg-white/80" />
        </div>
        <div className="h-[3px] w-[44%] rounded-full bg-white/45" />
      </div>
    );
  }

  return (
    <div className="p-[7px]">
      <SheetHead />
      <div className="mt-[7px]">
        {id === "summary" ? (
          <>
            <div className="mb-[6px] flex gap-[4px]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex-1">
                  <div className="h-[2px] w-full rounded-full bg-foreground/10" />
                  <div className="mt-[2px] h-[5px] w-[70%] rounded-sm bg-foreground/30" />
                </div>
              ))}
            </div>
            <Rows count={5} withValue={false} />
          </>
        ) : id === "notes" ? (
          <div className="flex flex-col gap-[5px]">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-px w-full bg-foreground/15" />
            ))}
          </div>
        ) : id === "recommendation-model" || id === "schedule" ? (
          <div className="flex flex-col gap-[7px]">
            <div>
              <div className="mb-[3px] h-[4px] w-[30%] rounded-full bg-foreground/30" />
              <Rows count={3} />
            </div>
            <div>
              <div className="mb-[3px] h-[4px] w-[30%] rounded-full bg-foreground/30" />
              <Rows count={3} />
            </div>
          </div>
        ) : (
          <>
            {id === "purchase-list" || id === "stock" ? (
              <div className="mb-[6px] flex gap-[4px]">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[11px] flex-1 rounded-[2px] border border-border bg-surface-2"
                  />
                ))}
              </div>
            ) : null}
            <Rows count={id === "plots" ? 5 : 7} />
          </>
        )}
      </div>
    </div>
  );
}

export function NotebookPagePreview({
  id,
  index,
  sheets,
  label,
  dimmed = false,
}: {
  id: NotebookSectionId;
  /** Posição no caderno, começando em 1. */
  index: number;
  /** Quantas folhas esta seção gera — >1 desenha uma pilha. */
  sheets: number;
  label: string;
  dimmed?: boolean;
}) {
  const stacked = sheets > 1;
  return (
    <li
      data-id={id}
      className={cn("flex flex-col items-center", dimmed && "opacity-50")}
    >
      <div className="relative">
        {stacked ? (
          <>
            <div className="absolute top-[4px] left-[4px] size-full rounded-[3px] border border-border bg-card" />
            <div className="absolute top-[2px] left-[2px] size-full rounded-[3px] border border-border bg-card" />
          </>
        ) : null}
        {/* Proporção da A4 (1:1,414) para a miniatura não mentir sobre a folha. */}
        <div className="relative aspect-[1/1.414] w-[74px] overflow-hidden rounded-[3px] border border-border bg-card shadow-sm">
          <SheetContent id={id} />
        </div>
        <span className="absolute -top-1.5 -left-1.5 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
          {index}
        </span>
        {stacked ? (
          <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-foreground px-1.5 py-px text-[10px] font-bold text-background tabular-nums">
            ×{sheets}
          </span>
        ) : null}
      </div>
      <span className="mt-2 max-w-[84px] text-center text-[11px] leading-tight font-medium text-muted-foreground">
        {label}
      </span>
    </li>
  );
}

/**
 * Anima os cards até a nova posição em vez de deixá-los piscar já reordenados.
 *
 * FLIP: guarda onde cada card estava, deixa o React reordenar, e então anima do
 * ponto antigo para o novo. É o que funciona numa lista que quebra linha — com
 * `transition` em CSS os cards não animam, porque quem muda é a posição no
 * fluxo, não uma propriedade animável.
 */
function useFlip(key: string) {
  const ref = useRef<HTMLUListElement | null>(null);
  const previous = useRef(new Map<string, DOMRect>());
  const running = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;

    const next = new Map<string, DOMRect>();
    for (const child of list.children) {
      const el = child as HTMLElement;
      const id = el.dataset.id;
      if (!id) continue;

      const rect = el.getBoundingClientRect();
      next.set(id, rect);

      const before = previous.current.get(id);
      if (!before || typeof el.animate !== "function") continue;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      // Arrastando, `over` muda várias vezes por segundo: sem cancelar a
      // anterior as animações se empilham e o card treme.
      running.current.get(id)?.cancel();
      running.current.set(
        id,
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        ),
      );
    }
    previous.current = next;
  }, [key]);

  return ref;
}

export interface NotebookPreviewItem {
  id: NotebookSectionId;
  sheets: number;
  label: string;
}

export function NotebookPreviewList({ items }: { items: NotebookPreviewItem[] }) {
  const ref = useFlip(items.map((i) => `${i.id}:${i.sheets}`).join("|"));
  return (
    <ul ref={ref} className="flex flex-wrap justify-center gap-x-4 gap-y-4">
      {items.map((item, index) => (
        <NotebookPagePreview
          key={item.id}
          id={item.id}
          index={index + 1}
          sheets={item.sheets}
          label={item.label}
        />
      ))}
    </ul>
  );
}
