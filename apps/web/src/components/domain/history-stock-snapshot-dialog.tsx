"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import type { CycleStockSnapshot } from "@recomenda/api/cycles";
import type { StockExportData } from "@recomenda/domain/stock/stock-export";
import { PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import { EXPORT_ACTION_CLASS } from "@/components/domain/export-action-class";
import { StockExportDialog } from "@/components/domain/stock-export-dialog";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function categoryLabel(category: string | null): string {
  if (!category) return "—";
  return (
    PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
    category
  );
}

export function HistoryStockSnapshotDialog({
  open,
  onOpenChange,
  snapshot,
  producerName,
  cycleName,
  capturedLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: CycleStockSnapshot;
  producerName?: string | null;
  cycleName: string;
  capturedLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const rows = useMemo(
    () =>
      snapshot.items.map((row) => ({
        ...row,
        categoryLabel: categoryLabel(row.category),
      })),
    [snapshot.items],
  );

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!row.category) continue;
      seen.set(row.category, row.categoryLabel);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      if (category && row.category !== category) return false;
      if (!q) return true;
      return (
        row.product_name.toLocaleLowerCase("pt-BR").includes(q) ||
        row.categoryLabel.toLocaleLowerCase("pt-BR").includes(q)
      );
    });
  }, [rows, query, category]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, row) => sum + (row.total_brl ?? 0), 0),
    [filtered],
  );

  const exportData: StockExportData = useMemo(
    () => ({
      producerName: producerName ?? null,
      heading: `Retrato do galpão · ${cycleName}`,
      note: `Saldos no fechamento · ${capturedLabel}. Não reflete o galpão de hoje.`,
      csvBasename: `retrato-galpao-${new Date().toISOString().slice(0, 10)}`,
      items: filtered.map((row) => ({
        product_name: row.product_name,
        category: row.category ?? "",
        category_label: row.categoryLabel,
        quantity: row.quantity,
        dose_unit: row.dose_unit ?? "",
        price_brl: row.price_brl,
        value_brl: row.total_brl,
      })),
    }),
    [filtered, producerName, cycleName, capturedLabel],
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            setQuery("");
            setCategory("");
            setExportOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Retrato do galpão</DialogTitle>
            <DialogDescription>
              {cycleName}
              {capturedLabel ? ` · ${capturedLabel}` : ""}. Saldos gravados no
              fechamento — não misturam com o galpão de hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar produto…"
                  aria-label="Buscar produto no retrato"
                  className="h-10 pl-9"
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filtrar por categoria"
                className="h-10 min-w-40 rounded-lg border border-input bg-surface px-3 text-sm text-text-strong outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="">Todas as categorias</option>
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className={`ml-auto gap-1.5 ${EXPORT_ACTION_CLASS}`}
                onClick={() => setExportOpen(true)}
                disabled={filtered.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
                Galpão sem produtos neste fechamento.
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
                Nenhum produto corresponde ao filtro.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-left">Categoria</th>
                      <th className="px-3 py-2 text-right">Quantidade</th>
                      <th className="px-3 py-2 text-right">Preço médio</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {filtered.map((item) => (
                      <tr key={item.local_product_id}>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {item.product_name}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {item.categoryLabel}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {fmtQty(item.quantity)}
                          {item.dose_unit ? ` ${item.dose_unit}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {item.price_brl != null ? fmtBrl(item.price_brl) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                          {item.total_brl != null ? fmtBrl(item.total_brl) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">
                {filtered.length === rows.length
                  ? `${rows.length} ${rows.length === 1 ? "produto" : "produtos"}`
                  : `${filtered.length} de ${rows.length} produtos`}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {fmtBrl(
                  query || category
                    ? filteredTotal
                    : (snapshot.total_brl ?? filteredTotal),
                )}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StockExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={exportData}
      />
    </>
  );
}
