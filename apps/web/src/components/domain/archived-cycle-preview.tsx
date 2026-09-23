"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCyclePurchaseList, useProducerCycleHistory } from "@recomenda/api-hooks";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";

const REC_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  APPLIED_ON_TIME: "Aplicada",
  APPLIED_LATE: "Aplicada com atraso",
  SKIPPED: "Pulada",
};

const LIST_PAGE_SIZE = 25;
const PLOT_PAGE_SIZE = 8;

function doseLabel(dose: number, unit: string) {
  const value = dose.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return `${value} ${unit}`;
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1"
        disabled={page <= 0}
        onClick={() => onPage(Math.max(0, page - 1))}
      >
        <ChevronLeft className="size-4" />
        Anterior
      </Button>
      <p className="text-xs text-muted-foreground">
        Página {page + 1} de {pageCount}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
      >
        Próxima
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

export function ArchivedCyclePreview({
  open,
  onOpenChange,
  producerId,
  cycleId,
  cycleName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producerId: string;
  cycleId: string | null;
  cycleName: string;
}) {
  const enabled = open && Boolean(cycleId);
  const history = useProducerCycleHistory(producerId, cycleId ?? "", enabled);
  const list = useCyclePurchaseList(enabled ? (cycleId ?? "") : "");
  const [listPage, setListPage] = useState(0);
  const [plotPage, setPlotPage] = useState(0);

  useEffect(() => {
    setListPage(0);
    setPlotPage(0);
  }, [cycleId, open]);

  const plots = history.data?.plots ?? [];
  const items = useMemo(
    () =>
      [...(list.data?.items ?? [])].sort(
        (a, b) =>
          a.stage.localeCompare(b.stage, "pt-BR") ||
          a.product_name.localeCompare(b.product_name, "pt-BR"),
      ),
    [list.data?.items],
  );
  const listPageCount = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const plotPageCount = Math.max(1, Math.ceil(plots.length / PLOT_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listPageCount - 1);
  const safePlotPage = Math.min(plotPage, plotPageCount - 1);
  const visibleItems = items.slice(
    safeListPage * LIST_PAGE_SIZE,
    safeListPage * LIST_PAGE_SIZE + LIST_PAGE_SIZE,
  );
  const visiblePlots = plots.slice(
    safePlotPage * PLOT_PAGE_SIZE,
    safePlotPage * PLOT_PAGE_SIZE + PLOT_PAGE_SIZE,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,820px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{cycleName}</DialogTitle>
          <DialogDescription>
            Prévia somente leitura do que estava nesta safra.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Lista de compra
              {items.length > 0 ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {items.length} itens
                </span>
              ) : null}
            </h2>
            {list.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando lista…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta safra não tem lista de compra guardada.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {visibleItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{item.product_name}</span>
                        <span className="text-muted-foreground">{item.stage}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {doseLabel(item.dose_per_hectare, item.dose_unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Pager page={safeListPage} pageCount={listPageCount} onPage={setListPage} />
              </>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Recomendações
              {plots.length > 0 ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {plots.length} {plots.length === 1 ? "talhão" : "talhões"}
                </span>
              ) : null}
            </h2>
            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando programação…</p>
            ) : plots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum talhão nesta safra.</p>
            ) : (
              <>
                {visiblePlots.map((plot) => (
                  <div key={plot.season_id} className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {plot.plot_name}
                      <span className="font-normal text-muted-foreground"> · {plot.farm_name}</span>
                    </p>
                    {plot.recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem etapas.</p>
                    ) : (
                      plot.recommendations.map((rec) => (
                        <div key={rec.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rec.name}</span>
                            <Badge variant="neutral">{REC_STATUS[rec.status] ?? rec.status}</Badge>
                          </div>
                          {rec.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sem produtos.</p>
                          ) : (
                            <ul className="space-y-0.5 pl-3 text-sm text-muted-foreground">
                              {rec.items.map((item, index) => (
                                <li key={`${rec.id}-${index}`}>
                                  {item.product_name} · {doseLabel(item.dose_per_hectare, item.dose_unit)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))}
                <Pager page={safePlotPage} pageCount={plotPageCount} onPage={setPlotPage} />
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
