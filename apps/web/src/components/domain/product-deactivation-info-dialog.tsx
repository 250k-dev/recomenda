"use client";

import { useState } from "react";
import { Eye, Loader2, PackageX, Store } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@recomenda/ui/primitives/dialog";
import { useProductListUsage } from "@recomenda/api-hooks";

/** dd/MM/yyyy HH:mm a partir de um ISO; vazio vira traço. */
function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Modal "olho" da aba Removidos: mostra quem desativou e quando, e as listas de
 * compra ativas que ainda usam o produto. A query das listas só dispara quando
 * o modal abre (`enabled` no hook), então a tabela não faz N requisições.
 */
export function ProductDeactivationInfoDialog({
  localProductId,
  productName,
  deactivatedAt,
  deactivatedByName,
}: {
  localProductId: string;
  productName: string;
  deactivatedAt?: string | null;
  deactivatedByName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { data: usage, isLoading } = useProductListUsage(
    open ? localProductId : null,
  );
  const lists = usage ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Ver detalhes da remoção"
          title="Ver detalhes da remoção"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{productName}</span>
          </DialogTitle>
          <DialogDescription>Detalhes da remoção do catálogo</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <dt className="text-muted-foreground">Desativado por</dt>
            <dd className="min-w-0 break-words font-medium text-text-strong">
              {deactivatedByName?.trim() || "Sem registro"}
            </dd>
            <dt className="text-muted-foreground">Quando</dt>
            <dd className="font-medium text-text-strong">
              {formatDateTime(deactivatedAt)}
            </dd>
          </dl>
          {!deactivatedByName && !deactivatedAt ? (
            <p className="text-xs leading-snug text-muted-foreground">
              Produto desativado antes do registro de auditoria — sem como
              recuperar quem ou quando.
            </p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ainda em uso{" "}
              {lists.length > 0 ? `(${lists.length})` : ""}
            </p>
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando listas…
              </div>
            ) : lists.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Não está em nenhuma lista de compra ativa.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                {lists.map((list) => (
                  <li
                    key={list.purchase_list_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text-strong">
                        <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {list.producer_name?.trim() || "Sem produtor"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {list.list_name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {list.items_count}{" "}
                      {list.items_count === 1 ? "item" : "itens"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {lists.length > 0 ? (
              <p className="mt-2 text-xs leading-snug text-muted-foreground">
                Nessas listas o produto continua aparecendo na recomendação da
                safra. Some só das listas novas.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
