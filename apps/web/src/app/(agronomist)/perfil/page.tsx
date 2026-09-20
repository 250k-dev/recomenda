"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CircleUserRound,
  KeyRound,
  LogOut,
  Pencil,
} from "lucide-react";
import { PageHero, type PageHeroStat } from "@/components/domain/page-hero";
import {
  AccountEditDialog,
  type AccountEditSection,
} from "@/components/domain/account-edit-dialog";
import { PlanQuotaPanel } from "@/components/domain/plan-quota-panel";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { useActiveScope, useMe } from "@recomenda/api-hooks";
import { logout } from "@recomenda/api";
import { formatPhoneBR } from "@recomenda/utils";
import { accountRoleLabel, scopeOfLabel } from "@/lib/scope-label";

export default function ProfilePage() {
  const router = useRouter();
  const { data: user } = useMe();
  const activeScope = useActiveScope();
  const [edit, setEdit] = useState<{
    open: boolean;
    section: AccountEditSection;
  }>({ open: false, section: "dados" });

  const openEdit = (section: AccountEditSection) =>
    setEdit({ open: true, section });

  // Plano/quota é da conta própria de agrônomo: no modo gestão o que vale é a
  // carteira hospedeira, e membro de equipe não tem plano nenhum. Mesmo
  // critério do menu do usuário — sem isso a tela pede um plano que não existe.
  const showOwnPlan = !activeScope && user?.role === "AGRONOMIST";

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    router.push("/login?force=1");
  };

  const stats: PageHeroStat[] = [
    { label: "E-mail", value: user?.email ?? "—", wide: true },
    { label: "Telefone", value: formatPhoneBR(user?.phone, "Não cadastrado") },
    ...(activeScope
      ? [
          {
            label: "Carteira ativa",
            value: scopeOfLabel(
              activeScope.agronomist_name,
              activeScope.access_level,
            ),
          },
        ]
      : []),
  ];

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
        stats={stats}
      />

      <div className="space-y-6">
        {showOwnPlan ? (
          <PlanQuotaPanel />
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                <Briefcase className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-text-strong">
                  Acesso
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {activeScope
                    ? `Você está na carteira de ${activeScope.agronomist_name}. Plano e quota de talhões são da conta do agrônomo responsável.`
                    : "Seu acesso vem da equipe de um agrônomo — plano e quota de talhões ficam na conta dele."}
                </p>
              </div>
            </div>
          </section>
        )}

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
                  Encerra a sessão neste dispositivo. Seus dados continuam
                  salvos.
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
      </div>

      <AccountEditDialog
        open={edit.open}
        section={edit.section}
        onOpenChange={(open) => setEdit((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
