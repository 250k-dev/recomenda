"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Card } from "@recomenda/ui/primitives/card";
import { PasswordInput } from "@recomenda/ui/forms/password-input";
import { Label } from "@recomenda/ui/primitives/label";
import { Button } from "@recomenda/ui/primitives/button";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useResetPassword } from "@recomenda/api-hooks";
import { AuthShell } from "@/components/auth/auth-shell";

const MIN_LENGTH = 6;

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const resetPassword = useResetPassword();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`A senha deve ter ao menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    try {
      await resetPassword.mutateAsync({ token, password });
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível redefinir a senha."));
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
          Redefinir senha
        </h2>

        {done ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg border border-success-border bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
              Senha redefinida. Todas as sessões abertas foram encerradas — entre
              novamente com a senha nova.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Crie uma nova senha para a sua conta usando o link seguro que você
              recebeu por e-mail.
            </p>

            <form className="mt-5 space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Redefinindo…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Redefinir senha
                  </>
                )}
              </Button>
              {error ? (
                <p className="rounded-lg border border-danger-border bg-danger-soft px-3.5 py-2.5 text-sm text-danger-strong">
                  {error}{" "}
                  <Link
                    href="/esqueci-senha"
                    className="font-medium underline underline-offset-2"
                  >
                    Pedir um novo link
                  </Link>
                </p>
              ) : null}
            </form>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
