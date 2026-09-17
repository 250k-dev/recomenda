import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../primitives/pagination";
import {
  NativeSelect,
  NativeSelectOption,
} from "../primitives/native-select";
import { cn } from "@recomenda/utils";

/** Até 7 páginas cabem inteiras; acima disso, primeira, vizinhas e última. */
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

/**
 * O `Button` deste repo é um degrau maior que o do shadcn (default h-10 contra
 * h-9). A paginação usa o degrau de baixo para manter a proporção do
 * componente original.
 */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  /** Com os dois, a barra ganha o seletor de itens por página. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  /** Ajusta a moldura — ex.: solta do cartão, sem fundo nem borda. */
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  // Os componentes do shadcn são âncoras (paginação por URL). Aqui a página é
  // estado, então o clique é interceptado e o link não navega.
  const go = (target: number) => (event: MouseEvent) => {
    event.preventDefault();
    if (target === safePage || target < 1 || target > totalPages) return;
    onPageChange(target);
  };
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border bg-surface-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted-foreground">
        {total === 0 ? "Nenhum item" : `Mostrando ${from}–${to} de ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizeOptions && onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Por página
            <NativeSelect
              size="sm"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="w-20"
            >
              {pageSizeOptions.map((option) => (
                <NativeSelectOption key={option} value={String(option)}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                size="sm"
                href="#"
                onClick={go(safePage - 1)}
                aria-disabled={safePage <= 1}
                className={cn(safePage <= 1 && disabledClass)}
              />
            </PaginationItem>
            {pageWindow(safePage, totalPages).map((entry, idx) => (
              <PaginationItem key={`${entry}-${idx}`}>
                {entry === "…" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    size="icon-sm"
                    href="#"
                    isActive={entry === safePage}
                    onClick={go(entry)}
                  >
                    {entry}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                size="sm"
                href="#"
                onClick={go(safePage + 1)}
                aria-disabled={safePage >= totalPages}
                className={cn(safePage >= totalPages && disabledClass)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
