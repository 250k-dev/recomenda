"use client";

import { routes } from "@recomenda/config";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Search, Users, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useProducers } from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";

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

/**
 * Busca de produtores do header (⌘K). Ocupa o espaço livre da linha: enquanto
 * sobra largura (≥14rem) mostra o input; quando o breadcrumb ou a tela
 * apertam, recolhe para o botão de ícone. Medido por container query.
 */
export function ProducerSearchButton() {
  const router = useRouter();
  const { data } = useProducers();
  const canCreateProducer = useCan("PRODUCER_CREATE");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
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

  const setDialogOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveKey(null);
    }
  };

  const go = <T extends string>(path: Route<T>) => {
    setDialogOpen(false);
    router.push(path);
  };

  // Global ⌘K / Ctrl+K shortcut to open the search modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
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
  // Escape fecha o modal via Radix.
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      requestAnimationFrame(() => focusOption(0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      requestAnimationFrame(() => focusOption(-1));
    } else if (e.key === "Enter") {
      // Quick-select the top result only when actively searching.
      const top = query.trim() !== "" ? results[0] : undefined;
      if (top?.producer_id) {
        e.preventDefault();
        go(routes.produtores.detalhe(top.producer_id));
      }
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
    }
  };

  const optionClass = (key: string, extra?: string) =>
    cn(
      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm outline-none transition-colors",
      activeKey === key ? "bg-accent" : "hover:bg-accent/60",
      extra,
    );

  return (
    <>
      {/* flex-1 absorve a sobra da linha; a container query decide o formato.
          min-w-11 garante o ícone mesmo com o breadcrumb espremendo tudo. */}
      <div className="flex h-11 min-w-11 flex-1 items-center justify-end @container">
        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          aria-label={
            isMac ? "Buscar produtor (⌘K)" : "Buscar produtor (Ctrl+K)"
          }
          onClick={() => setOpen(true)}
          className="@min-[14rem]:hidden"
        >
          <Search />
        </Button>
        <button
          type="button"
          aria-label={
            isMac ? "Buscar produtor (⌘K)" : "Buscar produtor (Ctrl+K)"
          }
          onClick={() => setOpen(true)}
          className="hidden h-11 w-full max-w-72 items-center gap-2.5 rounded-lg border border-border-strong bg-search px-3.5 text-sm shadow-xs outline-none transition-colors hover:bg-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 @min-[14rem]:flex"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left text-placeholder">
            Buscar produtor…
          </span>
          <kbd className="pointer-events-none flex select-none items-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-24 max-w-xl translate-y-0 gap-0 p-0"
        >
          <DialogTitle className="sr-only">Buscar produtor</DialogTitle>

          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Buscar produtor"
              aria-expanded
              aria-controls="producer-search-list"
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveKey(null);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar produtor…"
              className="h-13 w-full bg-transparent pl-11 pr-14 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex">
              Esc
            </kbd>
          </div>

          <div
            ref={listRef}
            id="producer-search-list"
            role="listbox"
            aria-label="Produtores"
            className="py-1"
          >
            {results.length > 0 ? (
              <div role="none" className="max-h-72 overflow-y-auto">
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
                      onClick={() =>
                        p.producer_id
                          ? go(routes.produtores.detalhe(p.producer_id))
                          : undefined
                      }
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
              <p className="px-4 py-3 text-sm text-muted-foreground">
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
                onClick={() => go(routes.produtores.lista)}
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
                onClick={() => go(routes.produtos)}
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
                  onClick={() => go(routes.produtores.novo)}
                  className={optionClass("new", "font-medium text-primary")}
                >
                  <Plus className="size-4 shrink-0" />
                  Cadastrar produtor
                </button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
