"use client";

import { useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Label } from "@recomenda/ui/primitives/label";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import { useFulfillPurchaseListWithoutQuote } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { cn } from "@recomenda/utils";

type Step = "closed" | "warn" | "total";

export function FulfillWithoutQuoteButton({
  listId,
  pending,
  className,
  size = "sm",
  variant = "outline",
}: {
  listId: string;
  /** Só renderiza quando há quantidade a comprar. */
  pending: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "clay" | "outline" | "secondary" | "ghost";
}) {
  const fulfill = useFulfillPurchaseListWithoutQuote(listId);
  const [step, setStep] = useState<Step>("closed");
  const [totalRaw, setTotalRaw] = useState("");

  if (!pending) return null;

  const close = () => {
    if (fulfill.isPending) return;
    setStep("closed");
    setTotalRaw("");
  };

  const submit = async (manualTotal: number | null) => {
    try {
      const result = await fulfill.mutateAsync({
        idempotency_key: crypto.randomUUID(),
        manual_total_spent_brl: manualTotal,
      });
      setStep("closed");
      setTotalRaw("");
      toast.success(
        result.is_complete
          ? "Estoque preenchido — lista registrada sem cotação."
          : "Estoque preenchido. Ainda há itens pendentes.",
      );
    } catch (e) {
      toast.error(
        apiErrorMessage(e, "Não foi possível registrar a lista sem cotação."),
      );
    }
  };

  const parsedTotal = Number(totalRaw);
  const totalValid = Number.isFinite(parsedTotal) && parsedTotal > 0;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(
          "gap-1.5 border-warning-border bg-warning-soft text-warning-strong hover:bg-warning-soft/80 hover:text-warning-strong",
          className,
        )}
        onClick={() => setStep("warn")}
      >
        <PackageCheck className="size-4" />
        Registrar sem cotação
      </Button>

      <Dialog
        open={step === "warn"}
        onOpenChange={(open) => {
          if (!open) {
            setStep((current) => (current === "warn" ? "closed" : current));
            setTotalRaw("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar sem cotação nem preço</DialogTitle>
            <DialogDescription>
              Esta lista não entra no plano de custo por produto (não há R$/ha
              linha a linha). O estoque será preenchido com a quantidade a
              comprar mesmo assim. Sacas e sc/ha da lista só aparecem se você
              informar o total gasto no próximo passo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => setStep("total")}>
              Entendi, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={step === "total"}
        onOpenChange={(open) => {
          if (!open && !fulfill.isPending) {
            setStep((current) => (current === "total" ? "closed" : current));
            setTotalRaw("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deseja adicionar o valor total gasto?</DialogTitle>
            <DialogDescription>
              Se informar, a lista mostra o total e calcula sacas. Se não, a
              lista fica sem valor. Nos dois casos o estoque é preenchido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 px-6 py-4">
            <Label htmlFor="manual-total-spent">Total gasto (R$)</Label>
            <MoneyInput
              id="manual-total-spent"
              value={totalRaw}
              onValueChange={setTotalRaw}
              decimals={2}
              placeholder="0,00"
              disabled={fulfill.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit(null)}
              disabled={fulfill.isPending}
            >
              Não, deixar sem valor
            </Button>
            <Button
              type="button"
              onClick={() => void submit(parsedTotal)}
              disabled={fulfill.isPending || !totalValid}
              className="gap-2"
            >
              {fulfill.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Sim, registrar com este valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
