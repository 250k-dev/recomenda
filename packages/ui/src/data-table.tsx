import * as React from "react";
import { cn } from "@recomenda/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

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

export function AdminCatalogNameCell({ name }: { name: string }) {
  return (
    <span
      className="block max-w-[14rem] truncate font-semibold text-text-strong"
      title={name}
    >
      {name}
    </span>
  );
}
