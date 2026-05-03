"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <Card className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="text-sm text-zinc-600">Acesso para Admin e Agronomista</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-700">E-mail</label>
            <Input type="email" {...form.register("email")} />
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.email?.message}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Senha</label>
            <Input type="password" {...form.register("password")} />
            <p className="mt-1 text-xs text-red-600">
              {form.formState.errors.password?.message}
            </p>
          </div>
          <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
