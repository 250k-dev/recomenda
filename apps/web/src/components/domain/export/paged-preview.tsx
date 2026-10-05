"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PagedLayout } from "@recomenda/domain/print/paged";
import { cn } from "@recomenda/utils";
import {
  newPagedChannel,
  onPaged,
  pagedDocumentHtml,
  type PagedResult,
} from "@/lib/print/paged-document";

/** Largura da folha A4 na tela (210 mm a 96 dpi) + respiro lateral. */
const PAGE_PX = 794;
const SIDE_PX = 48;

export type PreviewZoom = number | "fit";
/** Zoom inicial da prévia (e o do clique no "%"). */
export const DEFAULT_PREVIEW_ZOOM = 0.8;

export interface PagedPreviewHandle {
  /** Abre o "Salvar como PDF" com as folhas já paginadas da prévia. */
  print: () => boolean;
  /** Rola a prévia até a 1ª folha da seção (`data-section` do caderno). */
  scrollToSection: (section: string) => void;
}

/**
 * Prévia fiel das folhas do PDF (Paged.js num iframe). Dois iframes se
 * revezam: o documento novo pagina no de trás e só troca quando fica pronto —
 * a prévia nunca pisca nem fica em branco enquanto o usuário marca etapas.
 */
export const PagedPreview = forwardRef<
  PagedPreviewHandle,
  {
    html: string | null;
    layout?: PagedLayout;
    zoom: PreviewZoom;
    /** Quando o documento termina de paginar (folhas e rótulos). */
    onPaged?: (result: PagedResult) => void;
    /** Mostrado quando `html` é null (nada selecionado). */
    empty?: ReactNode;
    className?: string;
    /** Avisa o zoom efetivo (para o "125%" da barra quando está em "caber"). */
    onEffectiveZoom?: (zoom: number) => void;
  }
>(function PagedPreview({ html, layout, zoom, onPaged: onDone, empty, className, onEffectiveZoom }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const pendingRef = useRef<{ slot: number; channel: string } | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Largura do painel → zoom "caber na largura".
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const effectiveZoom =
    zoom === "fit" ? Math.max(0.25, Math.min(1.5, (width - SIDE_PX) / PAGE_PX)) : zoom;
  useEffect(() => {
    if (width > 0) onEffectiveZoom?.(effectiveZoom);
  }, [effectiveZoom, onEffectiveZoom, width]);

  // Por ref: a folha que termina de paginar depois de uma troca de zoom tem
  // que receber o zoom ATUAL, não o do momento em que a paginação começou.
  const zoomRef = useRef(effectiveZoom);
  const applyZoom = useCallback((frame: HTMLIFrameElement | null) => {
    const pages = frame?.contentDocument?.querySelector<HTMLElement>(".pagedjs_pages");
    if (!pages) return;
    pages.style.zoom = String(zoomRef.current);
    // Folha mais larga que o painel: a rolagem horizontal começa no meio,
    // para a prévia abrir sempre centralizada.
    const win = frame?.contentWindow;
    const root = frame?.contentDocument?.scrollingElement;
    if (win && root) win.scrollTo((root.scrollWidth - root.clientWidth) / 2, win.scrollY);
  }, []);
  useEffect(() => {
    zoomRef.current = effectiveZoom;
    applyZoom(frames[0].current);
    applyZoom(frames[1].current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs estáveis
  }, [effectiveZoom, applyZoom]);

  // Documento novo → pagina no iframe de trás (debounce curto: marcar várias
  // caixas seguidas não dispara uma paginação por clique).
  useEffect(() => {
    if (!html) return;
    const slot = pendingRef.current ? pendingRef.current.slot : 1 - active;
    const channel = newPagedChannel("preview");
    const timer = window.setTimeout(() => {
      const frame = frames[slot].current;
      if (!frame) return;
      pendingRef.current = { slot, channel };
      frame.srcdoc = pagedDocumentHtml(html, channel, layout);
    }, 220);
    const stop = onPaged(channel, (result) => {
      if (pendingRef.current?.channel !== channel) return;
      pendingRef.current = null;
      applyZoom(frames[slot].current);
      setActive(slot);
      setReady(true);
      onDoneRef.current?.(result);
    });
    return () => {
      window.clearTimeout(timer);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` só escolhe o slot livre
  }, [html, layout]);

  useImperativeHandle(ref, () => ({
    print: () => {
      const frame = frames[active].current?.contentWindow;
      if (!frame || !ready) return false;
      // O zoom da tela não pode ir para o papel: imprime a 100% e devolve.
      const pages = frame.document.querySelector<HTMLElement>(".pagedjs_pages");
      const zoomBefore = pages?.style.zoom ?? "";
      if (pages) pages.style.zoom = "";
      frame.focus();
      frame.print();
      if (pages) pages.style.zoom = zoomBefore;
      return true;
    },
    scrollToSection: (section) => {
      const doc = frames[active].current?.contentDocument;
      const target = Array.from(doc?.querySelectorAll<HTMLElement>(".pagedjs_page") ?? []).find((page) =>
        page.querySelector(`[data-section="${CSS.escape(section)}"]`),
      );
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  }));

  return (
    <div ref={containerRef} className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      {frames.map((frameRef, slot) => (
        <iframe
          key={slot}
          ref={frameRef}
          title={slot === active ? "Prévia do PDF" : "Prévia do PDF (carregando)"}
          aria-hidden={slot !== active}
          className={cn(
            "absolute inset-0 h-full w-full border-0 bg-transparent transition-opacity",
            slot === active && ready && html ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
      ))}
      {!html ? (
        <div className="absolute inset-0 flex items-center justify-center p-6">{empty}</div>
      ) : !ready ? (
        <div className="absolute inset-0 flex justify-center p-8">
          <div className="aspect-210/297 w-full max-w-[520px] animate-pulse rounded-sm bg-white/70 shadow-sm" />
        </div>
      ) : null}
    </div>
  );
});
