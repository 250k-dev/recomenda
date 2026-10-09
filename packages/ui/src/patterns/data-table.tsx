import * as React from "react";
import { cn } from "@recomenda/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../primitives/table";

export function DataTable({
  headers,
  rows,
  columnCellClassNames,
  footer,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  columnCellClassNames?: string[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-2 hover:bg-surface-2">
            {headers.map((header, i) => (
              <TableHead
                key={i}
                className="h-auto px-4 py-3.5 text-[0.72rem] font-bold uppercase tracking-[0.07em] text-muted-foreground"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell
                  key={j}
                  className={cn("px-4 py-3", columnCellClassNames?.[j])}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer && (
          <tfoot>
            <tr>
              <td colSpan={headers.length}>{footer}</td>
            </tr>
          </tfoot>
        )}
      </Table>
    </div>
  );
}

/**
 * Célula de nome com `title` — nada específico de tela. Por padrão trunca em
 * uma linha (14rem). `lines={2}` deixa quebrar em até duas linhas ocupando a
 * largura da coluna, para nomes longos (ex.: genéricos com várias marcas) não
 * ficarem cortados demais.
 */
export function TruncatedNameCell({
  name,
  lines = 1,
  className,
}: {
  name: string;
  lines?: 1 | 2;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block font-semibold text-text-strong",
        lines === 2
          ? "line-clamp-2 whitespace-normal break-words"
          : "max-w-[14rem] truncate",
        className,
      )}
      title={name}
    >
      {name}
    </span>
  );
}
