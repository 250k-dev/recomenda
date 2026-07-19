"use client";

import { useState } from "react";
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
import { WhatsAppIcon } from "@/assets/whatsapp-icon";
import type { PurchaseListDetail } from "@recomenda/api/purchase-lists";
import {
  buildPurchaseListWhatsappMessage,
  printPurchaseList,
  type PurchaseListPrintContext,
} from "@recomenda/domain/purchase-list/purchase-list-print-document";

export function PurchaseListExportDialog({
  open,
  onOpenChange,
  list,
  context = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: PurchaseListDetail;
  context?: PurchaseListPrintContext;
}) {
  const [copied, setCopied] = useState(false);

  const message = buildPurchaseListWhatsappMessage(list, context);
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
    window.setTimeout(() => printPurchaseList(list, context), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar lista de compra</DialogTitle>
          <DialogDescription>
            Envie a lista completa pelo WhatsApp ou gere um PDF para o produtor.
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
            <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
              {message}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                onClick={handleSendWhatsapp}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleCopy}>
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
              Gera a lista completa. Na janela de impressão, escolha{" "}
              <strong>Salvar como PDF</strong>.
            </p>
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
