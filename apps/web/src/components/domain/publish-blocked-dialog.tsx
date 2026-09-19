"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import type { Route } from "next";
import type { PublishBlockItem } from "@recomenda/api/api-error";

const PAGE_SIZE = 12;

export function PublishBlockedDialog({
  open,
  onOpenChange,
  message,
  items,
  listHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  items: PublishBlockItem[];
  listHref?: Route | null;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    if (open) setPage(0);
  }, [open, items]);

  const pageItems = useMemo(() => {
    const start = page * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const paginate = items.length > PAGE_SIZE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Não foi possível publicar</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        {items.length > 0 ? (
          <div className="px-6 pb-1">
            <p className="mb-2 pt-4 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {items.length === 1
                ? "1 item impedindo"
                : `${items.length} itens impedindo`}
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {pageItems.map((item) => (
                <li
                  key={item.id || item.name}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {paginate ? (
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
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {listHref ? (
            <Button asChild>
              <Link href={listHref} onClick={() => onOpenChange(false)}>
                Ir à lista de compra
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
