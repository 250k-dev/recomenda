"use client";

import { useState } from "react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { ZapLinkError } from "./zap-link-error";
import { formatZapExpiry, type ZapLoadResult, type ZapProducerDto } from "./zap-types";

export function ZapProducerPage({
  token,
  result,
}: {
  token: string;
  result: ZapLoadResult<ZapProducerDto>;
}) {
  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }
  if (result.data.typ !== "producer_create") {
    return <ZapLinkError status={404} message="Este link não cadastra produtor." />;
  }
  return <ZapProducerForm token={token} initial={result.data} />;
}

function ZapProducerForm({ token, initial }: { token: string; initial: ZapProducerDto }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const podeGravar = !busy && name.trim().length >= 2;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/zap/producers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        label?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "Não deu para cadastrar o produtor.");
        return;
      }
      setDone(json.label ?? name.trim());
    } catch {
      setError("Não deu para cadastrar o produtor.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-primary shadow-(--brand-shadow)">
          <Logo className="size-6 fill-white" />
        </span>
        <h1 className="font-display text-xl font-bold text-text-strong">Produtor cadastrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          <strong className="text-text-strong">{done}</strong> entrou na carteira. Volte no WhatsApp
          se quiser cadastrar a fazenda — o Lico pergunta se prefere no Zap ou no navegador.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-text-strong">Novo produtor</p>
            <p className="text-xs text-muted-foreground">{formatZapExpiry(initial.expiresAt)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl flex-1 gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="zap-producer-name">Nome</Label>
          <Input
            id="zap-producer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Joaquim Bentes"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="zap-producer-email">E-mail (opcional)</Label>
          <Input
            id="zap-producer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joaquim@email.com"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="zap-producer-phone">Telefone (opcional)</Label>
          <Input
            id="zap-producer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(66) 99999-0000"
          />
        </div>

        <Button type="button" disabled={!podeGravar} onClick={() => void submit()}>
          {busy ? "Gravando…" : "Cadastrar produtor"}
        </Button>
      </main>
    </div>
  );
}
