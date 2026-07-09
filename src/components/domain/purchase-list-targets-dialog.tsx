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
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";

/** Categorias que o agrônomo pode orçar (espelha o passo de metas do wizard). */
const META_CATEGORIES = [
  "CULTIVAR_SOJA",
  "HIBRIDO_MILHO",
  "FERTILIZER",
  "HERBICIDE",
  "FUNGICIDE",
  "INSECTICIDE",
  "BIOLOGICAL",
  "FOLIAR",
  "ADJUVANT",
];

const num = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Modal para definir/editar as metas de gasto por categoria (sc/ha) de uma lista
 * de compra já criada. Preenche com as metas atuais e salva só `category_targets`
 * (sem tocar em itens/talhões).
 */
export function PurchaseListTargetsDialog({
  open,
  onOpenChange,
  initialTargets,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTargets: Record<string, number>;
  onSave: (targets: Record<string, number>) => Promise<void> | void;
  saving?: boolean;
}) {
  const [targets, setTargets] = useState<Record<string, number>>(initialTargets);

  // Ao (re)abrir, recarrega as metas salvas atuais e descarta edições não
  // confirmadas — ajuste de estado durante o render (padrão recomendado pelo
  // React), em vez de setState num efeito.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTargets(initialTargets);
  }

  const setOne = (category: string, value: string) => {
    const n = value === "" ? 0 : Number(value);
    setTargets((prev) => ({ ...prev, [category]: Number.isFinite(n) ? n : 0 }));
  };

  const totalDesejado = META_CATEGORIES.reduce((s, c) => s + (targets[c] ?? 0), 0);

  const handleSave = async () => {
    // Mantém só as categorias com meta > 0 (espelha o wizard).
    const cleaned = Object.fromEntries(
      Object.entries(targets).filter(([, v]) => (v ?? 0) > 0),
    );
    await onSave(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas de gasto por categoria
          </DialogTitle>
          <DialogDescription>
            Diga quanto pretende gastar por categoria (em sacas/ha). A lista mostra o
            realizado comparado à meta e avisa quando passar. Deixe em branco para não
            definir meta na categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Categoria</span>
            <span>Meta (sc/ha)</span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {META_CATEGORIES.map((category) => {
              const target = targets[category] ?? 0;
              const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
              return (
                <div key={category} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  </span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={target ? String(target) : ""}
                    placeholder="meta"
                    onChange={(e) => setOne(category, e.target.value)}
                    className="h-8 w-20 px-2 text-right text-sm tabular-nums"
                  />
                </div>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-semibold text-foreground">Total</span>
              <span className="tabular-nums">
                <strong className="text-foreground">
                  {totalDesejado > 0 ? num(totalDesejado) : "—"}
                </strong>
                <span className="text-muted-foreground"> sc/ha</span>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
