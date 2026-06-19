"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  minWidth: number;
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

function computePanelPosition(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP_PX;
  const spaceAbove = rect.top - PANEL_GAP_PX;
  const openUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;

  if (openUp) {
    return {
      bottom: window.innerHeight - rect.top + PANEL_GAP_PX,
      left: rect.left,
      minWidth: rect.width,
    };
  }

  return {
    top: rect.bottom + PANEL_GAP_PX,
    left: rect.left,
    minWidth: rect.width,
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
}: BaseSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    setPanelPosition(computePanelPosition(trigger));
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    updatePanelPosition();

    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
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
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

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
          minWidth: panelPosition.minWidth,
          zIndex: 100,
          // Garante cliques no painel mesmo dentro de modais (Radix Dialog/Sheet
          // aplica pointer-events:none no body).
          pointerEvents: "auto",
        }}
        className="w-max overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
      >
        {showHeader ? (
          <div className={cn("px-3 py-2.5", searchable && "border-b")}>
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
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  className="h-9 pl-8"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpen(false);
                      setQuery("");
                    } else if (
                      event.key === "Enter" &&
                      filtered[0] &&
                      !filtered[0].disabled
                    ) {
                      event.preventDefault();
                      pick(filtered[0].value);
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <ul
          role="listbox"
          className="max-h-56 overflow-y-auto py-1"
          aria-label={placeholder}
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
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60",
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
                    <span className="whitespace-nowrap">{option.label}</span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{emptyMessage}</li>
          )}
        </ul>
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
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}

type SearchableSelectProps = Omit<BaseSelectProps, "searchable">;

export function SearchableSelect(props: SearchableSelectProps) {
  return <BaseSelect searchable {...props} />;
}
