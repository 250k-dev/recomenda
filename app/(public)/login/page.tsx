"use client";

import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParticleField } from "@/components/auth/particle-field";
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
    <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden">
      <ParticleField />

      {/* Vinhetas + ruído suave para profundidade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,oklch(0.55_0.14_145/0.18),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/85"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/recomenda/logo-full-positive.svg"
            alt="Recomenda"
            width={220}
            height={147}
            priority
            className="h-auto w-[min(100%,220px)] dark:hidden"
          />
          <Image
            src="/recomenda/logo-full-reverse.svg"
            alt="Recomenda"
            width={220}
            height={147}
            priority
            className="hidden h-auto w-[min(100%,220px)] dark:block"
          />
        </div>

        <Card className="w-full max-w-[420px] border-border/60 bg-card/80 shadow-2xl shadow-black/5 backdrop-blur-xl ring-1 ring-white/20 dark:ring-white/5">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">Entrar</CardTitle>
            <CardDescription className="text-base leading-snug">
              Área restrita a administradores e agrônomos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={onSubmit} className="space-y-5">
              {loginMutation.isError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>
                    {loginMutation.error?.message?.includes("Produtores")
                      ? "Acesso restrito"
                      : "Não foi possível entrar"}
                  </AlertTitle>
                  <AlertDescription>
                    {loginMutation.error?.message?.includes("Produtores")
                      ? "Produtores devem acessar o Recomenda App, não este painel."
                      : "Verifique e-mail e senha ou tente novamente em instantes."}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                <p className="text-xs text-destructive">{form.formState.errors.email?.message}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
              </div>
              <Button className="w-full gap-2 shadow-md shadow-primary/20" size="lg" type="submit" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-10 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Ao continuar, você concorda com o uso seguro da plataforma conforme políticas da sua organização.
        </p>
      </div>
    </div>
  );
}
