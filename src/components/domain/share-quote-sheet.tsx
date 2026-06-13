"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCreateQuoteRequest } from "@/lib/api/hooks";
import { toast } from "sonner";

export function ShareQuoteSheet({
  listId,
  listName,
  producerName,
}: {
  listId: string;
  listName: string;
  producerName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createRequest = useCreateQuoteRequest(listId);
  const { mutate } = createRequest;

  // Gera (ou recupera) o link assim que o painel abre.
  useEffect(() => {
    if (open && !token) {
      mutate(undefined, {
        onSuccess: (data) => setToken(data.token),
        onError: () => toast.error("Não foi possível gerar o link de cotação."),
      });
    }
  }, [open, token, mutate]);

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/cotacao/${token}`
      : "";

  const whatsappText = encodeURIComponent(
    `Olá! Segue a lista de compras${producerName ? ` do produtor ${producerName}` : ""} para cotação de preços: ${shareUrl}`,
  );

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie o link manualmente.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-4 w-4" />
          Compartilhar cotação
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Link de cotação
          </SheetTitle>
          <SheetDescription className="text-sm">
            Envie este link ao produtor. Ele encaminha para as lojas, que informam
            preço e disponibilidade. Cada loja só enxerga a própria cotação.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lista
            </span>
            <p className="mt-0.5 font-medium text-foreground">{listName}</p>
          </div>

          {createRequest.isPending && !token ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando link…
            </div>
          ) : token ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Link público</label>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copy}
                    aria-label="Copiar link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="button" size="lg" className="gap-2" onClick={copy}>
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
                <Button asChild type="button" variant="outline" size="lg" className="gap-2">
                  <a
                    href={`https://wa.me/?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar no WhatsApp
                  </a>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                O mesmo link serve para todas as lojas. Você acompanha os preços
                recebidos em <strong>Cotações das lojas</strong>.
              </p>
            </>
          ) : (
            <p className="text-sm text-destructive">
              Não foi possível gerar o link. Feche e abra novamente.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
