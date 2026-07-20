"use client";

import { useRouter } from "next/navigation";
import { UserCircle, LogOut } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { AccountSettingsPanel } from "@/components/domain/account-settings-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recomenda/ui/primitives/card";
import { Button } from "@recomenda/ui/primitives/button";
import { logout } from "@recomenda/api";

export default function AdminProfilePage() {
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
    <>
      <PageHeader
        icon={<UserCircle className="h-5 w-5" />}
        section="Conta"
        title="Meu perfil"
        description="Gerencie suas informações e o acesso à sua conta."
      />

      <div className="space-y-6">
        <AccountSettingsPanel />

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
