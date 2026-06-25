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
import {
  buildWhatsappMessage,
  type RecommendationShareData,
} from "@/lib/recommendations/share-message";
import { printRecommendation } from "@/lib/recommendations/print-document";
import { WhatsAppIcon } from "@/assets/whatsapp-icon";

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

  const message = buildWhatsappMessage(data);
  // api.whatsapp.com/send evita o redirect do wa.me que corrompe emojis UTF-8
  // durante a redireção no servidor da Meta.
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

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
    window.setTimeout(() => printRecommendation(data), 250);
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
              Gera um documento completo com todas as etapas e produtos. Na janela
              de impressão, escolha <strong>Salvar como PDF</strong>.
            </p>
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
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
