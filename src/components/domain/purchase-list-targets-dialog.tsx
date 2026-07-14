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
import { TOTAL_TARGET_KEY } from "@/components/domain/category-meta-progress";

const num = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Modal para definir/editar a meta da lista de compra: um único total de sacas
 * desejadas (chave `TOTAL` em `category_targets`). Listas antigas com metas por
 * categoria (sc/ha) abrem com o campo pré-preenchido pela conversão
 * `soma(sc/ha) × hectares`; ao salvar, o formato novo substitui o antigo.
 * Salva só `category_targets` (sem tocar em itens/talhões).
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
  const initialTotal = (): string => {
    const total = initialTargets[TOTAL_TARGET_KEY] ?? 0;
    if (total > 0) return String(total);
    // Formato antigo: converte as metas por categoria (sc/ha) em sacas totais.
    const legacyPerHa = Object.entries(initialTargets)
      .filter(([category]) => category !== TOTAL_TARGET_KEY)
      .reduce((s, [, v]) => s + (v ?? 0), 0);
    return legacyPerHa > 0 && totalHa > 0
      ? String(Math.round(legacyPerHa * totalHa))
      : "";
  };

  const [total, setTotal] = useState(initialTotal);

  // Ao (re)abrir, recarrega a meta salva atual e descarta edições não
  // confirmadas — ajuste de estado durante o render (padrão recomendado pelo
  // React), em vez de setState num efeito.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTotal(initialTotal());
  }

  const parsed = Number(total);
  const totalValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const handleSave = async () => {
    // Meta zerada/vazia = sem meta (limpa também metas antigas por categoria).
    await onSave(totalValue > 0 ? { [TOTAL_TARGET_KEY]: totalValue } : {});
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
            Diga o total de sacas que pretende gastar. A lista mostra o realizado
            comparado à meta e avisa quando passar. Deixe em branco para não definir meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <Label htmlFor="dialog-total-target">Total de sacas desejadas</Label>
          <div className="flex items-center gap-2">
            <Input
              id="dialog-total-target"
              type="number"
              min="0"
              step="1"
              value={total}
              placeholder="Ex: 25000"
              onChange={(e) => setTotal(e.target.value)}
              className="h-11 max-w-[200px] text-right text-base font-semibold tabular-nums"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">sacas</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalValue > 0 && totalHa > 0
              ? `≈ ${num(totalValue / totalHa)} sc/ha nos ${num(totalHa)} ha da lista.`
              : "Compare com o KPI “Volume de sacas” da lista."}
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
