"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  if (isError || !invitation) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg border-destructive/40 shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle className="text-destructive">Convite inválido</CardTitle>
            <CardDescription>Este convite não existe, expirou ou já foi utilizado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invitation.status !== "PENDING") {
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle>Convite já utilizado</CardTitle>
            <CardDescription>
              Status: <strong>{invitation.status}</strong>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4 py-12">
      <Card className="w-full max-w-md shadow-sm ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Criar sua conta</CardTitle>
          <CardDescription>
            Você foi convidado para acessar {invitation.farm_ids.length} fazenda(s) como produtor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {acceptMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Erro ao aceitar</AlertTitle>
                <AlertDescription>Tente novamente em instantes.</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" {...form.register("name")} placeholder="Seu nome" />
              <p className="text-xs text-destructive">{form.formState.errors.name?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-ro">E-mail</Label>
              <Input
                id="email-ro"
                type="email"
                value={invitation.email ?? ""}
                disabled
                className="bg-muted/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...form.register("password")} />
              <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmPassword?.message}
              </p>
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? "Criando conta..." : "Criar conta e entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
