"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildMultiWhatsappMessage,
  type RecommendationShareData,
} from "@/lib/recommendations/share-message";
import { printRecommendations } from "@/lib/recommendations/print-document";
import { WhatsAppIcon } from "@/assets/whatsapp-icon";
import { cn } from "@/lib/utils";

export interface FarmExportItem {
  id: string;
  label: string;
  data: RecommendationShareData;
}

export function FarmSeasonsExportDialog({
  open,
  onOpenChange,
  farmName,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName?: string | null;
  items: FarmExportItem[];
}) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => items.map((i) => i.id), [items]);

  // Marca todos ao abrir (ajuste durante o render ao detectar mudança de `open`).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelected(new Set(allIds));
  }

  const selectedItems = items.filter((i) => selected.has(i.id));
  const message = selectedItems.length
    ? buildMultiWhatsappMessage(
        farmName,
        selectedItems.map((i) => i.data),
      )
    : "";
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Texto copiado para a area de transferencia.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nao foi possivel copiar. Copie o texto manualmente.");
    }
  };

  const handlePrint = () => {
    onOpenChange(false);
    window.setTimeout(
      () => printRecommendations(selectedItems.map((i) => i.data), `Recomendações - ${farmName ?? ""}`),
      250,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar talhões</DialogTitle>
          <DialogDescription>
            Selecione os talhões e envie a programação pelo WhatsApp ou em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-strong">Talhões</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="text-xs font-medium text-primary-strong hover:underline"
                  onClick={() => setSelected(new Set(allIds))}
                >
                  Todos
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-strong hover:underline"
                  onClick={() => setSelected(new Set())}
                >
                  Nenhum
                </button>
              </div>
            </div>
            {items.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Nenhuma safra com cronograma para exportar.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((it) => {
                  const on = selected.has(it.id);
                  return (
                    <li key={it.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                          on ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={on}
                          onChange={() => toggle(it.id)}
                        />
                        <span className="font-medium text-text-strong">{it.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {it.data.done}/{it.data.total}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              <h3 className="text-sm font-semibold text-text-strong">Mensagem do WhatsApp</h3>
            </div>
            {selectedItems.length ? (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
                {message}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">
                Selecione ao menos um talhão.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                disabled={!selectedItems.length}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCopy}
                disabled={!selectedItems.length}
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handlePrint}
                disabled={!selectedItems.length}
              >
                <FileDown className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
