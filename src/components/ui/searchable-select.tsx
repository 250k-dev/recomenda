"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

type SearchableSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  className?: string;
};

export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  disabled = false,
  loading = false,
  loadingMessage = "Carregando…",
  emptyMessage = "Nenhum resultado encontrado.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.keywords ?? ""}`).includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const pick = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  const displayLabel = loading
    ? loadingMessage
    : selected?.label ?? placeholder;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        id={id}
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
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          !selected && !loading && "text-muted-foreground",
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

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
          <div className="border-b border-border p-2">
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="h-9"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (event.key === "Enter" && filtered[0]) {
                  event.preventDefault();
                  pick(filtered[0].value);
                }
              }}
            />
          </div>
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
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(option.value)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                        isSelected && "bg-accent",
                      )}
                    >
                      <Check
                        className={cn(
                          "size-4 shrink-0 text-primary",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
