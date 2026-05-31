"use client";

import { useRouter } from "next/navigation";
import { UserCircle, LogOut } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { AccountSettingsPanel } from "@/components/domain/account-settings-panel";
import { PlanQuotaPanel } from "@/components/domain/plan-quota-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api/client";
import { clearAccessToken } from "@/lib/auth/token-store";

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    clearAccessToken();
    router.push("/login");
  };

  return (
    <>
      <PageHeader
        icon={<UserCircle className="h-5 w-5" />}
        section="Conta"
        title="Meu perfil"
        description="Gerencie suas informações, seu plano e o acesso à sua conta."
      />

      <div className="space-y-6">
        <AccountSettingsPanel />

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-foreground">
            Plano e quota
          </h2>
          <p className="text-sm text-muted-foreground">
            Seu plano contratado e o uso de talhões em safras ativas (publicadas
            ou em andamento).
          </p>
        </div>
        <PlanQuotaPanel />

        <Card>
          <CardHeader>
            <CardTitle>Sessão</CardTitle>
            <CardDescription>
              Encerre sua sessão neste dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="size-4" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
