import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header, i) => (
            <TableHead key={i}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} className={columnCellClassNames?.[j]}>
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
  );
}

export function AdminCatalogNameCell({ name }: { name: string }) {
  return (
    <span
      className="block max-w-[14rem] truncate font-medium text-foreground"
      title={name}
    >
      {name}
    </span>
  );
}
