"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMe, useUpdateProfile, useChangePassword } from "@/lib/api/hooks";
import { SettingsFormSkeleton } from "@/components/domain/page-skeletons";

const profileSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Senha atual obrigatória"),
    new_password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "As senhas não conferem",
    path: ["confirm_password"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const res = (error as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message && typeof res.data.message === "string") {
      return res.data.message;
    }
  }
  return fallback;
}

export function AccountSettingsPanel() {
  const { data: user, isLoading } = useMe();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    },
    values: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onUpdateProfile = profileForm.handleSubmit((values) => {
    updateProfileMutation.mutate(
      { name: values.name, email: values.email, phone: values.phone },
      {
        onSuccess: () => {
          toast.success("Perfil atualizado com sucesso!");
        },
        onError: (error: unknown) => {
          toast.error(getErrorMessage(error, "Erro ao atualizar perfil"));
        },
      },
    );
  });

  const onChangePassword = passwordForm.handleSubmit((values) => {
    changePasswordMutation.mutate(
      { oldPassword: values.old_password, newPassword: values.new_password },
      {
        onSuccess: () => {
          toast.success("Senha alterada com sucesso!");
          passwordForm.reset();
          setShowPasswordForm(false);
        },
        onError: (error: unknown) => {
          toast.error(getErrorMessage(error, "Erro ao alterar senha"));
        },
      },
    );
  });

  if (isLoading) {
    return <SettingsFormSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 border-b border-border pb-4">
          <h2 className="text-lg font-semibold text-foreground">Meu perfil</h2>
          <p className="text-sm text-muted-foreground">Atualize suas informações pessoais</p>
        </div>

        <form onSubmit={onUpdateProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Nome</Label>
            <Input
              id="account-name"
              placeholder="Seu nome completo"
              {...profileForm.register("name")}
            />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              placeholder="seu.email@exemplo.com"
              {...profileForm.register("email")}
            />
            {profileForm.formState.errors.email && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-phone">Telefone</Label>
            <Input
              id="account-phone"
              placeholder="(11) 99999-9999"
              {...profileForm.register("phone")}
            />
          </div>

          <Button type="submit" disabled={updateProfileMutation.isPending} className="w-full">
            {updateProfileMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 border-b border-border pb-4">
          <h2 className="text-lg font-semibold text-foreground">Segurança</h2>
          <p className="text-sm text-muted-foreground">Altere sua senha para manter sua conta segura</p>
        </div>

        {!showPasswordForm ? (
          <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
            Alterar senha
          </Button>
        ) : (
          <form onSubmit={onChangePassword} className="space-y-4 animate-slide-up">
            <div className="space-y-1.5">
              <Label htmlFor="account-old-pass">Senha atual</Label>
              <Input
                id="account-old-pass"
                type="password"
                placeholder="Digite sua senha atual"
                {...passwordForm.register("old_password")}
              />
              {passwordForm.formState.errors.old_password && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.old_password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-new-pass">Nova senha</Label>
              <Input
                id="account-new-pass"
                type="password"
                placeholder="Digite uma nova senha"
                {...passwordForm.register("new_password")}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-confirm-pass">Confirmar nova senha</Label>
              <Input
                id="account-confirm-pass"
                type="password"
                placeholder="Confirme a nova senha"
                {...passwordForm.register("confirm_password")}
              />
              {passwordForm.formState.errors.confirm_password && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirm_password.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Alterando…" : "Alterar senha"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPasswordForm(false);
                  passwordForm.reset();
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
