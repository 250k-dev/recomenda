"use client";

import { PageHeader } from "@/components/domain/page-header";
import { PageHeaderSkeleton, SettingsFormSkeleton } from "@/components/domain/page-skeletons";
import { AccountSettingsPanel } from "@/components/domain/account-settings-panel";
import { useMe } from "@/lib/api/hooks";

export default function AdminSettingsPage() {
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
      <PageHeader title="Configurações" description="Nome, e-mail e senha da sua conta de administrador." />
      <AccountSettingsPanel />
    </>
  );
}
