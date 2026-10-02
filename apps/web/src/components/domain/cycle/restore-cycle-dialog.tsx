"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArchiveRestore, Check } from "lucide-react";
import { toast } from "sonner";

import { routes } from "@recomenda/config";
import { useCycleRestorePreview, useRestoreCycle } from "@recomenda/api-hooks";
import type {
  CycleRestorePosition,
  CycleRestorePreviewLoss,
} from "@recomenda/api/cycles";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { cn } from "@recomenda/utils";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const unitLabel = (unit: string | null) =>
  unit === "T_HA" ? "t" : (unit ?? "");

const OPTIONS: Array<{
  id: CycleRestorePosition;
  title: string;
  hint: string;
}> = [
  {
    id: "last",
    title: "Última da fila",
    hint: "Fica só com o que sobrar no galpão depois das outras safras. Nada muda nas outras.",
  },
  {
    id: "first",
    title: "Primeira da fila",
    hint: "Volta a ter prioridade no galpão. As outras safras podem passar a precisar comprar.",
  },
];

/** Perdas agrupadas por safra: "Safra Milho 26 passa a precisar comprar: …". */
function LossesByCycle({ losses }: { losses: CycleRestorePreviewLoss[] }) {
  const byCycle = new Map<string, CycleRestorePreviewLoss[]>();
  for (const loss of losses) {
    const arr = byCycle.get(loss.cycle_name) ?? [];
    arr.push(loss);
    byCycle.set(loss.cycle_name, arr);
  }
  return (
    <ul className="space-y-2">
      {[...byCycle.entries()].map(([cycleName, rows]) => (
        <li key={cycleName} className="text-sm">
          <span className="font-medium text-foreground">{cycleName}</span>{" "}
          <span className="text-muted-foreground">passa a precisar comprar:</span>
          <ul className="mt-1 space-y-0.5 pl-3 text-muted-foreground">
            {rows.map((row) => (
              <li key={`${row.list_id}-${row.local_product_id}`}>
                {row.product_name} ·{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {fmtQty(row.lost)} {unitLabel(row.dose_unit)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Recuperar safra": devolve a safra arquivada à operação. Quando outras safras
 * disputam o galpão, o agrônomo escolhe a posição na fila — última (padrão, não
 * mexe nas outras) ou primeira (volta a ter prioridade e mostra o impacto).
 */
export function RestoreCycleDialog({
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
  const router = useRouter();
  const [position, setPosition] = useState<CycleRestorePosition>("last");
  const preview = useCycleRestorePreview(open ? cycleId : null);
  const restore = useRestoreCycle(producerId);

  // Reabrir o diálogo volta à opção segura.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setPosition("last");
  }

  const data = preview.data;
  const hasQueue = Boolean(data?.has_queue);
  const firstLosses = data?.first.losses ?? [];
  const busyPlots = data?.plots_in_other_cycles ?? [];

  const submit = () => {
    if (!cycleId) return;
    restore.mutate(
      { id: cycleId, position: hasQueue ? position : "last" },
      {
        onSuccess: (cycle) => {
          onOpenChange(false);
          toast.success(`Safra “${cycleName}” recuperada.`);
          router.push(
            routes.fazendas.safra(cycle.farm_id, cycle.id, {
              producer_id: producerId,
            }),
          );
        },
        onError: (error) =>
          toast.error(apiErrorMessage(error, "Não foi possível recuperar a safra.")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArchiveRestore className="size-5 text-primary-strong" />
            Recuperar safra
          </DialogTitle>
          <DialogDescription>
            “{cycleName}” volta para a operação com a programação e a lista de
            compra que tinha ao ser arquivada.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2">
          {preview.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando o impacto no estoque…</p>
          ) : preview.isError ? (
            <p className="text-sm text-destructive">
              Não foi possível calcular o impacto no estoque.
            </p>
          ) : data?.restores_as === "historical" ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              Era um arquivo de safra antiga: volta para o histórico e não usa o
              estoque do galpão.
            </p>
          ) : data?.restores_as === "harvested" ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              A safra estava colhida: volta como colhida e não reserva estoque do
              galpão.
            </p>
          ) : !hasQueue ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              Nenhuma outra safra está usando o galpão — ela volta como a
              primeira da fila do estoque.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                Lugar na fila do estoque
              </p>
              <p className="text-xs text-muted-foreground">
                O estoque do galpão é dividido entre as safras em ordem: a
                primeira fica com o que precisa, as seguintes com o que sobrar.
              </p>
              {OPTIONS.map((opt) => {
                const checked = position === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      "block cursor-pointer rounded-lg border px-3 py-2.5",
                      checked
                        ? "border-primary bg-primary-soft/40"
                        : "border-border hover:bg-hover/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="restore-position"
                      checked={checked}
                      onChange={() => setPosition(opt.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full",
                          checked
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-surface",
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      {opt.title}
                    </span>
                    <span className="mt-0.5 block pl-6 text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                    {opt.id === "first" && checked ? (
                      <span className="mt-2 block pl-6">
                        {firstLosses.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            Nenhuma outra safra perde estoque.
                          </span>
                        ) : (
                          <LossesByCycle losses={firstLosses} />
                        )}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}

          {busyPlots.length > 0 ? (
            <div className="flex gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
              <div>
                <p className="font-medium text-foreground">
                  Talhões que hoje estão em outra safra
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {busyPlots.map((plot) => (
                    <li key={`${plot.plot_id}-${plot.cycle_name}`}>
                      {plot.plot_name} · {plot.cycle_name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-6 py-4">
          <Button
            className="flex-1"
            onClick={submit}
            disabled={!cycleId || preview.isLoading || restore.isPending}
          >
            {restore.isPending ? "Recuperando..." : "Recuperar safra"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
