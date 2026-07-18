"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Leaf, Loader2, Store } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuoteResponse, useQuoteByToken } from "@/lib/api/hooks";
import { PublicQuoteHeader } from "@/components/domain/public-quote-header";
import { CROP_LABELS, maskPhoneBR, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import { toast } from "sonner";

const fmtQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const schema = z.object({
  store_name: z.string().min(2, "Informe o nome da loja"),
  responder_name: z.string().optional(),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function QuoteEntryPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const { data, isLoading, isError } = useQuoteByToken(token);
  const createResponse = useCreateQuoteResponse(token);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { store_name: "", responder_name: "", phone: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createResponse.mutate(
      {
        store_name: values.store_name,
        responder_name: values.responder_name || undefined,
        phone: values.phone || undefined,
      },
      {
        onSuccess: (res) => router.push(`/cotacao/${token}/loja/${res.response_token}`),
        onError: () => toast.error("Não foi possível iniciar a cotação. Tente novamente."),
      },
    );
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-6 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg border-destructive/40 shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle className="text-destructive">Link inválido</CardTitle>
            <CardDescription>
              Esta cotação não existe, expirou ou o link está incorreto. Peça um novo
              link ao produtor.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const closed = data.status === "CLOSED";

  return (
    <>
      <PublicQuoteHeader />
      <div className="mx-auto w-full max-w-2xl p-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center gap-3">
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
            {CROP_LABELS[data.list.crop] ?? data.list.crop}
            {data.list.variety ? ` · ${data.list.variety}` : ""} ·{" "}
            {fmtQty(data.list.total_hectares)} ha
            {data.producer_name ? ` · Produtor: ${data.producer_name}` : ""}
          </p>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5 text-primary-strong" />
            Identifique sua loja
          </CardTitle>
          <CardDescription>
            Preencha o nome da loja para começar. Você receberá um link próprio para
            informar os preços. Sua cotação é privada — outras lojas não a veem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {closed ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Esta cotação foi encerrada pelo agrônomo e não aceita novas respostas.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Nome da loja *</Label>
                <Input
                  id="store_name"
                  className="h-11"
                  placeholder="Ex.: Agro Central"
                  {...form.register("store_name")}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.store_name?.message}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responder_name">Seu nome</Label>
                  <Input
                    id="responder_name"
                    className="h-11"
                    placeholder="Quem está cotando"
                    {...form.register("responder_name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input
                    id="phone"
                    className="h-11"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    {...form.register("phone")}
                    onChange={(e) =>
                      form.setValue("phone", maskPhoneBR(e.target.value), {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full gap-2"
                disabled={createResponse.isPending}
              >
                {createResponse.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Começar cotação
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Já começou? Use o link que você recebeu ao iniciar para continuar.
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 px-1 font-display text-base font-semibold text-text-strong">
          Produtos a cotar ({data.items.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-3">Produto</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.purchase_list_item_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-semibold text-text-strong">
                    {it.product_name}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {PRODUCT_CATEGORY_LABELS[
                      it.category as keyof typeof PRODUCT_CATEGORY_LABELS
                    ] ?? it.category}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-strong">
                    {fmtQty(it.quantity_to_buy)} {it.dose_unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </>
  );
}
