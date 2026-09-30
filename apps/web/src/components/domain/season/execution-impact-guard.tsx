"use client";

import { useState, type ReactNode } from "react";
import { ShoppingCart } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@recomenda/ui/primitives/alert-dialog";
import { getExecutionImpact, type ExecutionImpact } from "@recomenda/api/purchase-lists";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type ImpactInput = Parameters<typeof getExecutionImpact>[0];

/**
 * Antes de colocar/alterar um produto numa etapa: se a safra já está publicada
 * e a mudança gera compra (o estoque livre não cobre), mostra o impacto e pede
 * confirmação. Sem compra nova, segue direto — nada de aviso à toa.
 */
export function useExecutionImpactGuard(): {
  guard: (input: ImpactInput, proceed: () => void) => Promise<void>;
  checking: boolean;
  dialog: ReactNode;
} {
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<{ impact: ExecutionImpact; proceed: () => void } | null>(
    null,
  );

  const guard = async (input: ImpactInput, proceed: () => void) => {
    setChecking(true);
    try {
      const impact = await getExecutionImpact(input);
      if (impact.warn) {
        setPending({ impact, proceed });
        return;
      }
    } catch {
      // Sem prévia não trava a edição da etapa.
    } finally {
      setChecking(false);
    }
    proceed();
  };

  const impact = pending?.impact;
  const dialog = (
    <AlertDialog
      open={pending != null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <AlertDialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader className="grid-rows-none">
          <AlertDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 shrink-0 text-warning" />
            Isso gera compra na safra
          </AlertDialogTitle>
        </AlertDialogHeader>
        {impact ? (
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2 text-left text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{impact.product_name}</strong>: +
                {fmt(impact.added)} {impact.unit} para esta safra.
              </p>
              <p>
                {impact.free_stock > 0
                  ? `${fmt(impact.free_stock)} ${impact.unit} saem do estoque livre · `
                  : ""}
                <strong className="text-foreground">
                  falta comprar {fmt(impact.to_buy)} {impact.unit}
                </strong>
                .
              </p>
              <p className="text-xs">
                A safra volta a &quot;Aguardando compra&quot;. O cronograma publicado não muda.
              </p>
            </div>
          </AlertDialogDescription>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const next = pending?.proceed;
              setPending(null);
              next?.();
            }}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, checking, dialog };
}
