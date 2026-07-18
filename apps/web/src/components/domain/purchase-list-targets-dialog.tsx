"use client";

import { useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolveTotalTargetScHa,
  TOTAL_SC_HA_KEY,
} from "@/components/domain/category-meta-progress";

const num = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Modal para definir/editar a meta da lista de compra: um único valor em sc/ha
 * (chave `TOTAL_SC_HA`). Listas com `TOTAL` (sacas totais) ou metas por categoria
 * abrem com o campo pré-preenchido em sc/ha; ao salvar, o formato novo substitui
 * o antigo. Salva só `category_targets` (sem tocar em itens/talhões).
 */
export function PurchaseListTargetsDialog({
  open,
  onOpenChange,
  initialTargets,
  totalHa,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTargets: Record<string, number>;
  totalHa: number;
  onSave: (targets: Record<string, number>) => Promise<void> | void;
  saving?: boolean;
}) {
  const initialScHa = (): string => {
    const scHa = resolveTotalTargetScHa(initialTargets, totalHa);
    if (scHa <= 0) return "";
    // Mantém decimais quando veio de TOTAL÷ha; inteiro quando já era sc/ha.
    return Number.isInteger(scHa) ? String(scHa) : String(Number(scHa.toFixed(2)));
  };

  const [scHa, setScHa] = useState(initialScHa);

  // Ao (re)abrir, recarrega a meta salva atual e descarta edições não
  // confirmadas — ajuste de estado durante o render (padrão recomendado pelo
  // React), em vez de setState num efeito.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setScHa(initialScHa());
  }

  const parsed = Number(scHa);
  const scHaValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const handleSave = async () => {
    // Meta zerada/vazia = sem meta (limpa também TOTAL legado e metas por categoria).
    await onSave(scHaValue > 0 ? { [TOTAL_SC_HA_KEY]: scHaValue } : {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Meta de sacas da lista
          </DialogTitle>
          <DialogDescription>
            Diga a meta de custo em sacas por hectare. A lista mostra o realizado
            comparado à meta e avisa quando passar. Deixe em branco para não definir meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <Label htmlFor="dialog-total-target">Meta desejada (sc/ha)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="dialog-total-target"
              type="number"
              min="0"
              step="0.01"
              value={scHa}
              placeholder="Ex: 45"
              onChange={(e) => setScHa(e.target.value)}
              className="h-11 max-w-[200px] text-right text-base font-semibold tabular-nums"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">sc/ha</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {scHaValue > 0 && totalHa > 0
              ? `≈ ${num(scHaValue * totalHa)} sacas totais nos ${num(totalHa)} ha da lista.`
              : "Compare com o KPI “Custo (sc/ha)” da lista."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
