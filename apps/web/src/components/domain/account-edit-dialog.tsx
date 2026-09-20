"use client";

import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { PasswordInput } from "@recomenda/ui/forms/password-input";
import { useChangePassword, useMe, useUpdateProfile } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
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

/**
 * Qual edição o modal abre. São chamadas distintas da API — `PATCH /auth/me` e
 * `POST /auth/change-password` — e cada uma tem o seu botão no herói do perfil.
 */
export type AccountEditSection = "dados" | "senha";

type AccountUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const SECTION_COPY: Record<
  AccountEditSection,
  { title: string; description: string }
> = {
  dados: {
    title: "Editar perfil",
    description: "Atualize seu nome e seus dados de contato.",
  },
  senha: {
    title: "Alterar senha",
    description: "Troque a senha de acesso à sua conta.",
  },
};

const FIELD_CLASS = "h-11 rounded-xl";
const LABEL_CLASS = "text-[13px] font-semibold text-text-strong";
const BODY_CLASS = "min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5";
const FORM_CLASS = "flex min-h-0 flex-1 flex-col";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function FormActions({
  onClose,
  pending,
  children,
}: {
  onClose: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <DialogFooter className="sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending} className="gap-2">
        {children}
      </Button>
    </DialogFooter>
  );
}

/**
 * Identidade e contato. Fica num componente à parte porque o `DialogContent` do
 * Radix desmonta ao fechar: cada abertura monta o `useForm` do zero, já semeado
 * com o `/auth/me` do cache — sem reset em render nem efeito de sincronização.
 */
function ProfileForm({
  user,
  onClose,
}: {
  user: AccountUser;
  onClose: () => void;
}) {
  const updateProfile = useUpdateProfile();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: maskPhoneBR(user.phone),
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    updateProfile.mutate(
      { name: values.name, email: values.email, phone: values.phone },
      {
        onSuccess: () => {
          toast.success("Perfil atualizado com sucesso!");
          onClose();
        },
        onError: (error: unknown) => {
          toast.error(apiErrorMessage(error, "Erro ao atualizar perfil"));
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className={FORM_CLASS}>
      <div className={BODY_CLASS}>
        <div className="space-y-1.5">
          <Label htmlFor="account-name" className={LABEL_CLASS}>
            Nome
          </Label>
          <Input
            id="account-name"
            placeholder="Seu nome completo"
            className={FIELD_CLASS}
            autoFocus
            {...form.register("name")}
          />
          <FieldError message={form.formState.errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-email" className={LABEL_CLASS}>
            E-mail
          </Label>
          <Input
            id="account-email"
            type="email"
            placeholder="seu.email@exemplo.com"
            className={FIELD_CLASS}
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-phone" className={LABEL_CLASS}>
            Telefone
          </Label>
          <Input
            id="account-phone"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            className={FIELD_CLASS}
            {...form.register("phone")}
            onChange={(e) =>
              form.setValue("phone", maskPhoneBR(e.target.value), {
                shouldDirty: true,
              })
            }
          />
        </div>
      </div>
      <FormActions onClose={onClose} pending={updateProfile.isPending}>
        <Check className="size-4" />
        {updateProfile.isPending ? "Salvando…" : "Salvar alterações"}
      </FormActions>
    </form>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(
      { oldPassword: values.old_password, newPassword: values.new_password },
      {
        onSuccess: () => {
          toast.success("Senha alterada com sucesso!");
          onClose();
        },
        onError: (error: unknown) => {
          toast.error(apiErrorMessage(error, "Erro ao alterar senha"));
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className={FORM_CLASS}>
      <div className={BODY_CLASS}>
        <div className="space-y-1.5">
          <Label htmlFor="account-old-pass" className={LABEL_CLASS}>
            Senha atual
          </Label>
          <PasswordInput
            id="account-old-pass"
            placeholder="Digite sua senha atual"
            autoComplete="current-password"
            className={FIELD_CLASS}
            autoFocus
            {...form.register("old_password")}
          />
          <FieldError message={form.formState.errors.old_password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-new-pass" className={LABEL_CLASS}>
            Nova senha
          </Label>
          <PasswordInput
            id="account-new-pass"
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            className={FIELD_CLASS}
            {...form.register("new_password")}
          />
          <FieldError message={form.formState.errors.new_password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-confirm-pass" className={LABEL_CLASS}>
            Confirmar nova senha
          </Label>
          <PasswordInput
            id="account-confirm-pass"
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            className={FIELD_CLASS}
            {...form.register("confirm_password")}
          />
          <FieldError
            message={form.formState.errors.confirm_password?.message}
          />
        </div>
      </div>
      <FormActions onClose={onClose} pending={changePassword.isPending}>
        <KeyRound className="size-4" />
        {changePassword.isPending ? "Alterando…" : "Alterar senha"}
      </FormActions>
    </form>
  );
}

/** Modal de conta do herói do perfil — um formulário por botão, sem abas. */
export function AccountEditDialog({
  open,
  onOpenChange,
  section = "dados",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: AccountEditSection;
}) {
  const { data: user } = useMe();
  const copy = SECTION_COPY[section];
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {section === "senha" ? (
          <PasswordForm onClose={close} />
        ) : user ? (
          <ProfileForm user={user as AccountUser} onClose={close} />
        ) : (
          <div className="space-y-4 px-6 py-6" aria-hidden>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
