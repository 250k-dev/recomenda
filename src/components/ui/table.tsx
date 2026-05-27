"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

/** Colunas de ação costumam usar o rótulo "Ações" ou header vazio no fim da lista. */
function isActionsLastColumn(headers: string[]): boolean {
  if (headers.length === 0) return false
  const last = headers[headers.length - 1]?.trim() ?? ""
  return last === "Ações" || last === ""
}

/** Célula de nome longo: evita estourar layout da tabela. */
export function AdminCatalogNameCell({ name }: { name: string }) {
  return (
    <span
      className="block min-w-0 max-w-[min(32rem,70vw)] truncate align-top font-medium"
      title={name}
    >
      {name}
    </span>
  )
}

/** Helper componente para tabelas simples com dados estruturados */
export function DataTable({
  headers,
  rows,
  /** Se true, a última coluna fica alinhada ao fim (direita em LTR). "auto" detecta Ações ou header vazio. */
  alignLastColumnEnd = "auto" as boolean | "auto",
  /** classes extras por índice de coluna (ex.: max-w-0 na primeira para truncar nome) */
  columnCellClassNames,
  footer,
}: {
  headers: string[]
  rows: React.ReactNode[][]
  alignLastColumnEnd?: boolean | "auto"
  columnCellClassNames?: (string | undefined)[]
  footer?: React.ReactNode
}) {
  const lastIdx = headers.length - 1
  const alignEnd =
    alignLastColumnEnd === true ||
    (alignLastColumnEnd === "auto" && isActionsLastColumn(headers))

  return (
    <div className="rounded-lg border bg-card ring-1 ring-foreground/5">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headers.map((header, i) => (
              <TableHead
                key={`${header}-${i}`}
                className={cn(
                  "text-muted-foreground",
                  alignEnd && i === lastIdx && "text-end",
                )}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-10 text-center text-muted-foreground"
                colSpan={headers.length}
              >
                Nenhum dado encontrado.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={index}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`${index}-${cellIndex}`}
                    className={cn(
                      "align-top",
                      alignEnd && cellIndex === lastIdx && "text-end",
                      columnCellClassNames?.[cellIndex],
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {footer}
    </div>
  )
}
