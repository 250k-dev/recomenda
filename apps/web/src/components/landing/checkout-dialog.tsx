"use client";

import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCreateBillingCheckout } from "@recomenda/api-hooks";
import { Button, cn } from "./primitives";

type CheckoutTarget = {
  slug: string;
  name: string;
  billing: "free" | "monthly" | "harvest";
};

export function CheckoutDialog({
  target,
  billingMode,
  defaultAddOnLico = false,
  onClose,
}: {
  target: CheckoutTarget | null;
  billingMode: "pix" | "installments";
  defaultAddOnLico?: boolean;
  onClose: () => void;
}) {
  const checkout = useCreateBillingCheckout();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [addOnLico, setAddOnLico] = useState(Boolean(defaultAddOnLico));
  const [doneFree, setDoneFree] = useState(false);

  if (!target) return null;

  const selected = target;
  const mode = selected.billing === "monthly" ? "monthly" : billingMode;
  const allowLico = selected.slug !== "casa-250k";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (checkout.isPending) return;
    try {
      const result = await checkout.mutateAsync({
        name,
        email,
        taxId,
        planSlug: selected.slug,
        billingMode: mode,
        addOnLico: allowLico && addOnLico,
      });
      if (result.kind === "free") {
        setDoneFree(true);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      /* erro no mutate */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
        {doneFree ? (
          <div>
            <h2 id="checkout-title" className="font-display text-2xl font-semibold text-ink">
              Conta criada
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Enviamos um e-mail para {email} com o link para criar sua senha e
              entrar na Recomenda.
            </p>
            <Button type="button" className="mt-6 w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h2 id="checkout-title" className="font-display text-2xl font-semibold text-ink">
                Assinar {target.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {target.billing === "free"
                  ? "Sem cobrança. Você recebe o acesso por e-mail."
                  : "Depois do pagamento, o e-mail de acesso chega automaticamente."}
              </p>
            </div>
            <label className="block text-sm font-medium text-ink">
              Nome
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-cream px-3"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              E-mail
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-cream px-3"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              CPF ou CNPJ
              <input
                required
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-cream px-3"
              />
            </label>
            {allowLico ? (
              <label className="flex items-start gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={addOnLico}
                  onChange={(e) => setAddOnLico(e.target.checked)}
                />
                Incluir Lico (WhatsApp) no mesmo ciclo
              </label>
            ) : null}
            {checkout.isError ? (
              <p className="text-sm text-clay-600">
                {apiErrorMessage(checkout.error, "Não foi possível iniciar o pagamento.")}
              </p>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className={cn("flex-1")}>
                {checkout.isPending ? "Aguarde…" : selected.billing === "free" ? "Criar conta" : "Ir para o pagamento"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
