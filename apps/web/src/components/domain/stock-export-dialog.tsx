"use client";

import { useState } from "react";
import { Check, Copy, Download, FileDown } from "lucide-react";
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
import {
  buildStockWhatsappMessage,
  downloadStockCsv,
  printStock,
  type StockExportData,
} from "@recomenda/domain/stock/stock-export";

export function StockExportDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StockExportData;
}) {
  const [copied, setCopied] = useState(false);
  const hasItems = data.items.length > 0;
  const message = hasItems ? buildStockWhatsappMessage(data) : "";
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

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
    window.setTimeout(() => printStock(data), 250);
  };

  const handleCsv = () => {
    downloadStockCsv(data.items);
    toast.success("CSV do estoque baixado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar estoque</DialogTitle>
          <DialogDescription>
            Envie o resumo pelo WhatsApp, gere um PDF ou baixe o CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              <h3 className="text-sm font-semibold text-text-strong">
                Mensagem do WhatsApp
              </h3>
            </div>
            {hasItems ? (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
                {message}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">
                Não há itens em estoque para compartilhar.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                onClick={handleSendWhatsapp}
                disabled={!hasItems}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCopy}
                disabled={!hasItems}
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
              Gera a tabela completa do estoque. Na janela de impressão, escolha{" "}
              <strong>Salvar como PDF</strong>.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePrint}
              disabled={!hasItems}
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Dica: após baixar, anexe o PDF na conversa do WhatsApp para enviar o
              documento junto com a mensagem.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-strong">
                Planilha CSV
              </h3>
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Baixa o estoque em CSV (separador `;`) para abrir no Excel ou
              planilhas.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleCsv}
              disabled={!hasItems}
            >
              <Download className="h-4 w-4" />
              Baixar CSV
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
