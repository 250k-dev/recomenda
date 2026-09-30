"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@recomenda/ui/primitives/input";
import { CATEGORY_COLORS } from "@recomenda/domain/cost-plan/categories";
import { cn, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import {
  applyTableView,
  columnOptions,
  ColumnFilterHeader,
  isTableViewActive,
  withColumnFilter,
  type ColumnAccessor,
  type TableView,
} from "@/components/domain/table-column-filter";

/** Linha mínima: a tabela cuida de categoria (cor + rótulo) e produto. */
export type StockTableRow = {
  key: string;
  product_name: string;
  category: string | null;
};

export type StockTableColumn<T> = {
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Sem accessor a coluna não ordena nem filtra (ações, ícones). */
  accessor?: ColumnAccessor<T>;
  render: (row: T) => ReactNode;
  /** Rodapé: total do que passou no filtro. */
  total?: (rows: T[]) => ReactNode;
  className?: string;
};

export function categoryLabel(category: string | null): string {
  if (!category) return "—";
  return (
    PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
    category
  );
}

const FIXED = ["category", "product"] as const;

/**
 * Tabela do estoque no padrão da lista de compra: linha tingida pela cor da
 * categoria (as mesmas de "Gastos por categoria"), bolinha + rótulo, busca e
 * ordenação/filtro por coluna. Rodapé soma só o que passou no filtro.
 */
export function StockCategoryTable<T extends StockTableRow>({
  rows,
  columns,
  emptyText,
  searchPlaceholder = "Buscar produto…",
}: {
  rows: T[];
  columns: StockTableColumn<T>[];
  emptyText: string;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TableView<string>>({ sort: null, filters: {} });

  const accessors = useMemo(() => {
    const map: Record<string, ColumnAccessor<T>> = {
      category: { kind: "options", get: (r) => categoryLabel(r.category) },
      product: { kind: "text", get: (r) => r.product_name },
    };
    for (const col of columns) if (col.accessor) map[col.id] = col.accessor;
    return map;
  }, [columns]);

  const visible = useMemo(() => {
    const q = search
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim();
    const searched = q
      ? rows.filter((r) =>
          r.product_name
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .includes(q),
        )
      : rows;
    return applyTableView(searched, view, accessors);
  }, [rows, search, view, accessors]);

  const header = (id: string, label: string, align: "left" | "right" | "center" = "left") => {
    const accessor = accessors[id];
    const content = accessor ? (
      <ColumnFilterHeader
        label={label}
        kind={accessor.kind}
        sort={view.sort?.column === id ? view.sort.dir : null}
        onSortChange={(dir) =>
          setView((v) => ({
            ...v,
            sort: dir ? { column: id, dir } : v.sort?.column === id ? null : v.sort,
          }))
        }
        filter={view.filters[id]}
        onFilterChange={(filter) => setView((v) => withColumnFilter(v, id, filter))}
        options={accessor.kind === "options" ? columnOptions(rows, accessor) : []}
      />
    ) : (
      label
    );
    return (
      <th
        key={id}
        className={cn(
          "px-3 py-2 font-semibold",
          align === "right" && "text-right",
          align === "center" && "text-center",
          align === "left" && "text-left",
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1",
            align === "right" && "justify-end",
          )}
        >
          {content}
        </span>
      </th>
    );
  };

  const filtering = search.trim() !== "" || isTableViewActive(view);
  const hasTotals = columns.some((c) => c.total);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-9 text-sm"
          aria-label="Buscar produto"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {header(FIXED[0], "Categoria")}
              {header(FIXED[1], "Produto")}
              {columns.map((c) => header(c.id, c.label, c.align))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0 ? emptyText : "Nenhum produto com esses filtros."}
                  {filtering && rows.length > 0 ? (
                    <button
                      type="button"
                      className="ml-1 font-medium text-primary hover:underline"
                      onClick={() => {
                        setSearch("");
                        setView({ sort: null, filters: {} });
                      }}
                    >
                      · limpar filtros
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const color =
                  CATEGORY_COLORS[row.category ?? "OTHER"] ?? CATEGORY_COLORS.OTHER;
                const wash = `color-mix(in srgb, ${color} ${index % 2 === 0 ? 10 : 16}%, var(--color-card))`;
                return (
                  <tr key={row.key} className="[&>td]:h-[48px]" style={{ backgroundColor: wash }}>
                    <td className="px-3 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="truncate text-muted-foreground">
                          {categoryLabel(row.category)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {row.product_name}
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className={cn(
                          "px-3 py-1.5 tabular-nums",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {hasTotals && visible.length > 0 ? (
            <tfoot className="border-t border-border bg-muted/30 text-sm">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={2}>
                  {visible.length === 1 ? "1 produto" : `${visible.length} produtos`}
                  {filtering ? " no filtro" : ""}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-3 py-2 font-semibold tabular-nums text-foreground",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.total ? c.total(visible) : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
