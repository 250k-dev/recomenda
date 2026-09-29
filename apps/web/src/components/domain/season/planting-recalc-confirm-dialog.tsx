"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import type { PlantingPreviewChange } from "@recomenda/api";
import { fmtDate } from "@recomenda/domain/recommendations/format";

const PAGE_SIZE = 12;

/**
 * Aviso antes de salvar o plantio: as etapas que já têm data serão
 * recalculadas a partir dele. Se alguma aplicação já foi feita e não foi
 * registrada, ela "volta" a ficar pendente numa data nova — por isso o aviso
 * pede para registrar antes. Mesmo padrão visual do "Não foi possível publicar".
 */
export function PlantingRecalcConfirmDialog({
  open,
  onOpenChange,
  plantingDate,
  changes,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantingDate: string;
  changes: PlantingPreviewChange[];
  loading?: boolean;
  onConfirm: () => void;
}) {
  // A página volta para a primeira quando chega uma prévia nova (outra lista).
  const [paging, setPaging] = useState({ source: changes, page: 0 });
  const page = paging.source === changes ? paging.page : 0;
  const setPage = (update: (current: number) => number) =>
    setPaging({ source: changes, page: update(page) });
  const pageCount = Math.max(1, Math.ceil(changes.length / PAGE_SIZE));

  const pageItems = useMemo(() => {
    const start = page * PAGE_SIZE;
    return changes.slice(start, start + PAGE_SIZE);
  }, [changes, page]);

  const count = changes.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "1 etapa com data será recalculada"
              : `${count} etapas com data serão recalculadas`}
          </DialogTitle>
          <DialogDescription>
            Com o plantio em {fmtDate(plantingDate)}, as datas abaixo passam a ser
            contadas a partir dele. Se alguma dessas aplicações já foi feita,
            registre antes de salvar: aplicação registrada mantém a data e desconta
            o estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-1">
          <p className="mb-2 pt-4 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Data atual → nova data
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {pageItems.map((change) => (
              <li
                key={change.id}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {change.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                  {fmtDate(change.from)}
                  <ArrowRight className="size-3 shrink-0" aria-hidden />
                  <span className="font-semibold text-foreground">
                    {change.to ? fmtDate(change.to) : "sem data"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          {count > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1"
                disabled={page <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
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
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
              >
                Próxima
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
          <Button type="button" disabled={loading} onClick={onConfirm}>
            {loading ? "Salvando…" : "Salvar plantio e recalcular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
