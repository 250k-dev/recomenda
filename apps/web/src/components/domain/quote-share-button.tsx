"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { usePurchaseListQuotes } from "@recomenda/api-hooks";
import { cn } from "@recomenda/utils";
import { EXPORT_ACTION_CLASS } from "@/components/domain/export-action-class";
import { QuoteExportDialog } from "@/components/domain/quote-export-dialog";
import { ShareQuoteSheet } from "@/components/domain/share-quote-sheet";

/**
 * "Compartilhar" da tela de Cotações. Junta as duas saídas da cotação: abre o
 * diálogo de exportar a comparação (WhatsApp/PDF), que tem o atalho para o
 * link de cotação das lojas. O diálogo fecha antes do drawer abrir — dois
 * modais empilhados disputam o foco.
 */
export function QuoteShareButton({
  listId,
  listName,
  producerName,
  agronomistName,
}: {
  listId: string;
  listName: string;
  producerName?: string | null;
  agronomistName?: string | null;
}) {
  const { data } = usePurchaseListQuotes(listId);
  const [exportOpen, setExportOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        className={cn("gap-1.5", EXPORT_ACTION_CLASS)}
        onClick={() => setExportOpen(true)}
      >
        <Share2 className="h-4 w-4" />
        Compartilhar
      </Button>
      <QuoteExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={data}
        context={{ listName, producerName, agronomistName }}
        onOpenQuoteLink={() => {
          setExportOpen(false);
          setLinkOpen(true);
        }}
      />
      <ShareQuoteSheet
        listId={listId}
        listName={listName}
        producerName={producerName}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </>
  );
}
