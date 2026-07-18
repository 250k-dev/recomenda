"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMe, useUpdateProfile, useChangePassword } from "@/lib/api/hooks";
import { SettingsFormSkeleton } from "@/components/domain/page-skeletons";
import { maskPhoneBR } from "@recomenda/utils";

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
    const res = (error as { response?: { data?: { message?: string } } })
      .response;
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
      phone: maskPhoneBR(user?.phone),
    },
    values: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: maskPhoneBR(user?.phone),
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
    <div className="space-y-[18px]">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-[22px]">
          <h2 className="font-display text-[17px] font-semibold text-text-strong">
            Dados pessoais
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Atualize suas informações de contato.
          </p>
        </div>
        <form onSubmit={onUpdateProfile} className="space-y-4 px-5 py-5 sm:px-[22px] sm:py-[22px]">
          <div className="space-y-1.5">
            <Label htmlFor="account-name" className="text-[13.5px] font-semibold text-text-strong">
              Nome
            </Label>
            <Input
              id="account-name"
              placeholder="Seu nome completo"
              className="h-[46px] rounded-xl"
              {...profileForm.register("name")}
            />
            {profileForm.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-email" className="text-[13.5px] font-semibold text-text-strong">
                E-mail
              </Label>
              <Input
                id="account-email"
                type="email"
                placeholder="seu.email@exemplo.com"
                className="h-[46px] rounded-xl"
                {...profileForm.register("email")}
              />
              {profileForm.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-phone" className="text-[13.5px] font-semibold text-text-strong">
                Telefone
              </Label>
              <Input
                id="account-phone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                className="h-[46px] rounded-xl"
                {...profileForm.register("phone")}
                onChange={(e) =>
                  profileForm.setValue("phone", maskPhoneBR(e.target.value), {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="h-11 gap-2 px-5 text-[14.5px]"
            >
              <Check className="h-4 w-4" />
              {updateProfileMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:py-5">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-text-strong">
              Segurança
            </h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Altere sua senha para manter sua conta segura.
            </p>
          </div>
          {!showPasswordForm ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPasswordForm(true)}
              className="h-11 shrink-0 gap-2 bg-surface px-[18px]"
            >
              <KeyRound className="h-4 w-4" />
              Alterar senha
            </Button>
          ) : null}
        </div>

        {showPasswordForm ? (
          <form
            onSubmit={onChangePassword}
            className="animate-slide-up border-t border-border px-5 py-5 sm:px-[22px] sm:py-[22px]"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="account-old-pass" className="text-[13.5px] font-semibold text-text-strong">
                  Senha atual
                </Label>
                <PasswordInput
                  id="account-old-pass"
                  placeholder="Digite sua senha atual"
                  className="h-[46px] rounded-xl"
                  {...passwordForm.register("old_password")}
                />
                {passwordForm.formState.errors.old_password ? (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.old_password.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="account-new-pass" className="text-[13.5px] font-semibold text-text-strong">
                    Nova senha
                  </Label>
                  <PasswordInput
                    id="account-new-pass"
                    placeholder="Digite uma nova senha"
                    className="h-[46px] rounded-xl"
                    {...passwordForm.register("new_password")}
                  />
                  {passwordForm.formState.errors.new_password ? (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.new_password.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-confirm-pass" className="text-[13.5px] font-semibold text-text-strong">
                    Confirmar nova senha
                  </Label>
                  <PasswordInput
                    id="account-confirm-pass"
                    placeholder="Confirme a nova senha"
                    className="h-[46px] rounded-xl"
                    {...passwordForm.register("confirm_password")}
                  />
                  {passwordForm.formState.errors.confirm_password ? (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.confirm_password.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-surface px-4"
                onClick={() => {
                  setShowPasswordForm(false);
                  passwordForm.reset();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="h-11 gap-2 px-5"
              >
                {changePasswordMutation.isPending ? "Alterando…" : "Alterar senha"}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
