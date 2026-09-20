"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, KeyRound, LogOut, Pencil } from "lucide-react";
import { PageHero } from "@/components/domain/page-hero";
import {
  AccountEditDialog,
  type AccountEditSection,
} from "@/components/domain/account-edit-dialog";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { useMe } from "@recomenda/api-hooks";
import { logout } from "@recomenda/api";
import { formatPhoneBR } from "@recomenda/utils";
import { accountRoleLabel } from "@/lib/scope-label";

export default function AdminProfilePage() {
  const router = useRouter();
  const { data: user } = useMe();
  const [edit, setEdit] = useState<{
    open: boolean;
    section: AccountEditSection;
  }>({ open: false, section: "dados" });

  const openEdit = (section: AccountEditSection) =>
    setEdit({ open: true, section });

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    router.push("/login?force=1");
  };

  return (
    <>
      <PageHero
        variant="inverted"
        icon={<CircleUserRound className="size-6" />}
        eyebrow="Conta"
        title={user?.name?.trim() || "Meu perfil"}
        titleBadge={
          <Badge variant="neutral">
            {accountRoleLabel(user?.role, user?.access_level)}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => openEdit("dados")}
            >
              <Pencil className="size-4" />
              Editar perfil
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => openEdit("senha")}
            >
              <KeyRound className="size-4" />
              Alterar senha
            </Button>
          </>
        }
        stats={[
          { label: "E-mail", value: user?.email ?? "—", wide: true },
          {
            label: "Telefone",
            value: formatPhoneBR(user?.phone, "Não cadastrado"),
          },
        ]}
      />

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
              <LogOut className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-text-strong">
                Sair da conta
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Encerra a sessão neste dispositivo. Seus dados continuam salvos.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="h-11 shrink-0 gap-2 px-[18px]"
          >
            <LogOut className="size-4" />
            Sair da conta
          </Button>
        </div>
      </section>

      <AccountEditDialog
        open={edit.open}
        section={edit.section}
        onOpenChange={(open) => setEdit((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
