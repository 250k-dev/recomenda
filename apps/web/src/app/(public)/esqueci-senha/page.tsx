"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Card } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Button } from "@recomenda/ui/primitives/button";
import { useForgotPassword } from "@recomenda/api-hooks";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forgotPassword = useForgotPassword();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await forgotPassword.mutateAsync(email.trim());
      setSent(true);
    } catch {
      // O backend responde 200 mesmo para e-mail sem conta: cair aqui é falha de
      // rede ou limite de tentativas — nunca "esse e-mail não existe".
      setError("Não foi possível enviar agora. Tente novamente em alguns minutos.");
    }
  };

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

        {sent ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg border border-success-border bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
              Se houver uma conta com esse e-mail, você receberá um link de
              recuperação em instantes. O link vale por 1 hora.
            </p>
            <p className="text-sm text-muted-foreground">
              Não chegou? Confira a caixa de spam ou{" "}
              <button
                type="button"
                className="font-medium text-text-strong underline underline-offset-2"
                onClick={() => setSent(false)}
              >
                tente outro e-mail
              </button>
              .
            </p>
          </div>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail da conta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Mail className="size-4" /> Enviar link de recuperação
                </>
              )}
            </Button>
            {error ? (
              <p className="rounded-lg border border-danger-border bg-danger-soft px-3.5 py-2.5 text-sm text-danger-strong">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </Card>
    </AuthShell>
  );
}
