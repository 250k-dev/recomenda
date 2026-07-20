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
import { WhatsAppIcon } from "@recomenda/ui/assets/whatsapp-icon";
import { cn } from "@recomenda/utils";
import type { QuoteComparison } from "@recomenda/api/quotes";
import {
  buildQuoteWhatsappMessage,
  printQuoteComparison,
  type QuoteExportMode,
  type QuotePrintContext,
} from "@recomenda/domain/quotes/quote-print-document";

export function QuoteExportDialog({
  open,
  onOpenChange,
  data,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QuoteComparison;
  context: QuotePrintContext;
}) {
  const [copied, setCopied] = useState(false);
  const [shareAll, setShareAll] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Padrão: exporta só o melhor preço de cada produto. Marcar "exportar tudo"
  // volta à comparação completa (todas as lojas por produto), como era antes.
  const [mode, setMode] = useState<QuoteExportMode>("best");

  const allIds = useMemo(() => data.responses.map((r) => r.id), [data.responses]);

  // Ao abrir, volta para "todas as lojas" e modo "melhores preços por loja"
  // (pedido: exportar os preços da loja selecionada, sem misturar).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setShareAll(true);
      setSelected(new Set(allIds));
      setMode("store");
    }
  }

  const storeIds = shareAll ? null : selected;
  const hasSelection = shareAll || selected.size > 0;
  const message = hasSelection
    ? buildQuoteWhatsappMessage(data, storeIds, context, mode)
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
      toast.success("Texto copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie o texto manualmente.");
    }
  };

  const handleSendWhatsapp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handlePrint = () => {
    onOpenChange(false);
    window.setTimeout(() => printQuoteComparison(data, storeIds, context, mode), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar cotações</DialogTitle>
          <DialogDescription>
            Envie o resumo pelo WhatsApp ou gere um PDF com a comparação das lojas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-3 text-sm font-semibold text-text-strong">O que exportar</p>
            <ul className="flex flex-col gap-2.5">
              <li>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="quote-export-mode"
                    className="mt-0.5 size-4 accent-primary"
                    checked={mode === "best"}
                    onChange={() => setMode("best")}
                  />
                  <span>
                    <span className="text-sm font-medium text-text-strong">
                      Melhores preços (misturando lojas)
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Para cada produto, o menor preço entre as lojas selecionadas.
                    </span>
                  </span>
                </label>
              </li>
              <li>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="quote-export-mode"
                    className="mt-0.5 size-4 accent-primary"
                    checked={mode === "store"}
                    onChange={() => setMode("store")}
                  />
                  <span>
                    <span className="text-sm font-medium text-text-strong">
                      Melhores preços por loja
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Exporta os preços de cada loja selecionada, sem misturar.
                      Ex.: só a Loja 1 → sai apenas a lista de preços dela.
                    </span>
                  </span>
                </label>
              </li>
              <li>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="quote-export-mode"
                    className="mt-0.5 size-4 accent-primary"
                    checked={mode === "full"}
                    onChange={() => setMode("full")}
                  />
                  <span>
                    <span className="text-sm font-medium text-text-strong">
                      Comparação completa
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Matriz com o preço de todas as lojas por produto.
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={shareAll}
                onChange={(e) => setShareAll(e.target.checked)}
              />
              <span className="text-sm font-semibold text-text-strong">
                Todas as lojas
              </span>
            </label>

            {!shareAll ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Selecione as lojas a exportar
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
                  {data.responses.map((r) => {
                    const on = selected.has(r.id);
                    return (
                      <li key={r.id}>
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
                            onChange={() => toggle(r.id)}
                          />
                          <span className="font-medium text-text-strong">
                            {r.store_name}
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
                Selecione ao menos uma loja para gerar a mensagem.
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
              Gera a comparação das lojas selecionadas. Na janela de impressão,
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
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
