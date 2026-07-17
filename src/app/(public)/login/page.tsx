"use client";

import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthShell } from "@/components/auth/auth-shell";
import { useLogin } from "@/lib/api/hooks";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha inválida"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const loginMutation = useLogin();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => loginMutation.mutate(values));

  return (
    <AuthShell>
      <Card className="p-6">
        <div className="space-y-1">
          <h2 className="font-display text-[1.4rem] font-semibold text-text-strong">
            Entrar
          </h2>
          <p className="text-sm text-muted-foreground">
            Área restrita a administradores e agrônomos.
          </p>
        </div>

        <CardContent className="px-0">
          <form onSubmit={onSubmit} className="space-y-5">
            {loginMutation.isError ? (
              (() => {
                const err = loginMutation.error as { code?: string; message?: string } | null;
                const isProducer =
                  err?.code === "PRODUCER_WEB_FORBIDDEN" ||
                  err?.message?.includes("Produtores");
                const isDisabled = err?.code === "ACCOUNT_DISABLED";
                const title = isProducer
                  ? "Acesso restrito"
                  : isDisabled
                    ? "Conta desativada"
                    : "Não foi possível entrar";
                const description = isProducer
                  ? "Contas de produtor não têm acesso ao painel web."
                  : isDisabled
                    ? "Sua conta foi desativada. Contate o suporte."
                    : "Verifique e-mail e senha ou tente novamente em instantes.";
                return (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>{title}</AlertTitle>
                    <AlertDescription>{description}</AlertDescription>
                  </Alert>
                );
              })()
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                {...form.register("email")}
              />
              {form.formState.errors.email?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Senha</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-primary-strong underline-offset-4 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="size-4" aria-hidden />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
