"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { getAuthSession, login, logout } from "@recomenda/api/auth";
import { useAcceptInvitation, useInvitationByToken } from "@/lib/api/hooks";
import type { InvitationPreview } from "@recomenda/api/producers";

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

function invitationRoleLabel(
  kind?: InvitationPreview["kind"],
  accessLevel?: InvitationPreview["access_level"],
): string {
  if (kind === "CONSULTANT") {
    return accessLevel === "ASSISTANT" ? "consultor" : "gestor";
  }
  return "produtor";
}

const INVITATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

function invitationStatusLabel(status: string): string {
  return INVITATION_STATUS_LABELS[status] ?? status;
}

export default function InviteTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [activeSessionRole, setActiveSessionRole] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: invitation, isLoading, isError } = useInvitationByToken(token);
  const acceptMutation = useAcceptInvitation(token);

  const form = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    let cancelled = false;
    getAuthSession().then((session) => {
      if (!cancelled && session.authenticated) {
        setActiveSessionRole(session.role);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = form.handleSubmit(async ({ name, password }) => {
    setSubmitError(null);
    try {
      await logout();
      await acceptMutation.mutateAsync({ name, password });

      const email = invitation?.email;
      if (!email) {
        router.push("/login?force=1");
        return;
      }

      if (invitation.kind === "CONSULTANT") {
        const result = await login(email, password);
        window.location.assign(
          result.user.role === "ADMIN" ? "/admin" : "/dashboard",
        );
        return;
      }

      router.push("/login?force=1");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível concluir o cadastro.",
      );
    }
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
            Status:{" "}
            <strong className="text-text-strong">
              {invitationStatusLabel(invitation.status)}
            </strong>
          </p>
          <Button asChild className="mt-5 w-full" size="lg">
            <Link href="/login?force=1">Fazer login</Link>
          </Button>
        </Card>
      </AuthShell>
    );
  }

  const isSubmitting = acceptMutation.isPending || form.formState.isSubmitting;

  return (
    <AuthShell>
      <Card className="p-6">
        <h2 className="font-display text-[1.4rem] font-semibold text-text-strong">
          Criar sua conta
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Você foi convidado para acessar como{" "}
          {invitationRoleLabel(invitation.kind, invitation.access_level)}.
        </p>

        {activeSessionRole ? (
          <Alert className="mt-4">
            <AlertTitle>Sessão ativa detectada</AlertTitle>
            <AlertDescription>
              Há uma conta logada neste navegador ({activeSessionRole}). Ao
              continuar, essa sessão será encerrada e você entrará com a nova
              conta.
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {submitError || acceptMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Erro ao aceitar</AlertTitle>
              <AlertDescription>
                {submitError ?? "Tente novamente em instantes."}
              </AlertDescription>
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
          <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
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
