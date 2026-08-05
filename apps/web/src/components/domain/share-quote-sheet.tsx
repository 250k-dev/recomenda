"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { NativeSelect, NativeSelectOption } from "@recomenda/ui/primitives/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@recomenda/ui/primitives/sheet";
import {
  useCreateQuoteRequest,
  usePurchaseListQuotes,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { QuotePaymentTerm } from "@recomenda/api/quotes";
import { toast } from "sonner";
import { cn } from "@recomenda/utils";

const PAYMENT_OPTIONS: Array<{ value: QuotePaymentTerm; label: string }> = [
  { value: "CASH", label: "À vista" },
  { value: "TERM", label: "A prazo (parcelado)" },
  { value: "BARTER", label: "Barter (troca por grãos)" },
];

export function ShareQuoteSheet({
  listId,
  listName,
  producerName,
  triggerClassName,
}: {
  listId: string;
  listName: string;
  producerName?: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<"" | QuotePaymentTerm>("");
  const [copied, setCopied] = useState(false);
  const createRequest = useCreateQuoteRequest(listId);

  // Leitura apenas — não cria cotação. Se já existir link, preenche o sheet.
  const quotesQuery = usePurchaseListQuotes(listId, open);

  useEffect(() => {
    if (!open) return;
    const existing = quotesQuery.data?.request;
    if (!existing?.token) return;
    setToken(existing.token);
    if (existing.payment_term) setPaymentTerm(existing.payment_term);
  }, [open, quotesQuery.data?.request]);

  const generateLink = () => {
    if (!paymentTerm) {
      toast.error("Selecione a condição de pagamento.");
      return;
    }
    createRequest.mutate(paymentTerm, {
      onSuccess: (data) => {
        setToken(data.token);
        if (data.payment_term) setPaymentTerm(data.payment_term);
        toast.success("Link de cotação gerado.");
      },
      onError: (error) => {
        toast.error(
          apiErrorMessage(error, "Não foi possível gerar o link de cotação."),
        );
      },
    });
  };

  const updatePaymentTerm = (next: QuotePaymentTerm) => {
    setPaymentTerm(next);
    if (!token) return;
    createRequest.mutate(next, {
      onSuccess: (data) => {
        if (data.payment_term) setPaymentTerm(data.payment_term);
        toast.success("Condição de pagamento atualizada.");
      },
      onError: (error) => {
        toast.error(
          apiErrorMessage(error, "Não foi possível atualizar o pagamento."),
        );
      },
    });
  };

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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setToken(null);
      setPaymentTerm("");
      setCopied(false);
    }
  };

  const loadingExisting = open && quotesQuery.isLoading && !token;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5", triggerClassName)}
        >
          <Share2 className="h-4 w-4" />
          Compartilhar cotação
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary-strong" />
            Link de cotação
          </SheetTitle>
          <SheetDescription className="text-sm">
            Defina a condição de pagamento e confirme para gerar o link. As lojas
            informam preço e disponibilidade — o pagamento é único para a cotação.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Lista
            </span>
            <p className="mt-0.5 font-semibold text-text-strong">{listName}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote-payment-term" className="text-sm font-medium">
              Condição de pagamento
            </Label>
            <NativeSelect
              id="quote-payment-term"
              className="w-full"
              value={paymentTerm}
              disabled={loadingExisting || createRequest.isPending}
              onChange={(e) => {
                const value = e.target.value as "" | QuotePaymentTerm;
                if (!value) {
                  setPaymentTerm("");
                  return;
                }
                if (token) updatePaymentTerm(value);
                else setPaymentTerm(value);
              }}
            >
              <NativeSelectOption value="">Selecione…</NativeSelectOption>
              {PAYMENT_OPTIONS.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              À vista, a prazo ou barter (rótulo — sem cálculo de sacas nesta versão).
            </p>
          </div>

          {loadingExisting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : !token ? (
            <Button
              type="button"
              size="lg"
              className="gap-2"
              onClick={generateLink}
              disabled={!paymentTerm || createRequest.isPending}
            >
              {createRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Gerar link de cotação
            </Button>
          ) : (
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
