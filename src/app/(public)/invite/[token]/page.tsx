"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAcceptInvitation, useInvitationByToken } from "@/lib/api/hooks";

const acceptSchema = z
  .object({
    name: z.string().min(2, "Nome obrigatório"),
    password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type AcceptFormValues = z.infer<typeof acceptSchema>;

export default function InviteTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const { data: invitation, isLoading, isError } = useInvitationByToken(token);
  const acceptMutation = useAcceptInvitation(token);

  const form = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(({ name, password }) => {
    acceptMutation.mutate(
      { name, password },
      {
        onSuccess: () => router.push("/login"),
      },
    );
  });

  if (isLoading) {
    return (
      <AuthShell>
        <Card className="p-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-6 h-11 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="mt-6 h-11 w-full" />
        </Card>
      </AuthShell>
    );
  }

  if (isError || !invitation) {
    return (
      <AuthShell>
        <Card className="border-danger-border p-6">
          <h2 className="font-display text-[1.4rem] font-semibold text-danger-strong">
            Convite inválido
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Este convite não existe, expirou ou já foi utilizado.
          </p>
        </Card>
      </AuthShell>
    );
  }

  if (invitation.status !== "PENDING") {
    return (
      <AuthShell>
        <Card className="p-6">
          <h2 className="font-display text-[1.4rem] font-semibold text-text-strong">
            Convite já utilizado
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Status: <strong className="text-text-strong">{invitation.status}</strong>
          </p>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="p-6">
        <h2 className="font-display text-[1.4rem] font-semibold text-text-strong">
          Criar sua conta
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Você foi convidado para acessar {invitation.farm_ids.length} fazenda(s)
          como produtor.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {acceptMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Erro ao aceitar</AlertTitle>
              <AlertDescription>Tente novamente em instantes.</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" {...form.register("name")} placeholder="Seu nome" />
            {form.formState.errors.name?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-ro">E-mail</Label>
            <Input
              id="email-ro"
              type="email"
              value={invitation.email ?? ""}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput id="password" {...form.register("password")} />
            {form.formState.errors.password?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <PasswordInput
              id="confirmPassword"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>
          <Button
            className="w-full"
            size="lg"
            type="submit"
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Criando conta...
              </>
            ) : (
              <>
                <Check className="size-4" /> Criar conta e entrar
              </>
            )}
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
