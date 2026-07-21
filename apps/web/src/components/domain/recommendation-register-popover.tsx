"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, SkipForward, Zap } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@recomenda/ui/primitives/popover";
import {
  useApplyRecommendation,
  useSkipRecommendation,
} from "@recomenda/api-hooks";
import { todayLocalYmd } from "@recomenda/domain/timing/window-days";

/**
 * Atalho "Registrar aplicação": abre um popover ancorado com o mesmo mini-form do
 * painel de Execução (data + observações + Marcar como aplicada + Pular), sem tirar
 * o consultor da lista nem abrir a etapa. Usado na tela inicial, no cronograma e no
 * card da recomendação. Só orquestra os hooks já existentes — nenhum cálculo aqui.
 */
export function RecommendationRegisterPopover({
  seasonId,
  recommendationId,
  title,
  defaultDate,
  align = "end",
  trigger,
}: {
  seasonId: string;
  recommendationId: string;
  /** Nome da etapa, mostrado no cabeçalho do popover ("Registrar · Dessecação"). */
  title?: string;
  /** Data pré-preenchida (padrão: hoje). */
  defaultDate?: string;
  align?: "start" | "center" | "end";
  /** Gatilho custom; padrão é um botão "Registrar" outline. */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate ?? todayLocalYmd());
  const [notes, setNotes] = useState("");

  const applyMut = useApplyRecommendation(seasonId);
  const skipMut = useSkipRecommendation(seasonId);
  const isBusy = applyMut.isPending || skipMut.isPending;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Ao (re)abrir, volta aos padrões — evita estado velho depois de cancelar.
    if (next) {
      setDate(defaultDate ?? todayLocalYmd());
      setNotes("");
    }
  };

  const handleApply = () => {
    if (!date) return;
    applyMut.mutate(
      { id: recommendationId, executed_date: date, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success("Etapa registrada como aplicada.");
          setOpen(false);
        },
        onError: () => toast.error("Não foi possível registrar."),
      },
    );
  };

  const handleSkip = () => {
    skipMut.mutate(
      { id: recommendationId, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success("Etapa marcada como pulada.");
          setOpen(false);
        },
        onError: () => toast.error("Não foi possível marcar como pulada."),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Zap className="h-3.5 w-3.5" />
            Registrar
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80"
        // O card/linha em volta é clicável (navega/expande) — o popover não deve vazar.
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Registrar{title ? ` · ${title}` : ""}
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-primary">
              Data de execução
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 text-sm font-semibold border-primary/30 bg-card"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Observações (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: aplicado 10% a menos por chuva"
              className="h-10 text-sm bg-card"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isBusy || !date}
              className="h-8 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {applyMut.isPending ? "Salvando…" : "Marcar como aplicada"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSkip}
              disabled={isBusy}
              className="h-8 gap-1.5 bg-card text-muted-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
