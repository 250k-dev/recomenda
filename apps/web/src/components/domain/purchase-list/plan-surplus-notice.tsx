"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { useAdjustPlanToUsage, usePlanSurplus } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { cn } from "@recomenda/utils";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * Produtos programados na lista bem acima do que as etapas usam (produto
 * trocado, etapa pulada, só alguns talhões usam). O excesso fica reservado no
 * estoque e entra no "falta comprar" à toa. Uma linha discreta, fechada por
 * padrão; só aparece quando há sobra.
 */
export function PlanSurplusNotice({
  listId,
  cycleId,
  producerId,
  canEdit,
}: {
  listId: string;
  cycleId?: string;
  producerId?: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: surplus } = usePlanSurplus(listId);
  const adjust = useAdjustPlanToUsage(listId, { cycleId, producerId });
  const [adjusting, setAdjusting] = useState<string | null>(null);

  if (!surplus || surplus.length === 0) return null;

  const count = surplus.length;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <Info className="size-4 shrink-0" />
        <span className="flex-1">
          {count === 1
            ? "1 produto programado acima do uso nas etapas"
            : `${count} produtos programados acima do uso nas etapas`}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            A diferença fica reservada no estoque e entra no &quot;falta comprar&quot;. Ajuste se o
            produto foi trocado ou não vai ser usado em todos os talhões.
          </p>
          <ul className="flex flex-col gap-2">
            {surplus.map((s) => (
              <li
                key={s.local_product_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.product_name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Programado {fmt(s.planned)} {s.unit} · etapas usam {fmt(s.used)} {s.unit} ·{" "}
                    <span className="font-semibold text-foreground">
                      sobra {fmt(s.surplus)} {s.unit}
                    </span>
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adjust.isPending}
                    onClick={() => {
                      setAdjusting(s.local_product_id);
                      adjust.mutate(s.local_product_id, {
                        onSuccess: () => toast.success(`${s.product_name} ajustado ao uso nas etapas.`),
                        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível ajustar.")),
                        onSettled: () => setAdjusting(null),
                      });
                    }}
                  >
                    {adjusting === s.local_product_id ? "Ajustando…" : "Ajustar ao uso"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
