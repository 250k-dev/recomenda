"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Plus, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProducers } from "@/lib/api/hooks";
import { useCan } from "@/lib/auth/use-can";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;

// Client-only platform detection for the shortcut hint, without hydration
// mismatch or setState-in-effect.
const subscribeNoop = () => () => {};
const getIsMac = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Case-, accent- and punctuation-insensitive text for matching:
// "João", "joao" and "joão!" all normalize to "joao".
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function ProducerSearch() {
  const router = useRouter();
  const { data } = useProducers();
  const canCreateProducer = useCan("PRODUCER_CREATE");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMac = useSyncExternalStore(subscribeNoop, getIsMac, () => false);

  const selectable = useMemo(
    () =>
      (data?.data ?? []).filter(
        (p) => p.row_type === "producer" && p.producer_id && p.is_active,
      ),
    [data],
  );

  // Empty query → every producer in alphabetical order. Typing → filtered + capped.
  const results = useMemo(() => {
    const sorted = [...selectable].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
    const q = normalize(query);
    if (!q) return sorted;
    return sorted
      .filter((p) => normalize(`${p.name} ${p.email}`).includes(q))
      .slice(0, MAX_MATCHES);
  }, [selectable, query]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    setActiveKey(null);
    // Drop focus so the search box isn't left focused on the destination page.
    inputRef.current?.blur();
    router.push(path);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Global ⌘K / Ctrl+K shortcut to focus the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const optionEls = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-option]") ?? [],
    );

  const focusOption = (index: number) => {
    const els = optionEls();
    if (els.length === 0) return;
    const i = ((index % els.length) + els.length) % els.length;
    els[i]?.focus();
  };

  // Keyboard from the input: arrows enter the list, Enter picks the top match.
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusOption(0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusOption(-1));
    } else if (e.key === "Enter") {
      // Quick-select the top result only when actively searching.
      const top = query.trim() !== "" ? results[0] : undefined;
      if (top?.producer_id) {
        e.preventDefault();
        go(`/producers/${top.producer_id}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // Keyboard while a result button is focused. Enter/Space activate natively;
  // Tab/Shift+Tab move through buttons natively (they are in the tab order).
  const onOptionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const els = optionEls();
    const idx = els.indexOf(e.currentTarget);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(idx + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx <= 0) inputRef.current?.focus();
      else els[idx - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  // Close when focus leaves the whole widget (e.g. Tab past the last option).
  const onContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      setActiveKey(null);
    }
  };

  const optionClass = (key: string, extra?: string) =>
    cn(
      "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm outline-none transition-colors",
      activeKey === key ? "bg-accent" : "hover:bg-accent/60",
      extra,
    );

  return (
    <div
      ref={containerRef}
      onBlur={onContainerBlur}
      className="relative w-full"
    >
      <Search className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Buscar produtor"
        aria-expanded={open}
        aria-controls="producer-search-list"
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveKey(null);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder="Buscar produtor…"
        className="pr-16 h-11 pl-9"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none items-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}

      {open && (
        <div
          ref={listRef}
          id="producer-search-list"
          role="listbox"
          aria-label="Produtores"
          className="absolute left-0 right-0 z-50 py-1 mt-1 overflow-hidden border rounded-lg shadow-md border-border bg-popover text-popover-foreground"
        >
          {results.length > 0 ? (
            <div role="none" className="overflow-y-auto max-h-72">
              {results.map((p) => {
                const key = `p-${p.producer_id}`;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    data-option
                    aria-selected={activeKey === key}
                    onFocus={() => setActiveKey(key)}
                    onMouseEnter={() => setActiveKey(key)}
                    onKeyDown={onOptionKeyDown}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(`/producers/${p.producer_id}`)}
                    className={optionClass(key)}
                  >
                    <div className="flex items-center justify-center text-xs font-semibold rounded-full size-7 shrink-0 bg-primary/10 text-primary">
                      {(p.name?.trim().charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {p.name}
                      </p>
                      <p className="text-xs truncate text-muted-foreground">
                        {p.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() !== "" ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nenhum produtor encontrado.
            </p>
          ) : null}

          {/* Footer actions — always available */}
          <div role="none" className="pt-1 border-t border-border">
            <button
              type="button"
              role="option"
              data-option
              aria-selected={activeKey === "all"}
              onFocus={() => setActiveKey("all")}
              onMouseEnter={() => setActiveKey("all")}
              onKeyDown={onOptionKeyDown}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go("/producers")}
              className={optionClass("all")}
            >
              <Users className="size-4 shrink-0 text-muted-foreground" />
              Ver todos os produtores
            </button>
            <button
              type="button"
              role="option"
              data-option
              aria-selected={activeKey === "catalog"}
              onFocus={() => setActiveKey("catalog")}
              onMouseEnter={() => setActiveKey("catalog")}
              onKeyDown={onOptionKeyDown}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go("/catalog")}
              className={optionClass("catalog")}
            >
              <Package className="size-4 shrink-0 text-muted-foreground" />
              Ver todos os produtos
            </button>
            {canCreateProducer ? (
              <button
                type="button"
                role="option"
                data-option
                aria-selected={activeKey === "new"}
                onFocus={() => setActiveKey("new")}
                onMouseEnter={() => setActiveKey("new")}
                onKeyDown={onOptionKeyDown}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go("/producers/new")}
                className={optionClass("new", "font-medium text-primary")}
              >
                <Plus className="size-4 shrink-0" />
                Cadastrar produtor
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
