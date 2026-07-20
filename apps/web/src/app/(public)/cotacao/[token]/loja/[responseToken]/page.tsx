"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Leaf, Loader2, Send, Store } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Textarea } from "@recomenda/ui/primitives/textarea";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { Card, CardDescription, CardHeader, CardTitle } from "@recomenda/ui/primitives/card";
import { NativeSelect, NativeSelectOption } from "@recomenda/ui/primitives/native-select";
import { useQuoteResponse, useUpdateQuoteResponse } from "@recomenda/api-hooks";
import { PublicQuoteHeader } from "@/components/domain/public-quote-header";
import { CompletionRing } from "@/components/domain/completion-ring";
import type {
  QuoteAvailability,
  QuotePaymentTerm,
  QuoteResponseItem,
} from "@recomenda/api/quotes";
import { CROP_LABELS, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import { toast } from "sonner";

const fmtQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Aceita "1.234,56", "12,5" ou "12.5". */
function parseNum(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  let t = s.replace(/\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type ItemDraft = {
  availability: "" | QuoteAvailability;
  payment_term: "" | QuotePaymentTerm;
  unit_price_brl: string;
  substitute_product_name: string;
  substitute_unit_price_brl: string;
  notes: string;
};

function toDraft(it: QuoteResponseItem): ItemDraft {
  return {
    availability: it.availability ?? "",
    payment_term: it.payment_term ?? "",
    unit_price_brl: it.unit_price_brl != null ? String(it.unit_price_brl) : "",
    substitute_product_name: it.substitute_product_name ?? "",
    substitute_unit_price_brl:
      it.substitute_unit_price_brl != null ? String(it.substitute_unit_price_brl) : "",
    notes: it.notes ?? "",
  };
}

export default function StoreQuotePage() {
  const params = useParams<{ token: string; responseToken: string }>();
  const responseToken = params.responseToken;

  const { data, isLoading, isError } = useQuoteResponse(responseToken);
  const update = useUpdateQuoteResponse(responseToken);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const initRef = useRef<string | null>(null);

  // Inicializa os campos uma vez (não sobrescreve edições não salvas em refetch).
  useEffect(() => {
    if (data && initRef.current !== responseToken) {
      initRef.current = responseToken;
      const next: Record<string, ItemDraft> = {};
      data.items.forEach((it) => {
        next[it.purchase_list_item_id] = toDraft(it);
      });
      setDrafts(next);
    }
  }, [data, responseToken]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const submitted = data?.response.status === "SUBMITTED";

  const filledCount = useMemo(() => {
    return Object.values(drafts).filter(
      (d) => d.availability || d.unit_price_brl || d.substitute_product_name,
    ).length;
  }, [drafts]);

  const save = (submit: boolean) => {
    if (!data) return;
    const items = data.items.map((it) => {
      const d = drafts[it.purchase_list_item_id] ?? toDraft(it);
      return {
        purchase_list_item_id: it.purchase_list_item_id,
        availability: d.availability || undefined,
        // Só envia a condição quando a loja tem o produto.
        payment_term:
          d.availability && d.availability !== "UNAVAILABLE"
            ? d.payment_term || undefined
            : undefined,
        unit_price_brl: parseNum(d.unit_price_brl),
        substitute_product_name: d.substitute_product_name.trim() || undefined,
        substitute_unit_price_brl: parseNum(d.substitute_unit_price_brl),
        notes: d.notes.trim() || undefined,
      };
    });
    update.mutate(
      { items, submit },
      {
        onSuccess: () => {
          toast.success(submit ? "Cotação enviada. Obrigado!" : "Cotação salva.");
        },
        onError: () => toast.error("Não foi possível salvar. Tente novamente."),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-6 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg border-destructive/40 shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle className="text-destructive">Cotação não encontrada</CardTitle>
            <CardDescription>
              Este link de cotação não é válido. Volte ao link recebido e identifique
              sua loja novamente.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pctFilled =
    data.items.length > 0 ? (filledCount / data.items.length) * 100 : 0;

  return (
    <>
      <PublicQuoteHeader />
      <div className="mx-auto w-full max-w-3xl p-4 pb-28 pt-8 sm:pt-12">
      <header className="mb-5 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
          <Leaf className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
            Cotação de preços
          </p>
          <h1 className="font-display text-xl font-semibold tracking-[-0.02em] text-text-strong">
            {data.list.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {CROP_LABELS[data.list.crop] ?? data.list.crop} ·{" "}
            {fmtQty(data.list.total_hectares)} ha
          </p>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
        <CompletionRing value={submitted ? 100 : pctFilled} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold text-text-strong">
            <Store className="h-4 w-4 text-primary-strong" />
            {data.response.store_name}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {submitted ? (
              <span className="inline-flex items-center gap-1 text-success-strong">
                <CheckCircle2 className="h-4 w-4" /> Cotação enviada
              </span>
            ) : (
              `${filledCount} de ${data.items.length} itens preenchidos — continue de onde parou.`
            )}
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Informe o <strong>preço por unidade</strong> e a disponibilidade de cada
        produto. Se não tiver o produto, você pode indicar um substituto.
      </p>

      <div className="space-y-3">
        {data.items.map((it) => {
          const d = drafts[it.purchase_list_item_id] ?? toDraft(it);
          const showSubstitute = d.availability === "UNAVAILABLE" || d.availability === "PARTIAL";
          const showPaymentTerm = d.availability === "AVAILABLE" || d.availability === "PARTIAL";
          return (
            <div
              key={it.purchase_list_item_id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {PRODUCT_CATEGORY_LABELS[
                      it.category as keyof typeof PRODUCT_CATEGORY_LABELS
                    ] ?? it.category}
                    {it.stage ? ` · ${it.stage}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantidade
                  </p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {fmtQty(it.quantity_to_buy)} {it.dose_unit}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Disponibilidade</Label>
                  <NativeSelect
                    className="w-full"
                    value={d.availability}                    onChange={(e) =>
                      setField(it.purchase_list_item_id, "availability", e.target.value)
                    }
                  >
                    <NativeSelectOption value="">Selecione…</NativeSelectOption>
                    <NativeSelectOption value="AVAILABLE">Tenho em estoque</NativeSelectOption>
                    <NativeSelectOption value="PARTIAL">Tenho parcial</NativeSelectOption>
                    <NativeSelectOption value="UNAVAILABLE">Não tenho</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço por {it.dose_unit} (R$)</Label>
                  <Input
                    className="h-11"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={d.unit_price_brl}                    onChange={(e) =>
                      setField(it.purchase_list_item_id, "unit_price_brl", e.target.value)
                    }
                  />
                </div>
                {showPaymentTerm ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Condição de pagamento</Label>
                    <NativeSelect
                      className="w-full"
                      value={d.payment_term}
                      onChange={(e) =>
                        setField(it.purchase_list_item_id, "payment_term", e.target.value)
                      }
                    >
                      <NativeSelectOption value="">Selecione…</NativeSelectOption>
                      <NativeSelectOption value="CASH">À vista</NativeSelectOption>
                      <NativeSelectOption value="TERM">A prazo (parcelado)</NativeSelectOption>
                    </NativeSelect>
                  </div>
                ) : null}
              </div>

              {showSubstitute ? (
                <div className="mt-3 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Produto alternativo (opcional)</Label>
                    <Input
                      className="h-11"
                      placeholder="Nome do produto que você tem"
                      value={d.substitute_product_name}                      onChange={(e) =>
                        setField(
                          it.purchase_list_item_id,
                          "substitute_product_name",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Preço do alternativo (R$)</Label>
                    <Input
                      className="h-11"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={d.substitute_unit_price_brl}                      onChange={(e) =>
                        setField(
                          it.purchase_list_item_id,
                          "substitute_unit_price_brl",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 space-y-1.5">
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea
                  className="min-h-0 py-2"
                  rows={2}
                  placeholder="Prazo de entrega, marca, etc."
                  value={d.notes}                  onChange={(e) =>
                    setField(it.purchase_list_item_id, "notes", e.target.value)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de ações fixa */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 p-3">
          {submitted ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success-strong" />
              Enviada — você pode ajustar os preços e salvar de novo.
            </span>
          ) : (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Salva e envia direto para o agrônomo.
            </span>
          )}
          <Button
            size="lg"
            variant="clay"
            className="gap-2"
            onClick={() => save(true)}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Salvar e enviar
          </Button>
        </div>
      </div>
      </div>
    </>
  );
}
