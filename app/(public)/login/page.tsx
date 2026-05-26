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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParticleField } from "@/components/auth/particle-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLogin } from "@/lib/api/hooks";
import { Logo } from "@/assets/logo";
import { Logo250K } from "@/assets/logo-250K";

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
      {/* <ParticleField /> */}

      {/* Vinhetas + ruído suave para profundidade */}
      {/* <div
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
      /> */}

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle variant="compact" />
      </div>

      <div className="w-full max-w-md mx-auto space-y-8 my-auto px-4 py-12 sm:py-16">
        <div className="w-full flex items-center gap-4 text-center px-6">
          <div className="bg-primary rounded-sm p-2">
            <Logo className="fill-white size-10" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-start">Recomenda</h1>
            <p className="text-sm text-muted-foreground font-medium">
              Sua plataforma de recomendações agrícolas
            </p>
          </div>
        </div>

        <Card className="py-8 px-3">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">Entrar</CardTitle>
            <CardDescription>
              Área restrita a administradores e agrônomos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
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
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                />
                <p className="text-xs text-destructive">
                  {form.formState.errors.email?.message}
                </p>
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
                <p className="text-xs text-destructive">
                  {form.formState.errors.password?.message}
                </p>
              </div>

              <CardFooter className="w-full px-0 pt-4">
                <Button
                  className="w-full"
                  size="lg"
                  type="submit"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>

        {/* <p className="mt-10 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Ao continuar, você concorda com o uso seguro da plataforma conforme
          políticas da sua organização.
        </p> */}
        <div className="absolute bottom-0 justify-center mx-auto w-full left-0 flex flex-col items-center pb-4 gap-1">
          <p className="text-xs text-muted-foreground font-medium">
            Desenvolvido por
          </p>
          <a
            href="https://250k.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center font-bold gap-1 text-lg"
          >
            <Logo250K className="size-6" />
            250K
          </a>
        </div>
      </div>
    </div>
  );
}
