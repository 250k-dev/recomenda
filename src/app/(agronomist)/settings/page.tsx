"use client";

import { PageHeader } from "@/components/domain/page-header";
import { Settings } from "lucide-react";
import { PageHeaderSkeleton, SettingsFormSkeleton } from "@/components/domain/page-skeletons";
import { AccountSettingsPanel } from "@/components/domain/account-settings-panel";
import { useMe } from "@/lib/api/hooks";

export default function SettingsPage() {
  const { isLoading } = useMe();

  if (isLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <SettingsFormSkeleton />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        section="Conta"
        title="Configurações"
        description="Gerencie seu perfil e preferências de conta."
      />
      <AccountSettingsPanel />
    </>
  );
}
