"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, Trash2 } from "lucide-react";
import { cn } from "@recomenda/utils";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@recomenda/ui/primitives/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@recomenda/ui/primitives/toggle-group";

export type SortDir = "asc" | "desc";

/** Filtro de uma coluna. O `kind` decide o controle que aparece no popover. */
export type ColumnFilter =
  | { kind: "text"; query: string }
  | { kind: "options"; values: string[] }
  | { kind: "range"; min: string; max: string };

export type ColumnKind = ColumnFilter["kind"];

/** Ordenação e filtros de uma tabela. Só uma coluna ordena por vez. */
export type TableView<C extends string> = {
  sort: { column: C; dir: SortDir } | null;
  filters: Partial<Record<C, ColumnFilter>>;
};

/**
 * De onde sai o valor de cada linha, numa coluna. Texto e opções comparam o
 * rótulo que a célula mostra; faixa compara o número (`null` = célula "—").
 */
export type ColumnAccessor<T> =
  | { kind: "text" | "options"; get: (row: T) => string }
  | { kind: "range"; get: (row: T) => number | null };

export type ColumnOption = { value: string; count: number };

const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Vazios vão sempre para o fim, nos dois sentidos — "—" no topo não diz nada. */
function compareValues(
  a: string | number | null,
  b: string | number | null,
  dir: SortDir,
): number {
  const emptyA = a === null || a === "";
  const emptyB = b === null || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const base =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : collator.compare(String(a), String(b));
  return dir === "asc" ? base : -base;
}

export function isFilterActive(
  filter: ColumnFilter | undefined,
): filter is ColumnFilter {
  if (!filter) return false;
  switch (filter.kind) {
    case "text":
      return normalize(filter.query) !== "";
    case "options":
      return filter.values.length > 0;
    case "range":
      return filter.min !== "" || filter.max !== "";
  }
}

export function hasActiveFilters<C extends string>(
  view: TableView<C>,
): boolean {
  return Object.values<ColumnFilter | undefined>(view.filters).some(
    isFilterActive,
  );
}

export function isTableViewActive<C extends string>(
  view: TableView<C>,
): boolean {
  return view.sort !== null || hasActiveFilters(view);
}

/** Troca o filtro de uma coluna; filtro vazio sai da tabela de filtros. */
export function withColumnFilter<C extends string>(
  view: TableView<C>,
  column: C,
  filter: ColumnFilter | undefined,
): TableView<C> {
  const filters = { ...view.filters };
  // Texto só com espaços fica guardado (o campo não pode comer o que se
  // digita), mas não filtra — `isFilterActive` o ignora.
  const keep =
    filter &&
    (filter.kind === "text" ? filter.query !== "" : isFilterActive(filter));
  if (keep) filters[column] = filter;
  else delete filters[column];
  return { ...view, filters };
}

function matches(
  value: string | number | null,
  filter: ColumnFilter,
): boolean {
  switch (filter.kind) {
    case "text":
      return normalize(String(value ?? "")).includes(normalize(filter.query));
    case "options":
      return filter.values.includes(String(value ?? ""));
    case "range": {
      if (typeof value !== "number") return false;
      const min = filter.min === "" ? -Infinity : Number(filter.min);
      const max = filter.max === "" ? Infinity : Number(filter.max);
      return (
        (Number.isNaN(min) || value >= min) &&
        (Number.isNaN(max) || value <= max)
      );
    }
  }
}

/** Filtra e ordena sem mexer em `rows`. A ordenação é estável. */
export function applyTableView<T, C extends string>(
  rows: T[],
  view: TableView<C>,
  columns: Record<C, ColumnAccessor<T>>,
): T[] {
  const active = (
    Object.entries(view.filters) as [C, ColumnFilter | undefined][]
  ).filter((entry): entry is [C, ColumnFilter] => isFilterActive(entry[1]));
  const filtered =
    active.length === 0
      ? rows
      : rows.filter((row) =>
          active.every(([column, filter]) =>
            matches(columns[column].get(row), filter),
          ),
        );
  if (!view.sort) return filtered;
  const { column, dir } = view.sort;
  const get = columns[column].get;
  return filtered
    .map((row) => ({ row, value: get(row) }))
    .sort((a, b) => compareValues(a.value, b.value, dir))
    .map((entry) => entry.row);
}

/** Valores distintos de uma coluna, com quantas linhas têm cada um. */
export function columnOptions<T>(
  rows: T[],
  accessor: ColumnAccessor<T>,
): ColumnOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(accessor.get(row) ?? "");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => compareValues(a.value, b.value, "asc"));
}

const SORT_LABELS: Record<ColumnKind, Record<SortDir, string>> = {
  text: { asc: "A → Z", desc: "Z → A" },
  options: { asc: "A → Z", desc: "Z → A" },
  range: { asc: "0 → 9", desc: "9 → 0" },
};

type ColumnFilterHeaderProps = {
  /** Título da coluna — no cabeçalho, no topo do popover e no aria-label. */
  label: string;
  kind: ColumnKind;
  sort: SortDir | null;
  onSortChange: (dir: SortDir | null) => void;
  filter: ColumnFilter | undefined;
  onFilterChange: (filter: ColumnFilter | undefined) => void;
  /** Só em `options`: os valores que a coluna tem hoje. */
  options?: ColumnOption[];
  /** Sem a seção Filtrar — só A→Z / Z→A (listas de talhão no celular). */
  showFilter?: boolean;
};

/**
 * Título de coluna com o botão de ordenar e filtrar ao lado. O botão abre um
 * popover com a ordenação e o filtro da coluna; tudo vale na hora, sem
 * "aplicar". Ativo, o botão fica verde: seta quando ordena, ponto quando filtra.
 */
export function ColumnFilterHeader({
  label,
  kind,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  options = [],
  showFilter = true,
}: ColumnFilterHeaderProps) {
  const filtered = isFilterActive(filter);

  const trigger = (
    <Popover>
      <PopoverTrigger asChild>
        {showFilter ? (
        <button
          type="button"
          aria-label={`Ordenar e filtrar ${label}`}
          className={cn(
            "relative inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors outline-none",
            "hover:bg-hover hover:text-text-strong focus-visible:ring-2 focus-visible:ring-ring/40",
            "data-[state=open]:bg-hover data-[state=open]:text-text-strong",
            "pointer-coarse:before:absolute pointer-coarse:before:-inset-2",
            (sort || filtered) &&
              "text-primary hover:text-primary data-[state=open]:text-primary",
          )}
        >
          {sort === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : sort === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : (
            <ListFilter className="size-3.5" />
          )}
          {filtered ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary"
            />
          ) : null}
        </button>
        ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Ordenar por ${label}`}
          className={cn(
            "shrink-0 gap-1.5",
            sort && "border-primary/40 text-primary-strong",
          )}
        >
          {sort === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : sort === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : (
            <ArrowUpDown className="size-3.5" />
          )}
          {label}
        </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </p>
            {/* Menor que o `xs` e em cinza: é ação de apoio, não pode competir
                com a ordenação. Desabilitado, clareia em vez de só esmaecer. */}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={!sort && !(showFilter && filtered)}
              onClick={() => {
                if (sort) onSortChange(null);
                if (showFilter) onFilterChange(undefined);
              }}
              className="h-6 gap-1 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-text-strong disabled:text-muted-foreground/50 disabled:opacity-100"
            >
              <Trash2 />
              Limpar
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-strong">
              Ordenar
            </span>
            {/* Seleção única: clicar no sentido já ativo o desmarca (valor
                "") e desliga a ordenação. */}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={sort ?? ""}
              onValueChange={(value) =>
                onSortChange(value === "" ? null : (value as SortDir))
              }
              aria-label={`Ordenar ${label}`}
              className="w-full"
            >
              {(["asc", "desc"] as const).map((dir) => (
                <ToggleGroupItem
                  key={dir}
                  value={dir}
                  // Um degrau abaixo do `sm` do primitivo (h-8), que não tem
                  // tamanho menor.
                  className="h-7 flex-1 gap-1.5 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg:not([class*='size-'])]:size-3.5"
                >
                  {dir === "asc" ? <ArrowUp /> : <ArrowDown />}
                  {SORT_LABELS[kind][dir]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {showFilter ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-strong">
              Filtrar
            </span>
            {kind === "text" ? (
              <Input
                value={filter?.kind === "text" ? filter.query : ""}
                onChange={(e) =>
                  onFilterChange({ kind: "text", query: e.target.value })
                }
                placeholder="Contém…"
                aria-label={`Filtrar ${label}`}
                className="h-8 px-2.5 text-sm"
              />
            ) : kind === "range" ? (
              <RangeFields
                label={label}
                filter={filter?.kind === "range" ? filter : undefined}
                onFilterChange={onFilterChange}
              />
            ) : (
              <OptionList
                options={options}
                selected={filter?.kind === "options" ? filter.values : []}
                onChange={(values) =>
                  onFilterChange({ kind: "options", values })
                }
              />
            )}
          </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!showFilter) return trigger;

  return (
    <div className="flex items-center gap-1">
      <span className="min-w-0 truncate">{label}</span>
      {trigger}
    </div>
  );
}

function RangeFields({
  label,
  filter,
  onFilterChange,
}: {
  label: string;
  filter: Extract<ColumnFilter, { kind: "range" }> | undefined;
  onFilterChange: (filter: ColumnFilter) => void;
}) {
  const min = filter?.min ?? "";
  const max = filter?.max ?? "";
  // pt-BR: `MoneyInput` aceita "1.410,5" e entrega o número canônico.
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Mín.
        <MoneyInput
          value={min}
          onValueChange={(v) => onFilterChange({ kind: "range", min: v, max })}
          aria-label={`${label} mínimo`}
          className="h-8 px-2.5 text-right text-sm tabular-nums"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Máx.
        <MoneyInput
          value={max}
          onValueChange={(v) => onFilterChange({ kind: "range", min, max: v })}
          aria-label={`${label} máximo`}
          className="h-8 px-2.5 text-right text-sm tabular-nums"
        />
      </label>
    </div>
  );
}

function OptionList({
  options,
  selected,
  onChange,
}: {
  options: ColumnOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  // Um valor marcado que sumiu da coluna (a linha foi editada ou removida)
  // continua na lista, com 0 — senão filtraria sem aparecer em lugar nenhum.
  const missing = selected
    .filter((value) => !options.some((o) => o.value === value))
    .map((value) => ({ value, count: 0 }));
  const rows = [...options, ...missing];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum valor.</p>;
  }
  return (
    <div className="-mx-1 max-h-56 overflow-y-auto">
      {rows.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-text-strong hover:bg-hover"
          >
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-primary"
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? selected.filter((v) => v !== option.value)
                    : [...selected, option.value],
                )
              }
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                option.value === "" && "italic text-muted-foreground",
              )}
            >
              {option.value || "(vazio)"}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {option.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}
