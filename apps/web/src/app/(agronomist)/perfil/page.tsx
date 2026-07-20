"use client";

import { useRouter } from "next/navigation";
import { CircleUserRound, CreditCard, LogOut } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { AccountSettingsPanel } from "@/components/domain/account-settings-panel";
import { PlanQuotaPanel } from "@/components/domain/plan-quota-panel";
import { Button } from "@recomenda/ui/primitives/button";
import { logout } from "@recomenda/api";

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    router.push("/login?force=1");
  };

  return (
    <div className="mx-auto max-w-[780px] space-y-[18px]">
      <PageHeader
        icon={<CircleUserRound className="h-6 w-6" />}
        section="Conta"
        title="Meu perfil"
        description="Gerencie suas informações, seu plano e o acesso à sua conta."
        className="mb-0"
      />

      <AccountSettingsPanel />

      <div className="flex items-start gap-4 pt-2">
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-primary-soft text-primary-strong">
          <CreditCard className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-primary-strong">
            Conta
          </p>
          <h2 className="mt-0.5 font-display text-[28px] font-semibold tracking-[-0.02em] text-text-strong">
            Plano e quota
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Seu plano contratado e o uso de talhões em safras ativas.
          </p>
        </div>
      </div>

      <PlanQuotaPanel />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-[22px] sm:py-5">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-text-strong">
              Sessão
            </h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Encerre sua sessão neste dispositivo.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="h-11 shrink-0 gap-2 border-danger-border bg-danger-soft px-[18px] text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </section>
    </div>
  );
}
