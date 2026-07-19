"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Card } from "@recomenda/ui/card";
import { PasswordInput } from "@recomenda/ui/password-input";
import { Label } from "@recomenda/ui/label";
import { Button } from "@recomenda/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
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
          Redefinir senha
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Crie uma nova senha para a sua conta usando o link seguro que você
          recebeu por e-mail.
        </p>

        <form className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput id="password" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <PasswordInput id="confirm" autoComplete="new-password" />
          </div>
          <Button type="submit" size="lg" className="w-full">
            <Check className="size-4" /> Redefinir senha
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
