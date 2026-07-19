"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Card } from "@recomenda/ui/card";
import { Input } from "@recomenda/ui/input";
import { Label } from "@recomenda/ui/label";
import { Button } from "@recomenda/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthShell>
      <Card className="p-6">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-text-strong"
        >
          <ArrowLeft className="size-4" /> Voltar ao login
        </Link>
        <h2 className="font-display text-[1.4rem] font-semibold text-text-strong">
          Recuperar senha
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link para você redefinir sua senha
          com segurança.
        </p>

        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">E-mail da conta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full">
            <Mail className="size-4" /> Enviar link de recuperação
          </Button>
          {sent ? (
            <p className="rounded-lg border border-success-border bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
              Se houver uma conta com esse e-mail, você receberá um link de
              recuperação em instantes.
            </p>
          ) : null}
        </form>
      </Card>
    </AuthShell>
  );
}
