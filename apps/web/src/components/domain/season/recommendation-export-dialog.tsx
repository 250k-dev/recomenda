"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import {
  buildWhatsappMessage,
  type RecommendationShareData,
} from "@recomenda/domain/recommendations/share-message";
import { printRecommendation } from "@recomenda/domain/recommendations/print-document";
import { WhatsAppIcon } from "@recomenda/ui/assets/whatsapp-icon";
import { cn } from "@recomenda/utils";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

export function RecommendationExportDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RecommendationShareData;
}) {
  const [copied, setCopied] = useState(false);
  const [shareAll, setShareAll] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(
    () => data.recommendations.map((r) => r.id),
    [data.recommendations],
  );

  // Ao abrir (ou trocar de safra), volta para "talhão todo" com tudo marcado.
  // Padrão React de ajuste durante o render ao detectar mudança de `open`.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setShareAll(true);
      setSelected(new Set(allIds));
    }
  }

  const filteredData: RecommendationShareData = useMemo(() => {
    if (shareAll) return data;
    const recommendations = data.recommendations.filter((r) => selected.has(r.id));
    const done = recommendations.filter((r) => APPLIED.has(r.status)).length;
    return { ...data, recommendations, done, total: recommendations.length };
  }, [shareAll, selected, data]);

  const hasSelection = shareAll || filteredData.recommendations.length > 0;
  const message = hasSelection ? buildWhatsappMessage(filteredData) : "";
  // api.whatsapp.com/send evita o redirect do wa.me que corrompe emojis UTF-8
  // durante a redireção no servidor da Meta.
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

  const handleSendWhatsapp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handlePrint = () => {
    onOpenChange(false);
    window.setTimeout(() => printRecommendation(filteredData), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar recomendação</DialogTitle>
          <DialogDescription>
            Envie o resumo pelo WhatsApp ou gere um PDF para entregar ao produtor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={shareAll}
                onChange={(e) => setShareAll(e.target.checked)}
              />
              <span className="text-sm font-semibold text-text-strong">
                Compartilhar o talhão todo
              </span>
            </label>

            {!shareAll ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Selecione as etapas a compartilhar
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-strong hover:underline"
                      onClick={() => setSelected(new Set(allIds))}
                    >
                      Todas
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-strong hover:underline"
                      onClick={() => setSelected(new Set())}
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>
                <ul className="flex flex-col gap-1">
                  {data.recommendations.map((rec, i) => {
                    const on = selected.has(rec.id);
                    return (
                      <li key={rec.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                            on
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={on}
                            onChange={() => toggle(rec.id)}
                          />
                          <span className="font-medium text-text-strong">
                            {i + 1}. {rec.name}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              <h3 className="text-sm font-semibold text-text-strong">
                Mensagem do WhatsApp
              </h3>
            </div>
            {hasSelection ? (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
                {message}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">
                Selecione ao menos uma etapa para gerar a mensagem.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                onClick={handleSendWhatsapp}
                disabled={!hasSelection}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCopy}
                disabled={!hasSelection}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileDown className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-strong">
                Documento em PDF
              </h3>
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Gera um documento com as etapas selecionadas. Na janela de impressão,
              escolha <strong>Salvar como PDF</strong>.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePrint}
              disabled={!hasSelection}
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Dica: após baixar, anexe o PDF na conversa do WhatsApp para enviar o
              documento junto com a mensagem.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
