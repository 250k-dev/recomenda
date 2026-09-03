"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

/**
 * Quando o select está dentro de um modal (Dialog/Sheet), o Radix aplica
 * pointer-events:none no body e focus-trap no conteúdo do dialog. Portais
 * montados no body ficam inacessíveis. Este contexto permite injetar um
 * container alternativo para o portal (ex.: o próprio DialogContent).
 */
const SelectPortalContainerContext = createContext<HTMLElement | null>(null);
export const SelectPortalContainer = SelectPortalContainerContext.Provider;
import { Input } from "../primitives/input";
import { cn } from "@recomenda/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

const PANEL_MAX_HEIGHT = 280;
const PANEL_GAP_PX = 4;

type PanelPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function computePanelPosition(trigger: HTMLElement, minWidth?: number): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP_PX;
  const spaceAbove = rect.top - PANEL_GAP_PX;
  const openUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
  const viewportPadding = 8;
  const maxWidth = window.innerWidth - viewportPadding * 2;
  const width = Math.min(Math.max(rect.width, minWidth ?? rect.width), maxWidth);
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    window.innerWidth - width - viewportPadding,
  );

  if (openUp) {
    return {
      bottom: window.innerHeight - rect.top + PANEL_GAP_PX,
      left,
      width,
    };
  }

  return {
    top: rect.bottom + PANEL_GAP_PX,
    left,
    width,
  };
}

export type BaseSelectProps = {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  options: SearchableSelectOption[];
  placeholder?: string;
  filterLabel?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  /** Rótulo exibido quando o valor ainda não está na lista de opções. */
  selectedLabel?: string;
  emptyMessage?: string;
  className?: string;
  size?: "sm" | "default";
  panelMinWidth?: number;
  /** Rodapé fixo dentro do popover (não fecha ao clicar). Recebe a busca atual. */
  footer?: (ctx: { query: string; close: () => void }) => React.ReactNode;
  /**
   * Permite cadastrar um item novo a partir do texto digitado: quando a busca
   * não casa exatamente com nenhuma opção, exibe uma linha "Adicionar …" e
   * dispara `onCreate(texto)` ao clicar, pressionar Enter ou sair do campo.
   */
  creatable?: boolean;
  onCreate?: (label: string) => void;
};

export function BaseSelect({
  id,
  name,
  value,
  onValueChange,
  onBlur,
  options,
  placeholder = "Selecione…",
  filterLabel,
  searchPlaceholder = "Buscar…",
  searchable = true,
  disabled = false,
  loading = false,
  loadingMessage = "Carregando…",
  selectedLabel,
  emptyMessage = "Nenhum resultado encontrado.",
  className,
  size = "default",
  panelMinWidth,
  footer,
  creatable = false,
  onCreate,
}: BaseSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Evita cadastrar o mesmo texto duas vezes (ex.: Enter dispara o create e, ao
  // desmontar o input, o blur tentaria disparar de novo).
  const didCreateRef = useRef(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const portalContainer = useContext(SelectPortalContainerContext);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.keywords ?? ""}`).includes(q),
    );
  }, [options, query, searchable]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPanelPosition(computePanelPosition(trigger, panelMinWidth));
  }, [panelMinWidth]);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(updatePanelPosition);
    const onScrollOrResize = () => updatePanelPosition();
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open || !searchable) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, searchable]);

  const pick = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
    if (name) {
      onBlur?.({
        target: { name, value: nextValue },
      } as unknown as React.FocusEvent<HTMLInputElement>);
    }
  };

  const trimmedQuery = query.trim();
  const hasExactMatch = options.some(
    (option) => normalize(option.label) === normalize(trimmedQuery),
  );
  const canCreate =
    creatable &&
    searchable &&
    Boolean(onCreate) &&
    trimmedQuery.length > 0 &&
    !hasExactMatch;

  const runCreate = () => {
    const label = query.trim();
    if (!label || didCreateRef.current) return;
    didCreateRef.current = true;
    onCreate?.(label);
    setOpen(false);
    setQuery("");
  };

  const displayLabel = loading
    ? loadingMessage
    : (selected?.label ?? selectedLabel ?? placeholder);

  const showHeader = searchable || Boolean(filterLabel);

  const panel =
    open && panelPosition ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: panelPosition.top,
          bottom: panelPosition.bottom,
          left: panelPosition.left,
          width: panelPosition.width,
          zIndex: 100,
          // Garante cliques no painel mesmo dentro de modais (Radix Dialog/Sheet
          // aplica pointer-events:none no body).
          pointerEvents: "auto",
        }}
        className="flex max-h-[280px] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
      >
        {showHeader ? (
          <div className={cn("shrink-0 px-3 py-2.5", searchable && "border-b")}>
            {filterLabel ? (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {filterLabel}
              </p>
            ) : null}
            {searchable ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    didCreateRef.current = false;
                    setQuery(event.target.value);
                  }}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  className="h-9 pl-8"
                  onBlur={() => {
                    // Sair do campo com um nome novo digitado cadastra o produto —
                    // só quando não há nenhum produto correspondente (evita cadastro
                    // acidental ao desistir de uma busca que tinha resultados).
                    if (canCreate && filtered.length === 0) runCreate();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpen(false);
                      setQuery("");
                    } else if (event.key === "Enter") {
                      if (filtered[0] && !filtered[0].disabled) {
                        event.preventDefault();
                        pick(filtered[0].value);
                      } else if (canCreate) {
                        event.preventDefault();
                        runCreate();
                      }
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <ul
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
          aria-label={placeholder}
          onWheel={(event) => event.stopPropagation()}
        >
          {filtered.length > 0 ? (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!option.disabled) pick(option.value);
                    }}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60",
                      isSelected && "bg-primary/8",
                      option.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">
                      {option.label}
                    </span>
                  </button>
                </li>
              );
            })
          ) : canCreate ? null : (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{emptyMessage}</li>
          )}
          {canCreate ? (
            <li role="none">
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={runCreate}
                className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60"
              >
                <Plus className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{trimmedQuery}</span>
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary-strong">
                  Adicionar
                </span>
              </button>
            </li>
          ) : null}
        </ul>
        {footer ? (
          <div className="shrink-0 border-t p-1">
            {footer({
              query,
              close: () => {
                setOpen(false);
                setQuery("");
              },
            })}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled || loading) return;
          setOpen((current) => {
            if (current) setQuery("");
            return !current;
          });
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors outline-none",
          size === "sm" ? "h-9" : "h-10",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          !selected && !selectedLabel && !loading && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {typeof document !== "undefined" && panel
        ? createPortal(panel, portalContainer ?? document.body)
        : null}
    </div>
  );
}

type SearchableSelectProps = Omit<BaseSelectProps, "searchable">;

export function SearchableSelect(props: SearchableSelectProps) {
  return <BaseSelect searchable {...props} />;
}
